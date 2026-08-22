# features/

The **data** layer, organised by domain and shared across roles: API calls,
react-query hooks and domain types.

Presentation lives in [`../roles/`](../roles), organised by role.

## Why the two axes are split

Data access barely varies by role - the backend already decides what a staff
token may see, so the client just calls a different path. Presentation varies a
lot: an admin sees revenue and staff management, a waiter sees tables and open
tickets.

Organising both by role would mean two copies of the same order-fetching hook.
Organising both by domain would mean every screen branching on role internally.
Splitting the axes avoids both.

```
features/orders/         roles/staff/screens/OrdersScreen.tsx
├── api.ts        <────── calls
├── hooks.ts      <────── uses
└── types.ts              roles/admin/screens/DashboardScreen.tsx
                   <────── also uses
```

## Shape of a feature

```
features/<domain>/
├── api.ts       # thin wrappers over apiClient, one per endpoint
├── hooks.ts     # useQuery / useMutation wrappers
└── types.ts     # request/response shapes if they outgrow src/types/api.ts
```

A hook that only one role will ever call still belongs here - the split is by
what the code *is*, not by who happens to use it today.
