"""Populate a development database with data you can click around in.

Deliberately NOT a migration. Migrations run in production; this must not.
Reference data that the application genuinely depends on - the standard set of
food-safety check types, for instance - belongs in a data migration instead.

    python manage.py seed_demo
    python manage.py seed_demo --reset    # delete a previous run's demo data first

Builds one restaurant ("Phillys"), one admin and three staff, roughly five
weeks of rota + attendance history around today (three pay periods - one
paid, one locked-awaiting-payment, one still open - so every state the pay
period UI can show has a real example), and a handful of shift-swap
requests in every status.
"""

import random
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.attendance import models as attendance_models
from apps.attendance.services import swap as swap_service
from apps.common.roles import Role
from apps.notifications.services.rules import notify_admins_of_scan
from apps.payroll import models as payroll_models
from apps.payroll.services import pay_periods as pay_periods_service
from apps.restaurants.models import Restaurant

User = get_user_model()

DEMO_RESTAURANT_NAME = "Phillys"
# A Friday - matches apps.payroll.services.pay_periods.PERIOD_ANCHOR_FRIDAY's
# cadence, so periods generated here line up on real period boundaries
# instead of landing mid-period.
SEED_START = date(2026, 8, 7)
# Three pay periods (14 days each) out from SEED_START, minus a day.
SEED_END = SEED_START + timedelta(days=3 * 14 - 1)

VENUE_LATITUDE = Decimal("51.5074")
VENUE_LONGITUDE = Decimal("-0.1278")

STAFF_PASSWORD = "StaffPass123!"
ADMIN_PASSWORD = "AdminPass123!"


