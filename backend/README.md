# Backend - Restaurant Management API

Django 6 + Django REST Framework. Serves `/api/v1/` to the React Native client
in [`../mobile`](../mobile).

Domain: staff time tracking and food-safety compliance. No customers, no
orders, no transactions.

## Local setup

Requires **Python 3.13+** and **Docker Desktop**.

### 1. Start the database

From the repo root, not `backend/`:

```bash
docker compose up -d db
docker compose ps          # wait until it says "healthy"
```

Postgres runs in Docker so everyone on the team - and CI, and production - uses
the same major version. The app itself still runs natively.

### 2. Set up the backend

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate      # Windows (Git Bash); .venv/bin/activate on macOS/Linux
pip install -r requirements/dev.txt
cp .env.example .env
```

Then put your own secret key in `.env`:

```bash
python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

`DATABASE_URL` in `.env.example` already matches `docker-compose.yml`, so if you
used Docker there is nothing else to change.

### 3. Create the tables and run

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

Check it worked: <http://localhost:8000/healthz/> should return
`{"status": "ok", "database": true}`.

### Every time you pull

```bash
git pull
pip install -r requirements/dev.txt   # if requirements changed
python manage.py migrate              # if anyone added a migration
```

`migrate` is safe to run whenever. Django records what it has already applied,
so running it twice does nothing the second time.

### Not using Docker?

Install Postgres 16 yourself, create the database once with
`createdb philly_compliance`, and edit `DATABASE_URL` in `.env` to match your
own user, password and port. Everything else is identical - but you are on your
own if a version difference bites.

## Layout

| Path | Purpose |
| --- | --- |
| `config/` | Project settings, root URLs, WSGI/ASGI entrypoints |
| `config/settings/` | `base` + `development` / `production` / `test` overrides |
| `apps/common/` | Abstract models, roles, permissions, viewset bases, health check |
| `apps/users/` | Staff accounts (email login, roles), JWT auth endpoints |
| `apps/restaurants/` | The site - the tenant everything else hangs off |
| `apps/equipment/` | Fridges, freezers, probes, and their safe ranges |
| `apps/attendance/` | Barcode scan, check-in/out, the attendance log |
| `apps/payroll/` | Pay periods, rate history, hours x rate |
| `apps/compliance/` | Checklists, scheduled checks, results, corrective actions |
| `apps/notifications/` | Alerting managers about missed and failed checks |
| `apps/audit/` | Append-only trail - the deliverable at an inspection |
| `requirements/` | `base` / `dev` / `prod` dependency sets |

Each domain app follows the same shape:

```
apps/<name>/
├── models.py        # data - one model per table, no role knowledge
├── services.py      # business logic - views call into here
├── admin.py
├── api/
│   ├── common.py    # serializers/querysets both roles share
│   ├── staff.py     # what a floor user may see and do
│   ├── admin.py     # what an owner or manager may see and do
│   └── urls.py      # one router per role
└── tests/
```

Routes are namespaced by role in `config/urls.py`:

```
/api/v1/auth/     role-agnostic
/api/v1/staff/    STAFF + ADMIN, scoped to the caller's restaurant
/api/v1/admin/    ADMIN only
```

`apps/restaurants/` is the worked example - copy its `api/` layout when
building out `orders`, `inventory` and `payments`.

## Commands

```bash
pytest                     # tests + coverage
ruff check .               # lint
ruff format .              # format
python manage.py makemigrations --check --dry-run   # CI runs this too
```

## API docs

With the server running: <http://localhost:8000/api/docs/> (Swagger UI) and
`/api/schema/` for the raw OpenAPI document.

## Conventions

- **Deny by default.** DRF's default permission is `IsAuthenticated`. Public
  endpoints opt out with an explicit `AllowAny`.
- **UUID primary keys** on anything the mobile app references by id, via
  `apps.common.models.BaseModel`.
- **`ATOMIC_REQUESTS = True`** - every request runs in a transaction.
- **Business logic in `services.py`**, not in views or serializers.
- **Roles are an access level**, not a job title - see `apps/common/roles.py`.
  Two exist (`ADMIN`, `STAFF`) and the list stays short on purpose.
- **Row scoping goes on the queryset**, not in a permission class. A permission
  class never sees a list view's rows.
- **Migrations are committed.** CI fails if a model change has no migration.
