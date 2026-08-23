# API conventions

Base URL: `/api/v1/`. Schema: `/api/schema/`. Docs: `/api/docs/`.

## Role namespaces

Every resource sits under a role namespace:

| Prefix | Who | Scope |
| --- | --- | --- |
| `/api/v1/auth/` | anyone | login happens before a role exists |
| `/api/v1/staff/` | STAFF + ADMIN | the caller's own restaurant only |
| `/api/v1/admin/` | ADMIN | management; not restaurant-scoped |

The same resource appears under both prefixes with a different serializer, not
a different model. `/api/v1/staff/restaurants/` is read-only and returns one
row; `/api/v1/admin/restaurants/` is full CRUD and exposes `timezone` and
`is_active`.

Wrong namespace is a `403`, not a `404` - the path exists, the role does not
qualify.

## URLs

- Plural, lowercase, hyphenated nouns: `/api/v1/staff/attendance/logs/`,
  `/api/v1/admin/compliance/templates/`
- Trailing slash always (Django default)
- Nest one level at most: `/api/v1/orders/{id}/items/`. Deeper than that, make
  it a top-level resource with a filter.
- Actions that are not CRUD become a sub-path:
  `POST /api/v1/staff/compliance/tasks/{id}/complete/`
- One endpoint may cover both directions of a toggle where the server, not the
  client, decides which it is. `POST /api/v1/staff/attendance/scan/` checks in
  or out depending on whether an open check-in exists; a client that guessed
  would race with itself on a double scan.

## Methods and status codes

| Action | Method | Success |
| --- | --- | --- |
| List | `GET` | `200` |
| Retrieve | `GET` | `200` |
| Create | `POST` | `201` |
| Full update | `PUT` | `200` |
| Partial update | `PATCH` | `200` |
| Delete | `DELETE` | `204` |

Errors: `400` validation, `401` no/expired token, `403` authenticated but not
allowed, `404` missing (also used instead of `403` when the existence of the
object is itself private), `429` throttled.

## Responses

Lists are paginated:

```json
{
  "count": 42,
  "next": "http://api/v1/orders/?page=2",
  "previous": null,
  "results": [...]
}
```

`?page=2&page_size=50` - `page_size` caps at 100.

Errors use DRF's default shape:

```json
{"email": ["This field is required."], "detail": "Not found."}
```

## Fields

- `snake_case` keys - the mobile `types/api.ts` mirrors them exactly rather than
  converting, so there is one name per field across the stack.
- Timestamps are ISO 8601 UTC: `2026-03-14T09:30:00Z`.
- Money as a decimal **string** (`"1250.00"`) plus a `currency` code. Never a
  float - `0.1 + 0.2` is not `0.3` and someone's wages are not the place to
  find out. The same applies to temperatures, which are compared against legal
  thresholds.
- Every event carries the time it **happened**, not the time it was received.
  A check recorded offline and synced an hour later is evidence about the
  earlier moment.
- Ids are UUID strings.

## Authentication

```
POST /api/v1/auth/login/     {email, password} -> {access, refresh}
POST /api/v1/auth/refresh/   {refresh}         -> {access, refresh}
POST /api/v1/auth/logout/    {refresh}         -> 200, refresh blacklisted
GET  /api/v1/auth/me/        Bearer <access>   -> current user
```

Send `Authorization: Bearer <access>` on everything else.

`GET /api/v1/auth/me/` returns `role`, which the mobile client uses to pick its
navigator. Never trust a client-side role check for access: the namespaces do
the enforcing.

## Changing the API

Additive changes (a new optional field, a new endpoint) go straight in.

Breaking changes - removing a field, renaming one, changing a type, making an
optional field required - need a deprecation window, because installed apps do
not update on your schedule:

1. Ship the new field alongside the old one.
2. Update the mobile client.
3. Remove the old field only once the old app version is out of circulation.

Any API change updates `mobile/src/api/endpoints.ts` and
`mobile/src/types/api.ts` **in the same PR**.
