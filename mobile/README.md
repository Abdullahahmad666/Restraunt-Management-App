# Mobile - Restaurant Management App

React Native 0.87 + TypeScript. Requires Node >= 22.11. Talks to the Django API in
[`../backend`](../backend).

## Local setup

```bash
cd mobile
npm install
cp .env.example .env
npm start              # Metro bundler
npm run android        # or: npm run ios
```

iOS additionally needs `cd ios && pod install` once after `npm install`.

> The `android/` and `ios/` native projects are not in this scaffold. Generate
> them once with `npx @react-native-community/cli init` into a temp directory
> and copy them in, then commit them - see `../docs/mobile-native-setup.md`.
>
> Until that is done `npm run android` / `npm run ios` will not work, but
> `npm run lint`, `npm run typecheck` and `npm test` all do.

## Layout

| Path | Purpose |
| --- | --- |
| `src/api/` | axios instance, auth interceptor, keychain token storage, endpoint map |
| `src/config/` | environment access - the only place that reads `@env` |
| `src/features/<domain>/` | **data** layer: API calls, hooks, types - shared across roles |
| `src/roles/<role>/` | **presentation** layer: screens and navigation per role |
| `src/navigation/` | root and auth navigators, typed route params |
| `src/store/` | zustand stores - session state only |
| `src/components/` | shared presentational components |
| `src/theme/` | colors, spacing, radii |
| `src/types/` | shared TypeScript types, including API response shapes |

## Conventions

- **Two axes: data by domain, presentation by role.** `features/` holds API
  calls and hooks; `roles/` holds screens and navigation. See
  [`src/roles/README.md`](src/roles/README.md) and
  [`src/features/README.md`](src/features/README.md).
- **`RootNavigator` is the only place that forks on role.** Screens below it
  can assume they are being shown to the right person.
- **The role split is not a security boundary.** Hiding a screen hides a
  button, not an endpoint - the backend's `/staff/` and `/admin/` namespaces
  do the enforcing.
- **Server state in react-query, session state in zustand.** Do not mirror API
  responses into the store.
- **Tokens in the keychain**, never AsyncStorage - see `src/api/tokenStorage.ts`.
- **No raw `fetch`/`axios` in screens.** Go through `src/api/client.ts` so auth
  refresh and timeouts apply.
- **`strict: true`.** No `any` in reviewed code.
- **Config through `src/config/env.ts`.** `.env` values are inlined at build
  time by react-native-dotenv, so after editing `.env` restart Metro with
  `npm start -- --reset-cache`.

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run format
```