class Command(BaseCommand):
    help = "Seed the local database with demo data. Development only."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Remove a previous run's demo data (same restaurant name) before seeding.",
        )

    def handle(self, *args, **options):
        # Checked before anything opens a database connection, so the refusal is
        # what you see even when the database is unreachable. Fake staff and fake
        # temperature readings in a real compliance database would be a serious
        # problem, not an inconvenience.
        if not settings.DEBUG:
            raise CommandError(
                "seed_demo refuses to run with DEBUG=False. This command is for "
                "local development only."
            )

        self._seed(reset=options["reset"])

    @transaction.atomic
    def _seed(self, *, reset: bool) -> None:
        """All or nothing: a half-seeded database is worse than an empty one."""
        if reset:
            self._reset()

        restaurant = self._create_restaurant()
        admin = self._create_admin(restaurant)
        staff = self._create_staff(restaurant)
        self._create_venue_qr_code(restaurant)

        shifts_by_staff = {
            member: self._create_shifts_and_logs(restaurant, member, pattern)
            for member, pattern in staff.items()
        }

        periods = self._create_pay_periods(restaurant)
        self._close_out_periods(periods)
        self._seed_swap_requests(shifts_by_staff)
        self._seed_a_live_checkin(restaurant, shifts_by_staff)

        self._print_summary(restaurant, admin, staff, periods)

    # -----------------------------------------------------------------
    # Reset
    # -----------------------------------------------------------------

    def _reset(self) -> None:
        """Deletes everything belonging to a previous DEMO_RESTAURANT_NAME run.

        Only ever touches that one restaurant by name, never "every
        restaurant" - safe to run against a shared dev database without
        wiping a teammate's unrelated data.

        Shift, AttendanceLog, StaffPayRate, RateChange and PayrollEntry all
        protect against deleting a staff member who still has one - and
        Django checks that per-relation, so it does not matter that Shift
        and AttendanceLog would *also* be reachable through Restaurant's own
        cascade; a protected row blocks the delete regardless of whether
        some other path would have removed it too. So every one of them has
        to be cleared explicitly, before the restaurant (and, via it, the
        staff themselves) can go.
        """
        staff_ids = list(
            User.objects.filter(restaurant__name=DEMO_RESTAURANT_NAME).values_list("id", flat=True)
        )
        if staff_ids:
            attendance_models.AttendanceLog.objects.filter(staff_id__in=staff_ids).delete()
            attendance_models.Shift.objects.filter(staff_id__in=staff_ids).delete()
            payroll_models.PayrollEntry.objects.filter(staff_id__in=staff_ids).delete()
            payroll_models.RateChange.objects.filter(staff_id__in=staff_ids).delete()
            payroll_models.StaffPayRate.objects.filter(staff_id__in=staff_ids).delete()

        deleted, _ = Restaurant.objects.filter(name=DEMO_RESTAURANT_NAME).delete()
        if deleted:
            self.stdout.write(f"Removed the previous '{DEMO_RESTAURANT_NAME}' demo run.")

    # -----------------------------------------------------------------
    # People
    # -----------------------------------------------------------------

    def _create_restaurant(self) -> Restaurant:
        return Restaurant.objects.create(
            name=DEMO_RESTAURANT_NAME,
            slug="phillys",
            currency="GBP",
            is_approved=True,
        )

    def _create_admin(self, restaurant: Restaurant):
        return User.objects.create_user(
            email="manager@example.com",
            password=ADMIN_PASSWORD,
            first_name="Ahmad",
            last_name="Manager",
            role=Role.ADMIN,
            restaurant=restaurant,
            is_email_verified=True,
        )

    def _create_staff(self, restaurant: Restaurant) -> dict:
        """Three staff, each with a distinct job, rota pattern and
        punctuality habit - so the analytics/comparison screens have
        something real to compare rather than three identical people."""
        roster = [
            {
                "email": "sara.khan@example.com",
                "first_name": "Sara",
                "last_name": "Khan",
                "job_title": attendance_models.Shift.JobTitle.CHEF,
                "working_days": {0, 1, 2, 3, 4, 5},  # Mon-Sat
                "shift_start": time(8, 0),
                "shift_end": time(16, 0),
                "rate_1": Decimal("12.50"),
                "rate_2": Decimal("15.00"),
                "late_chance": 0.1,  # mostly punctual
            },
            {
                "email": "james.carter@example.com",
                "first_name": "James",
                "last_name": "Carter",
                "job_title": attendance_models.Shift.JobTitle.DRIVER,
                "working_days": {1, 2, 3, 4, 5},  # Tue-Sat
                "shift_start": time(10, 0),
                "shift_end": time(18, 0),
                "rate_1": Decimal("11.00"),
                "rate_2": Decimal("13.50"),
                "late_chance": 0.4,  # often late - the outlier in the comparison charts
            },
            {
                "email": "priya.patel@example.com",
                "first_name": "Priya",
                "last_name": "Patel",
                "job_title": attendance_models.Shift.JobTitle.TILL_OPERATOR,
                "working_days": {0, 1, 2, 3, 4},  # Mon-Fri
                "shift_start": time(9, 0),
                "shift_end": time(17, 0),
                "rate_1": Decimal("13.00"),
                "rate_2": Decimal("16.00"),
                "late_chance": 0.2,
            },
        ]

        staff = {}
        for entry in roster:
            member = User.objects.create_user(
                email=entry["email"],
                password=STAFF_PASSWORD,
                first_name=entry["first_name"],
                last_name=entry["last_name"],
                role=Role.STAFF,
                restaurant=restaurant,
                is_email_verified=True,
            )
            payroll_models.StaffPayRate.objects.create(
                staff=member, rate_1=entry["rate_1"], rate_2=entry["rate_2"]
            )
            staff[member] = entry
        return staff

    def _create_venue_qr_code(self, restaurant: Restaurant) -> None:
        attendance_models.VenueQRCode.objects.create(
            restaurant=restaurant,
            latitude=VENUE_LATITUDE,
            longitude=VENUE_LONGITUDE,
            radius_meters=100,
        )

    # -----------------------------------------------------------------
    # Rota + attendance
    # -----------------------------------------------------------------

    def _create_shifts_and_logs(
        self, restaurant, member, pattern: dict
    ) -> dict[date, attendance_models.Shift]:
        """One shift per working day across SEED_START..SEED_END, with a
        matching attendance log for every day that has already happened -
        closed and on-time/late per the staff member's `late_chance`, or
        left open if the shift is happening right now. A future shift gets
        no log at all: it hasn't been worked yet.
        """
        rng = random.Random(f"{member.email}-shifts")
        now = timezone.now()
        shifts_by_date: dict[date, attendance_models.Shift] = {}

        current = SEED_START
        while current <= SEED_END:
            if current.weekday() in pattern["working_days"]:
                starts_at = timezone.make_aware(datetime.combine(current, pattern["shift_start"]))
                ends_at = timezone.make_aware(datetime.combine(current, pattern["shift_end"]))

                shift = attendance_models.Shift.objects.create(
                    restaurant=restaurant,
                    staff=member,
                    starts_at=starts_at,
                    ends_at=ends_at,
                    job_title=pattern["job_title"],
                )
                shifts_by_date[current] = shift

                if ends_at <= now:
                    self._log_completed_shift(
                        restaurant, member, shift, rng, pattern["late_chance"]
                    )
                # A shift covering this exact moment is left with no log here
                # on purpose - _seed_a_live_checkin clocks those in below, so
                # this doesn't also create a duplicate. A shift later today
                # gets no log at all: it hasn't happened yet.
            current += timedelta(days=1)

        return shifts_by_date

    def _log_completed_shift(
        self, restaurant, member, shift, rng: random.Random, late_chance: float
    ) -> None:
        late_minutes = rng.randint(4, 25) if rng.random() < late_chance else 0
        clock_in = shift.starts_at + timedelta(minutes=late_minutes)
        # Clocks out within a few minutes of the shift end, either side -
        # nobody leaves at the exact second a real shift ends.
        clock_out = shift.ends_at + timedelta(minutes=rng.randint(-3, 6))

        attendance_models.AttendanceLog.objects.create(
            restaurant=restaurant,
            staff=member,
            shift=shift,
            clock_in_at=clock_in,
            clock_in_latitude=VENUE_LATITUDE,
            clock_in_longitude=VENUE_LONGITUDE,
            clock_out_at=clock_out,
            clock_out_latitude=VENUE_LATITUDE,
            clock_out_longitude=VENUE_LONGITUDE,
            status=attendance_models.AttendanceLog.Status.CLOSED,
        )

    def _seed_a_live_checkin(self, restaurant, shifts_by_staff) -> None:
        """Clock in every staff member whose shift covers this exact moment,
        and leave the log open - so "on shift now" has something real to
        show instead of always being empty in a fresh seed. Whether that's
        nobody, one person or all three just depends on what time of day
        this command happens to be run."""
        now = timezone.now()
        today = timezone.localdate()

        for member, shifts_by_date in shifts_by_staff.items():
            shift = shifts_by_date.get(today)
            if shift and shift.starts_at <= now < shift.ends_at:
                late_minutes = random.Random(f"{member.email}-live").randint(0, 8)
                log = attendance_models.AttendanceLog.objects.create(
                    restaurant=restaurant,
                    staff=member,
                    shift=shift,
                    clock_in_at=shift.starts_at + timedelta(minutes=late_minutes),
                    clock_in_latitude=VENUE_LATITUDE,
                    clock_in_longitude=VENUE_LONGITUDE,
                    status=attendance_models.AttendanceLog.Status.OPEN,
                )
                notify_admins_of_scan(log=log, action="check_in")

    # -----------------------------------------------------------------
    # Pay periods
    # -----------------------------------------------------------------

    def _create_pay_periods(self, restaurant) -> list:
        """Three consecutive periods from SEED_START - closed+paid, closed
        (awaiting payment), and left open (the current one)."""
        periods = []
        current_start = SEED_START
        for _ in range(3):
            current_end = current_start + timedelta(days=13)
            period = payroll_models.PayPeriod.objects.create(
                restaurant=restaurant, starts_on=current_start, ends_on=current_end
            )
            periods.append(period)
            current_start = current_end + timedelta(days=1)
        return periods

    def _close_out_periods(self, periods: list) -> None:
        paid_period, locked_period, _open_period = periods
        pay_periods_service.close_pay_period(pay_period=paid_period)
        pay_periods_service.mark_paid(pay_period=paid_period)
        pay_periods_service.close_pay_period(pay_period=locked_period)
        # The third period stays OPEN - it's the one covering today.

    # -----------------------------------------------------------------
    # Shift swaps - one example of every status
    # -----------------------------------------------------------------

    def _seed_swap_requests(self, shifts_by_staff: dict) -> None:
        by_email = {member.email: (member, shifts) for member, shifts in shifts_by_staff.items()}
        sara, sara_shifts = by_email["sara.khan@example.com"]
        james, james_shifts = by_email["james.carter@example.com"]
        priya, priya_shifts = by_email["priya.patel@example.com"]
        admin = User.objects.get(email="manager@example.com")

        today = timezone.localdate()
        next_monday = today + timedelta(days=(7 - today.weekday()) % 7 or 7)
        next_saturday = today + timedelta(days=(5 - today.weekday()) % 7 or 7)

        # Sara offers a Monday shift to James (who is off Mondays) - created,
        # then cancelled, then requested again, so both a CANCELLED history
        # entry and a currently-PENDING one exist to look at.
        sara_monday = sara_shifts.get(next_monday)
        if sara_monday and next_monday <= SEED_END:
            first_attempt = swap_service.request_swap(
                requester=sara, shift=sara_monday, target_staff=james, note="Family thing that day."
            )
            swap_service.cancel_swap(swap_request=first_attempt, cancelled_by=sara)
            swap_service.request_swap(
                requester=sara, shift=sara_monday, target_staff=james, note="Family thing that day."
            )

        # James offers a Saturday shift to Priya (who is off Saturdays) -
        # approved, so it also proves out the actual reassignment.
        james_saturday = james_shifts.get(next_saturday)
        if james_saturday and next_saturday <= SEED_END:
            approved = swap_service.request_swap(
                requester=james, shift=james_saturday, target_staff=priya, note="Football final."
            )
            swap_service.decide_swap(swap_request=approved, approve=True, decided_by=admin)

        # Priya offers a Monday shift to James (also off Mondays) - declined.
        priya_monday = priya_shifts.get(next_monday)
        if priya_monday and next_monday <= SEED_END:
            declined = swap_service.request_swap(
                requester=priya, shift=priya_monday, target_staff=james, note="Dentist appointment."
            )
            swap_service.decide_swap(
                swap_request=declined,
                approve=False,
                decided_by=admin,
                decision_note="Short-staffed that day already - can you find someone else?",
            )

    # -----------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------

    def _print_summary(self, restaurant, admin, staff, periods) -> None:
        self.stdout.write(self.style.SUCCESS(f"\nSeeded '{restaurant.name}':"))
        self.stdout.write(f"  Admin:  {admin.email} / {ADMIN_PASSWORD}")
        for member in staff:
            self.stdout.write(f"  Staff:  {member.email} / {STAFF_PASSWORD}  ({member.first_name})")

        self.stdout.write(f"\n  Rota + attendance: {SEED_START} to {SEED_END}")
        labels = ["paid", "locked (awaiting payment)", "open (current)"]
        for period, label in zip(periods, labels, strict=True):
            self.stdout.write(f"  Pay period {period.starts_on} - {period.ends_on}: {label}")
        self.stdout.write(
            "  Shift swaps: one pending, one approved, one declined, one cancelled.\n"
        )
