# Generating the native projects

This scaffold contains `mobile/src` and the JS tooling, but not the `android/`
and `ios/` native projects - those are thousands of generated files and are
better produced by the official template than hand-written.

Do this once, then commit the result.

```bash
# 1. Generate a throwaway RN project with the SAME name as mobile/app.json
cd /tmp
npx @react-native-community/cli@latest init RestaurantManagement --version 0.87.0 --skip-install

# 2. Copy the native folders into the repo
cp -r RestaurantManagement/android "d:/Work/Restraunt Management System App/mobile/"
cp -r RestaurantManagement/ios     "d:/Work/Restraunt Management System App/mobile/"

# 3. Install and verify
cd "d:/Work/Restraunt Management System App/mobile"
npm install
npm start            # then, in another terminal:
npm run android
```

The project name must match `"name"` in [`../mobile/app.json`](../mobile/app.json)
(`RestaurantManagement`), or the native `AppRegistry` lookup fails at launch
with a blank screen.

## iOS

```bash
cd mobile/ios
bundle install
bundle exec pod install
```

`Pods/` is gitignored; `Podfile.lock` is committed.

## Android release signing

Generate a keystore, keep it **out** of the repo, and put its credentials in
`android/gradle.properties` on the release machine or in GitHub secrets. The
`.gitignore` already excludes `*.keystore` (except the standard `debug.keystore`)
and `local.properties`.

## Do this before anyone starts feature work

Native project generation touches every file under `android/` and `ios/`. Landing
it while three feature branches are open produces conflicts nobody enjoys. Make
it the first PR.
