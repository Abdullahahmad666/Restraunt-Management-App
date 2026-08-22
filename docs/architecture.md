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

Each app is `models.py` (data) + `services.py` (logic) + `api/` (serializers,
views, urls) + `tests/`. Views stay thin - they validate and delegate. Logic
in a service function is reachable from a management command or a background
task; logic in a view is not.

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

Feature-first: `src/features/orders/` holds the orders screens, their hooks and
their API calls. Shared code moves up to `src/components/` or `src/hooks/` only
once a second feature actually needs it.

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
