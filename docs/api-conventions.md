# API conventions

Base URL: `/api/v1/`. Schema: `/api/schema/`. Docs: `/api/docs/`.

## URLs

- Plural, lowercase, hyphenated nouns: `/api/v1/orders/`, `/api/v1/stock-items/`
- Trailing slash always (Django default)
- Nest one level at most: `/api/v1/orders/{id}/items/`. Deeper than that, make
  it a top-level resource with a filter.
- Actions that are not CRUD become a sub-path:
  `POST /api/v1/orders/{id}/cancel/`

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
  float - `0.1 + 0.2` is not `0.3` and a bill is not the place to find out.
- Ids are UUID strings.

## Authentication

```
POST /api/v1/auth/login/     {email, password} -> {access, refresh}
POST /api/v1/auth/refresh/   {refresh}         -> {access, refresh}
POST /api/v1/auth/logout/    {refresh}         -> 200, refresh blacklisted
GET  /api/v1/auth/me/        Bearer <access>   -> current user
```

Send `Authorization: Bearer <access>` on everything else.

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
