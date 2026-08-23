# Architecture

## Shape

```
┌──────────────────────────┐
│  React Native app        │
│  (staff / manager)       │
└───────────┬──────────────┘
            │  HTTPS, JSON, JWT bearer token
            ▼
┌──────────────────────────┐
│  Django REST Framework   │
│  /api/v1/…               │
└───────────┬──────────────┘
            ▼
┌──────────────────────────┐
│  PostgreSQL              │
└──────────────────────────┘
```

## Backend

Domain apps under `backend/apps/`, one per bounded area:

| App | Owns |
| --- | --- |
| `users` | staff accounts, roles, JWT auth |
| `restaurants` | the site - the tenant everything hangs off |
| `equipment` | fridges, freezers, probes, and their safe ranges |
| `attendance` | barcode scan, check-in/out, the attendance log |
| `payroll` | pay periods, rate history, hours x rate |
| `compliance` | checklists, scheduled checks, results, corrective actions |
| `notifications` | alerting managers about missed and failed checks |
| `audit` | append-only trail, presented at an inspection |
| `common` | abstract models, roles, permissions, viewset bases, health check |

Each app is `models.py` (data) + `services.py` (logic) + `api/` (role-scoped
serializers and views) + `tests/`. Views stay thin - they validate and
delegate. Logic in a service function is reachable from a management command
or a background task; logic in a view is not.

## Roles

There are two: `ADMIN` and `STAFF`, defined once in
`backend/apps/common/roles.py` and mirrored in `mobile/src/types/roles.ts`.

`Role` is an **access level, not a job title**. Permissions, API namespaces and
the mobile navigator all branch on this one field, which is why it stays small.
If the business later needs "chef" or "cashier" for rotas or reporting, that is
a separate `job_title` field - overloading `role` would couple payroll data to
permission checks.

Admins are included in `STAFF_ROLES`, so an owner can use the floor screens
without a second account.

### How roles map to structure

The backend splits by **domain**, with role as a dimension inside each app:

```
apps/attendance/
├── models.py        one AttendanceLog model, one table
├── services/        business logic, no role knowledge
└── api/
    ├── common.py    shared serializer + queryset
    ├── staff.py     scan, and read your own history
    ├── admin.py     everyone's history, plus manual edits
    └── urls.py      one router per role
```

Roles are a *permission* concern, not a structural one. Splitting apps by role
instead would need two `AttendanceLog` models for one table, forcing one to
import the other - the domain would end up spread across three trees for no
gain. What actually differs is narrow: staff may scan and read their own rows,
admins may read everyone's and edit them.

Routes come out namespaced, assembled in `config/urls.py`:

```
/api/v1/auth/     role-agnostic - you have no role until you log in
/api/v1/staff/    scoped to the caller's own restaurant
/api/v1/admin/    management
```

The mobile app splits the other way, because its presentation genuinely
diverges - see [`mobile/src/roles/README.md`](../mobile/src/roles/README.md).

### Enforcement, in two layers

- **Namespace access** - `IsStaff` / `IsAdmin` reject the whole path with a 403.
- **Row scoping** - `RestaurantScopedQuerysetMixin` filters the queryset to the
  caller's restaurant. This has to be on the queryset: a permission class never
  sees a list view's rows, so tenancy enforced there would leak other
  restaurants on every list endpoint. A user with no restaurant gets an empty
  queryset, not everything.

The mobile role split is **not** a security boundary. Hiding a screen hides a
button, not an endpoint.

### Adding a third role

1. Add the value to `apps/common/roles.py` and the matching role tuple.
2. Add `api/<role>.py` to each domain app that needs it, plus a router.
3. Add the namespace to `config/urls.py`.
4. Add it to `mobile/src/types/roles.ts`, a `mobile/src/roles/<role>/` tree, a
   branch in `RootNavigator`, and a namespace in `endpoints.ts`.

No existing role's code changes.

Apps refer to each other's models by string (`"restaurants.Restaurant"`) rather
than importing, which keeps the dependency graph acyclic.

