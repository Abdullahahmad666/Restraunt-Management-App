# Restaurant Management System

A restaurant management platform: a React Native app for floor and kitchen
staff, backed by a Django REST API.

Single repository, two deployables:

```
restaurant-management/
├── mobile/     React Native + TypeScript client
├── backend/    Django 6 + Django REST Framework API
├── docs/       architecture, API and process documentation
└── .github/    CI workflows, issue and PR templates, CODEOWNERS
```

One repo because a single feature - "a waiter can create an order" - almost
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
