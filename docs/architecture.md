# Architecture

## Shape

```
┌──────────────────────────┐
│  React Native app        │
│  (waiter / chef / owner) │
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
| `users` | accounts, roles, JWT auth |
| `restaurants` | restaurants, branches, tables, menus |
| `orders` | orders, line items, status transitions |
| `inventory` | stock items, suppliers, movements |
| `payments` | bills, payments, refunds |
| `common` | abstract models, pagination, shared permissions, health check |

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
apps/orders/
├── models.py        one Order model, one table
├── services.py      business logic, no role knowledge
└── api/
    ├── common.py    shared serializer + queryset
    ├── staff.py     what a floor user may see and do
    ├── admin.py     what an owner or manager may see and do
    └── urls.py      one router per role
```

Roles are a *permission* concern, not a structural one. Splitting apps by role
instead would need two `Order` models for one table, forcing one to import the
other - the domain would end up spread across three trees for no gain.

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
leak volume - order `#1041` tells a competitor how many orders you have taken.

**`ATOMIC_REQUESTS = True`.** Every request runs in a transaction. A half-written
order is worse than a failed one.

**Deny by default.** DRF's default permission class is `IsAuthenticated`; public
endpoints opt out explicitly. The failure mode of the opposite default is a
forgotten decorator exposing payroll data.

**JWT, not sessions.** Mobile clients have no cookie jar worth relying on.
Access tokens are short-lived (30 min), refresh tokens rotate and the old one is
blacklisted on use, so a stolen refresh token is single-use.

**Tokens in the OS keychain.** AsyncStorage is plaintext on disk.

**Versioned URL prefix** (`/api/v1/`). Users do not update apps promptly; the
old client will be calling the old endpoints for months.

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

## Not built yet

- Realtime order updates (ASGI is wired up; websockets are not)
- Background jobs (celery + redis) for reports and stock alerts
- Offline order capture and sync