## Decisions worth knowing

**UUID primary keys** on anything the app references by id. Sequential integers
leak headcount, and a sequential id in a printed barcode is guessable, which
would let someone clock in a colleague.

**`ATOMIC_REQUESTS = True`.** Every request runs in a transaction. A check-in
with no matching log row, or a completed check with no corrective action
attached, is worse than a request that failed outright and can be retried.

**Deny by default.** DRF's default permission class is `IsAuthenticated`; public
endpoints opt out explicitly. The failure mode of the opposite default is a
forgotten decorator exposing payroll data.

**JWT, not sessions.** Mobile clients have no cookie jar worth relying on.
Access tokens are short-lived (30 min), refresh tokens rotate and the old one is
blacklisted on use, so a stolen refresh token is single-use.

**Tokens in the OS keychain.** AsyncStorage is plaintext on disk.

**Versioned URL prefix** (`/api/v1/`). Users do not update apps promptly; the
old client will be calling the old endpoints for months.

**Attendance is separate from payroll.** Time and money have different
lifecycles: the same hours get recosted when a rate changes retroactively, and
only one of the two is sensitive enough to restrict to admins.

**The audit trail is its own app, and append-only.** Compliance history is the
product's actual deliverable - it is what gets shown to an inspector. If it
lives as mutable rows inside the feature that writes it, "who edited this
after the fact" becomes unanswerable. Admin edits to attendance are recorded
there too, since a manually adjusted timesheet is exactly the thing an auditor
asks about.

**Compliance models split by lifecycle**, not into one flat module: what a
check *is* (template), what is *due today* (instance), what *happened*
(result), and the *corrective action*. Collapsing those into one model is the
mistake that makes "what was the rule last March" impossible to answer once a
checklist is edited.

## Mobile

Two axes, deliberately:

- `src/features/<domain>/` - the **data** layer: API calls, react-query hooks
  and domain types. Shared across roles.
- `src/roles/<role>/` - the **presentation** layer: screens and navigation.
  `common/` holds what every role sees.

Data access barely varies by role - the backend decides what a staff token may
see, so the client just calls a different path. Presentation varies a lot. One
axis for both would mean either duplicated hooks or screens that branch on role
internally.

`RootNavigator` is the only place that reads the role to decide what to mount.

Two kinds of state, kept apart:

- **Server state** - react-query. It handles caching, retries and invalidation.
- **Session state** - zustand (`src/store/authStore.ts`). Who is signed in.

Mirroring API responses into the store is how the two drift apart, so don't.

All HTTP goes through `src/api/client.ts`, which attaches the access token,
refreshes once on a 401 and replays the request. Concurrent 401s share a single
refresh call rather than each firing their own.

## Decisions still open

These are load-bearing and worth settling before the models are written.

**Offline capture.** A walk-in freezer has no signal, and a temperature check
taken there still has to be recorded at the time it happened. That means a
local queue and a sync step, and it changes the client's data layer
substantially. Retrofitting it is much harder than designing for it.

**Recorded-at vs synced-at.** Following from the above, every check and scan
needs the time the *event* happened, not the time the server heard about it.
An inspector cares about the former.

**Time zones and the business day.** `USE_TZ` is on and everything is stored
in UTC, but "has this person already checked in today" and "which day does a
23:50 closing check belong to" are business-day questions, not UTC-midnight
ones. A site's local day boundary needs to be explicit.

**Immutability boundary.** Which records can never be edited (audit entries),
which can be edited only with a reason recorded (attendance logs), and which
are freely editable (checklist templates).

**Barcode format.** What the barcode encodes matters: an opaque random token
is safer than the staff id, since a printed barcode is easy to photograph and
a guessable one lets someone clock in a colleague.

## Not built yet

- Background jobs (celery + redis) for scheduled task generation, missed
  check-out reconciliation and manager alerts
- Realtime dashboard updates (ASGI is wired up; websockets are not)
