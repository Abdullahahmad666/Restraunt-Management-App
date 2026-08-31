# Mobile - Restaurant Management App

**Expo SDK 57** (React Native 0.86.2) + TypeScript. Requires Node >= 22.11.
Talks to the Django API in [`../backend`](../backend).

Two audiences in one app: staff scan a barcode to clock in and work through
their daily food-safety checks; managers review who is on shift, what has been
checked, and what failed.

## Local setup

```bash
cd mobile
npm install
cp .env.example .env
npm start
```

Then install **Expo Go** on your phone and scan the QR code. No Android Studio,
no Xcode, no native build.

Point `EXPO_PUBLIC_API_BASE_URL` in `.env` at your machine's LAN address, not
`localhost` - on a phone that means the phone. See
[`../docs/mobile-native-setup.md`](../docs/mobile-native-setup.md).

> There is no `android/` or `ios/` folder and there should not be one in Git.
> `expo prebuild` generates them from `app.json` on demand, so committing them
> would let the two disagree - and the folder would win.
>
> `npm run android` / `npm run ios` work once you have the relevant native
> toolchain; until then, Expo Go covers everyday development.

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
- **Config through `src/config/env.ts`.** Only `EXPO_PUBLIC_*` variables reach
  the app, and Expo inlines them at build time - so they ship inside the bundle
  and are readable by anyone with the app. Never put a secret there. After
  editing `.env`, restart with `npx expo start --clear`.
- **Add packages with `npx expo install`, not `npm install`.** It picks the
  version matching the SDK; plain npm takes the newest, which is usually wrong
  for anything with native code.
- **Check the Expo SDK before adding a native dependency.** Anything outside it
  breaks Expo Go and forces everyone onto a development build. This is why token
  storage uses `expo-secure-store` rather than `react-native-keychain`.

## Not chosen yet

- **An offline queue.** Checks get taken in walk-in freezers with no signal.
  See "Decisions still open" in [`../docs/architecture.md`](../docs/architecture.md).

The barcode scanner uses `expo-camera` and `expo-location`, both in the SDK, so
they work in Expo Go and need no native linking. The venue check-in code is
rendered with `react-native-qrcode-svg` on top of `react-native-svg`.

`package.json` declares these but the versions were pinned by hand (this
environment had no Node.js to run `expo install`). Run this once after
pulling, before `npm start`, so Expo can correct them to the exact versions
SDK 57 expects:

```bash
npx expo install expo-camera expo-location react-native-svg
```

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run format
npm run doctor        # expo-doctor: version and config mismatches
```
