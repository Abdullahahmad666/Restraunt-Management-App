# Invisiko

**The back of house, on one phone.** Staff hours, food-safety records, payroll
and delivery invoices — for takeaways and small restaurants that currently run
all four on paper.

[![Backend CI](https://github.com/Abdullahahmad666/Restraunt-Management-App/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/Abdullahahmad666/Restraunt-Management-App/actions/workflows/backend-ci.yml)
[![Mobile CI](https://github.com/Abdullahahmad666/Restraunt-Management-App/actions/workflows/mobile-ci.yml/badge.svg)](https://github.com/Abdullahahmad666/Restraunt-Management-App/actions/workflows/mobile-ci.yml)

A React Native app for iOS and Android, backed by a Django REST API. Two
audiences, one install: a **manager** who sets the restaurant up and runs it,
and **staff** who check in, log the day's checks and see their own hours.

**It is not a point-of-sale.** No customers, no orders, no card payments. The
users are employees, and the output is a defensible record of who did what and
when — the sort of thing an environmental health officer asks to see.

---

## What it does

### Clock in without trusting anyone's memory

Each venue gets a QR code with a position and a radius attached to it. A staff
member scans it to check in and out, and the API checks where the phone
actually is before it writes anything:

> You are 340m from Phillyz, outside the 100m check-in radius.

Managers get a live view of who is on shift right now, a filterable history,
and the ability to correct a record — which is kept marked as a manual
override rather than quietly rewritten. Staff can attach their own note to any
of their check-ins ("car trouble, 10 min late"), which is theirs to write and
nobody else's to edit.

Shifts are planned on a weekly rota that shows the estimated staff cost as it
is built. A staff member who cannot make one offers it to a named colleague;
the swap only takes effect once a manager approves it.

### Food-safety records that survive an inspection

Opening and closing routines, each with its own checklist. Fridges and
freezers registered with a recommended maximum temperature, so a reading that
is out of range is obvious as it is typed rather than when somebody reviews it
later. Named checklists beyond the daily two — weekly, monthly, whatever the
restaurant runs — with their own tasks.

Every reading and every ticked task is stored with who recorded it and when,
and the history is filterable by date range and by routine.

### Payroll that matches how these businesses actually pay

Fortnightly pay periods, each covering two seven-day weeks. Every staff member
has two rates, and the first 20 hours of each week fall on rate 1 with the
remainder on rate 2 — the default split a manager can reallocate per person
per period before closing it.

Rate changes are append-only. A pay period that was calculated under an old
rate stays correct after the rate changes, because the history is a record
rather than a mutable field. Staff see a running estimate of the current
period and the finalised figure once their manager closes it; managers get a
cost report by month and by person.

### Delivery invoices, read by a model instead of a person

The feature that saves the most time, and the most involved thing in the repo:

```
 photo / gallery / PDF
          │
          ▼
  uploaded, stored in S3 ─────────────▶  invoice row, status PENDING
          │                                      │
          │                              job queued in Postgres
          ▼                                      ▼
   duplicate check ◀── file hash, and ──▶  background worker
   (before spending anything)                    │
                                          PDF pages rasterised
                                                 │
                                          vision model, strict JSON
                                                 │
                              supplier matched · warehouse resolved
                              line items matched to stock items
                                                 ▼
                                      review screen, then confirm
                                                 ▼
                                       stock movements applied
```

What that buys a manager: photograph the delivery note, check what was read,
tap confirm, and the stock levels, the supplier's prices and the month's spend
all move together. Credit notes are recognised and applied as returns rather
than deliveries. A ketchup bought under three different spellings across three
suppliers aggregates into one product's total through item aliases, so
"what have we spent on ketchup this quarter" has an answer.

The spending it can cause is bounded on purpose. Duplicates are detected by
file hash *and* by invoice number against the same supplier, and the check runs
**before** the model is called rather than after. There is a per-restaurant
monthly ceiling on reads, and a rate limit per account.

### Everything else

- **Push notifications** through Expo — shift reminders and schedule changes —
  with an in-app list of what was sent.
- **Punctuality analytics**: minutes late per check-in measured against the
  rota, per person and across the team, so persistent lateness stands out even
  when no single day looks bad.
- **Purchase analytics**: spend by supplier, by storage area, by week or by
  month, and per product across every confirmed invoice.
- **Invite codes** so a manager can onboard their team without an admin
  creating accounts by hand, with email verification and password reset.

---

## How it fits together

```
┌──────────────────────────┐
│  React Native (Expo)     │   TypeScript · React Query · JWT in SecureStore
│  iOS · Android           │
└───────────┬──────────────┘
            │ HTTPS, /api/v1
┌───────────▼──────────────┐        ┌──────────────────────────┐
│  Django + DRF            │───────▶│  PostgreSQL 16           │
│  gunicorn                │        │  also the job queue      │
└───────────┬──────────────┘        └───────────▲──────────────┘
            │                                   │ SELECT … FOR UPDATE
            │ presigned PUT/GET                 │ SKIP LOCKED
┌───────────▼──────────────┐        ┌───────────┴──────────────┐
│  Amazon S3               │◀───────│  worker: manage.py       │
│  invoices · photos       │        │  run_jobs                │
└──────────────────────────┘        └───────────┬──────────────┘
                                                │
                                     ┌──────────▼──────────┐
                                     │  OpenAI (vision)    │
                                     └─────────────────────┘
```

Decisions worth knowing before you read the code:

| Decision | Why |
| --- | --- |
| **No Redis, no Celery** | The job queue is a Postgres table claimed with `SELECT … FOR UPDATE SKIP LOCKED`. One fewer service to run, pay for and monitor, and jobs are transactional with the data they touch. Attempts, backoff and stale-job requeue are in `apps.jobs`. |
| **Scanning runs in a worker, not a request** | A vision model takes seconds. Held inside a request it occupies one of gunicorn's workers, and a handful of concurrent uploads stall the whole API. |
| **Files live in S3, behind signed URLs** | Reads are short-lived signed URLs rather than public objects: an invoice shows a supplier's pricing, and a profile photo is personal. The API also offers a presigned direct upload, so a 15MB PDF need not pass through a gunicorn worker — the app still posts multipart today and the direct path is waiting on the client. |
| **Production refuses to boot without a bucket** | Otherwise uploads land on a container filesystem that the next deploy throws away, leaving healthy database rows pointing at files that no longer exist. |
| **`ATOMIC_REQUESTS` is on** | Every request is one transaction. S3 is the exception that has to be handled by hand, since a rollback cannot un-upload a file. |
| **Roles are enforced server-side** | The app hides what a role cannot do; the API refuses it. Staff cannot self-register without an invite code, because an admin here can edit the attendance records that decide what people are paid. |

---

## Stack

| | |
| --- | --- |
| **Mobile** | React Native 0.86 · Expo SDK 57 · TypeScript · React Navigation · TanStack Query v5 · Expo Camera / Image Picker / Notifications |
| **API** | Django 6.1 · Django REST Framework 3.18 · SimpleJWT · drf-spectacular · django-filter |
| **Data** | PostgreSQL 16 · psycopg 3 |
| **Files** | Amazon S3 via django-storages, private objects behind signed URLs |
| **AI** | OpenAI vision with a strict JSON schema · pypdfium2 for rasterising PDFs |
| **Infra** | Docker · Render (API + worker) · Neon or any Postgres 16 · EAS Build |
| **CI** | GitHub Actions — backend tests, mobile typecheck/lint/tests, deploy checks, branch protection |

---

## Repository

```
.
├── mobile/      React Native client     → mobile/README.md
├── backend/     Django REST API         → backend/README.md
├── docs/        architecture, API conventions, workflow, invoice OCR
├── .github/     CI workflows, templates, CODEOWNERS
├── render.yaml  Render blueprint: API + background worker
└── docker-compose.yml   Postgres for local development
```

One repository, because a single feature — "a staff member scans in" — touches
both halves, and shipping both in one reviewable PR is what keeps the API
contract honest.

Inside `backend/apps/`, each Django app owns one domain: `users`,
`restaurants`, `attendance`, `compliance`, `payroll`, `inventory`,
`notifications`, `jobs`. Inside `mobile/src/roles/`, screens are grouped by who
sees them: `admin/`, `staff/`, `common/`.

---

## Running it locally

Needs Python 3.13+, Node 20+, and Docker Desktop.

```bash
# 1. Postgres
docker compose up -d db

# 2. API
cd backend
python -m venv .venv && source .venv/Scripts/activate   # .venv/bin/activate on macOS/Linux
pip install -r requirements/dev.txt
cp .env.example .env            # set DJANGO_SECRET_KEY
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000

# 3. Background worker, in a second terminal
python manage.py run_jobs

# 4. The app, in a third
cd mobile
npm install
cp .env.example .env
npx expo start --dev-client
```

Browsable API documentation, generated from the code:
<http://localhost:8000/api/docs/>.

Full instructions, including what to put in `.env` and how to point a real
phone at your machine, are in [`backend/README.md`](backend/README.md) and
[`mobile/README.md`](mobile/README.md).

Invoice scanning additionally needs an S3 bucket and an OpenAI key. Without
them the app still works — uploads just fail with a message rather than
populating line items. `python manage.py check_scanning` makes one real call
and tells you exactly which part is not configured.

---

## Tests

```bash
cd backend && pytest        # 360 tests
cd mobile  && npm test      # 44 tests, plus npm run lint and npm run typecheck
```

Both suites run on every pull request, along with Django's deployment checks
and a guard that stops anything but `stage` merging into `main`.

The backend suite never touches the real S3 bucket — test settings force local
file storage, deliberately, so a test run cannot write to production storage.

---

## Deploying

**API and worker** — `render.yaml` is a Render blueprint that creates both
services from one Docker image, sharing an environment group so the web
service and the worker cannot drift apart. The database is external (Neon's
free tier works well). See the "Deploying" section of
[`backend/README.md`](backend/README.md).

**App** — EAS Build produces an installable Android `.apk` or a TestFlight
build:

```bash
cd mobile
npx eas-cli build --platform android --profile preview
```

---

## Status

Shipped and in use: attendance, rota and swaps, compliance records, payroll,
inventory and invoice scanning, notifications, analytics.

Known gaps, stated plainly:

- **Equipment** is a placeholder screen with no backend behind it, and nothing
  currently navigates to it.
- **Corrective actions** — a failed check that must be fixed before the
  checklist can close — are designed but not built. `apps.compliance` has the
  space reserved for them and says so.
- **Offline capture** is not implemented. The app needs a connection to record
  anything.
- **The audit app** is scaffolding: the appending-only inspection trail it
  describes has no models yet.

---

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. The short version:

- Nobody pushes to `stage` or `main`.
- Branch from `stage`, open a PR into `stage`, one approval, CI green,
  squash-merge.
- `main` only ever receives a PR from `stage`.
- Branch names: `feature/<name>-<topic>`, `fix/…`, `chore/…`, `docs/…`.

Further reading in [`docs/`](docs/): [architecture](docs/architecture.md),
[API conventions](docs/api-conventions.md),
[the invoice pipeline](docs/invoice-ocr.md),
[the GitHub workflow](docs/github-workflow.md), and
[native setup](docs/mobile-native-setup.md).
