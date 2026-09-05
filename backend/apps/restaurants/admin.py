from django.contrib import admin
from django.core.mail import send_mail
from django.utils import timezone

from .models import Restaurant, Table


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "phone",
        "currency",
        "is_active",
        "is_approved",
        "approved_at",
        "created_at",
    )
    list_filter = ("is_approved", "is_active", "currency")
    search_fields = ("name", "email", "phone")
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ("approved_at", "approved_by")
    actions = ["approve_takeaways"]

    @admin.action(description="Approve selected takeaways")
    def approve_takeaways(self, request, queryset):
        # Only the ones actually waiting - re-approving an already-approved
        # restaurant would overwrite who really approved it and when, and
        # re-email a manager who already got their notification.
        pending = queryset.filter(is_approved=False)
        count = 0
        for restaurant in pending:
            self._approve(restaurant, approved_by=request.user)
            count += 1
        self.message_user(request, f"Approved {count} takeaway(s).")

    def save_model(self, request, obj, form, change):
        # Covers approving one restaurant by ticking the box on its own edit
        # page, rather than the bulk action above - same notification either
        # way, since a manager waiting on a real business is not owed a
        # different experience depending on which admin UI path was used.
        newly_approved = change and "is_approved" in form.changed_data and obj.is_approved
        if newly_approved:
            self._approve(obj, approved_by=request.user, save=False)
        super().save_model(request, obj, form, change)

    def _approve(self, restaurant: Restaurant, *, approved_by, save: bool = True) -> None:
        restaurant.is_approved = True
        restaurant.approved_at = timezone.now()
        restaurant.approved_by = approved_by
        if save:
            restaurant.save(
                update_fields=[
                    "is_approved",
                    "approved_at",
                    "approved_by",
                    "updated_at",
                ]
            )
        self._notify_managers(restaurant)

    def _notify_managers(self, restaurant: Restaurant) -> None:
        # "Managers" plural: a restaurant_name registration makes exactly one
        # admin today, but nothing stops a second admin joining by invite
        # before approval lands, and every admin there should hear the news.
        from apps.common.roles import Role

        recipients = list(
            restaurant.staff.filter(role=Role.ADMIN, is_active=True).values_list("email", flat=True)
        )
        if not recipients:
            return
        send_mail(
            subject=f'"{restaurant.name}" is approved',
            message=(
                f"Good news - {restaurant.name} has been approved on Invisiko. "
                "You can sign in now and start setting up your team."
            ),
            from_email=None,  # uses DEFAULT_FROM_EMAIL
            recipient_list=recipients,
        )


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "number", "seats", "is_active")
    list_filter = ("restaurant", "is_active")
    search_fields = ("number",)
