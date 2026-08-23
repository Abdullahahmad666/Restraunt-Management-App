# Restaurant Management System

A staff time-tracking and food-safety compliance system for a food
business: a React Native app used by staff and managers, backed by a Django
REST API.

**It is not a point-of-sale.** There are no customers, no orders and no
transactions. The users are employees; the output is a defensible record of
who did what and when, suitable for presenting at a food hygiene inspection.

Two things it does:

1. **Staff time tracking** - each staff member has a unique barcode. Scanning
   it on a kiosk or their own phone checks them in or out. Hours accumulate
   into a pay period and are costed against an hourly rate.
2. **Daily food-safety compliance** - opening checks, fridge and freezer
   temperatures, cooking and hot-holding temperatures, cleaning, delivery and
   closing checks. A failed check cannot be closed until a corrective action
   is recorded. Everything is written to a permanent trail.

Single repository, two deployables:

```
restaurant-management/
├── mobile/     React Native + TypeScript client
├── backend/    Django 6 + Django REST Framework API
├── docs/       architecture, API and process documentation
└── .github/    CI workflows, issue and PR templates, CODEOWNERS
```

One repo because a single feature - "a staff member scans in" - almost
always touches both sides, and shipping both halves in one reviewable PR keeps
the API contract honest.

## Quick start

```bash
git clone <repo-url>
cd restaurant-management
```

**Backend** ([full instructions](backend/README.md)):

```bash
cd backend
python -m venv .venv && source .venv/Scripts/activate
pip install -r requirements/dev.txt
cp .env.example .env          # set DJANGO_SECRET_KEY and DATABASE_URL
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

**Mobile** ([full instructions](mobile/README.md)):

```bash
cd mobile
npm install
cp .env.example .env
npm start
npm run android               # in a second terminal
```

The Android emulator reaches your host machine at `10.0.2.2`, not `localhost` -
that is why `API_BASE_URL` defaults to `http://10.0.2.2:8000/api/v1`.

## API documentation

With the backend running: <http://localhost:8000/api/docs/>.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before your first PR. The short version:

- Nobody pushes to `main`. Ever.
- Branch from `main`, open a PR, get one approval, let CI pass, squash-merge.
- Branch names: `feature/<yourname>-<topic>`, `fix/...`, `chore/...`, `docs/...`.

## Team

| Area | Owner |
| --- | --- |
| Backend | _TBD_ |
| Mobile | _TBD_ |
| Repo / CI | _TBD_ |

Add each person as a collaborator with **Write** access, then uncomment
their line in [.github/CODEOWNERS](.github/CODEOWNERS) - in that order, or
GitHub flags the whole file.
