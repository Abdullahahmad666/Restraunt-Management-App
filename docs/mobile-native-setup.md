# Running the mobile app

The app is an **Expo** project (SDK 57). There is no committed `android/` or
`ios/` folder, and for most work you do not need one.

## The fast path: Expo Go

No Android Studio, no Xcode, no native build.

```bash
cd mobile
npm install
cp .env.example .env
npm start
```

Install **Expo Go** from the App Store or Play Store, then scan the QR code that
appears in the terminal. The app loads on your phone.

Point `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env` at your machine's LAN address
(not `localhost`, which on a phone means the phone itself):

```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:8000/api/v1
```

Find your address with `ipconfig` on Windows or `ifconfig | grep inet` on
macOS/Linux, and start Django with `runserver 0.0.0.0:8000` so it accepts
connections from the network. Add that address to `ALLOWED_HOSTS` in
`backend/.env`.

After editing `.env`, restart with `npx expo start --clear` - Expo inlines those
values at build time, so a plain reload will not pick them up.

## When Expo Go is not enough

Expo Go only contains the modules that ship with the Expo SDK. The moment we add
a library with native code that is not in the SDK, Expo Go can no longer run the
app and everyone needs a **development build** instead:

```bash
npx expo install expo-dev-client
npx expo run:android      # needs Android Studio + a JDK
npx expo run:ios          # needs Xcode, macOS only
```

`expo run:*` generates the native project on the fly. You still do not commit
it, and it is regenerated whenever the config changes.

This is why `expo-secure-store` is used for token storage rather than
`react-native-keychain`: the latter is not in the SDK, so it would have forced a
development build before anyone could open the app.

Before adding any native dependency, check whether the SDK already covers it -
`expo-camera` for the barcode scanner, for example.

## Generating the native projects

Only needed if you have to edit native code directly, or to inspect what Expo
produces:

```bash
npx expo prebuild            # writes android/ and ios/
npx expo prebuild --clean    # throw them away and regenerate
```

**Keep the output uncommitted.** It is generated from `app.json`, so committing
it means the two can disagree and the folder wins - which is exactly the problem
prebuild exists to avoid. Change native configuration through `app.json` and
config plugins instead.

## Builds for other people

EAS builds in the cloud, so nobody needs a Mac to produce an iOS build:

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
eas build --profile production --platform all
```

The project is already registered - `extra.eas.projectId` in
[`../mobile/app.json`](../mobile/app.json).

## Useful

```bash
npx expo start --clear      # restart with the Metro cache cleared
npx expo-doctor             # check for version and config mismatches
npx expo install --fix      # realign every package to the current SDK
```

**Always add packages with `npx expo install`, not `npm install`.** It picks the
version that matches the SDK. Plain `npm install` takes the newest, which is
frequently wrong for anything with native code.

## Why Expo

- The app runs on a real phone today, with no native toolchain installed.
- `expo-camera` gives us barcode scanning without hand-linking a camera library,
  which is the core interaction of the check-in feature.
- EAS Build removes the need for a Mac in the loop for iOS.
- `expo install` keeps the whole native surface on one coherent version set. The
  first thing that went wrong on this project was a react-native/babel-preset
  version mismatch; this makes that class of problem much harder to create.

The trade is that native configuration goes through `app.json` and config
plugins rather than direct edits to Gradle and Xcode files. Nothing in this app
looks likely to need an escape hatch, and `expo prebuild` is available if it
ever does.
