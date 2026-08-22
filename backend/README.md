# Backend - Restaurant Management API

Django 6 + Django REST Framework. Serves `/api/v1/` to the React Native client
in [`../mobile`](../mobile).

## Local setup

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate      # Windows (Git Bash); use .venv/bin/activate on macOS/Linux
pip install -r requirements/dev.txt
cp .env.example .env               # then edit DJANGO_SECRET_KEY and DATABASE_URL
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

Generate a secret key:

```bash
python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

## Layout

| Path | Purpose |
| --- | --- |
| `config/` | Project settings, root URLs, WSGI/ASGI entrypoints |
| `config/settings/` | `base` + `development` / `production` / `test` overrides |
| `apps/common/` | Abstract models, pagination, shared permissions, health check |
| `apps/users/` | Custom `User` model (email login, roles), JWT auth endpoints |
| `apps/restaurants/` | Restaurants, branches, tables, menus |
| `apps/orders/` | Order capture, line items, status transitions |
| `apps/inventory/` | Stock items, suppliers, stock movements |
| `apps/payments/` | Bills, payments, refunds |
| `requirements/` | `base` / `dev` / `prod` dependency sets |

Each domain app follows the same shape:

```
apps/<name>/
├── models.py        # data
├── services.py      # business logic - views call into here
├── admin.py
├── api/
│   ├── serializers.py
│   ├── views.py     # thin: validate, delegate to services, respond
│   └── urls.py      # mounted at /api/v1/<name>/
└── tests/
```

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
- **Migrations are committed.** CI fails if a model change has no migration.
