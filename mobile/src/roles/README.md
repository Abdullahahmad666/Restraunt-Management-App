# roles/

The **presentation** layer, organised by role. Data lives in
[`../features/`](../features), organised by domain.

```
roles/
├── common/     screens every role sees (login, profile, settings)
├── staff/      floor screens - orders, tables, stock
│   ├── navigation/StaffNavigator.tsx
│   └── screens/
└── admin/      management screens - dashboard, staff, reports
    ├── navigation/AdminNavigator.tsx
    └── screens/
```

## Adding a third role

1. Add it to `src/types/roles.ts` and to `backend/apps/common/roles.py`.
2. Create `roles/<role>/navigation/` and `roles/<role>/screens/`.
3. Add a branch in `src/navigation/RootNavigator.tsx`.
4. Add the namespace to `src/api/endpoints.ts`.

No existing role's folder needs to change.

## Rules

- **A screen belongs to exactly one role folder.** If two roles need the same
  screen, it goes in `common/`. If they need *almost* the same screen, extract
  the shared parts into `src/components/` and keep two thin screens - a screen
  that branches on role internally is the thing this structure exists to avoid.
- **Only `RootNavigator` reads the role to decide what to mount.** Screens below
  it can assume they are being shown to the right person.
- **This is not a security boundary.** Hiding a screen hides a button, not an
  endpoint. Access control is the backend's `/api/v1/staff/` and
  `/api/v1/admin/` namespaces; the client split is about not showing people
  controls they cannot use.
