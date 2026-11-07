# Going to production

What changes between running this on your desk and shipping it.

## Checklist

- [ ] `EXPO_PUBLIC_API_URL` points at your https backend
- [ ] Your own app name, icon and Android package
- [ ] Your own release signing key, backed up
- [ ] Tested on a real phone with two people
- [ ] Foreground service types declared in Play Console
- [ ] Report and block available wherever strangers meet

## Use https

The backend's address is built into the app at build time, so rebuild after changing it.

```bash
# .env
EXPO_PUBLIC_API_URL=https://api.example.com
```

```bash
npx expo prebuild --platform android --clean
```

**Why `--clean`:** the Android project is generated from your config. Android refuses plain `http://` in release builds, so for local testing
[`plugins/with-dev-cleartext.js`](../plugins/with-dev-cleartext.js) adds an exception for that one host. With an https address it adds nothing, and a
clean prebuild removes any old exception.

## Make it yours

In [`app.config.js`](../app.config.js), change `name`, `slug`, `android.package` and the icons. The package is your app's identity on Google Play, and it
cannot change after you publish.

## Sign with your own key

An Android release build needs a signing key. Generated projects sign release builds with a debug key that everyone shares, and Google Play refuses
that.

Create your key once:

```bash
mkdir -p credentials
keytool -genkeypair -v -storetype PKCS12 \
  -keystore credentials/release.jks -alias my-app \
  -keyalg RSA -keysize 4096 -validity 10000
```

Then create `credentials/release.properties`:

```properties
storeFile=release.jks
storePassword=your-password
keyAlias=my-app
keyPassword=your-password
```

[`plugins/with-release-signing.js`](../plugins/with-release-signing.js) wires this into every build. Without these files, builds fall back to the debug
key, so anyone can still clone and build this app.

**Why a plugin:** `android/` is generated, so anything edited by hand is lost at the next prebuild.

> [!CAUTION]
> Back up the `credentials` folder somewhere safe, and keep it out of git. An installed app only accepts updates signed with the same key. Lose the
> key, and your users must uninstall to update, unless you use Play App Signing.

## Build

```bash
cd android
./gradlew app:assembleRelease                                                 # every processor type
./gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a  # phones only, smaller
```

The APK is in `android/app/build/outputs/apk/release/`. For Google Play, use `./gradlew app:bundleRelease` to make an app bundle.

Check what you built:

```bash
apksigner verify --print-certs app-release.apk   # your key, not the debug key
zipalign -c -P 16 -v 4 app-release.apk           # Google Play requires 16 KB page support
```

## Keep calls alive in the background

The Expo plugin declares VoltKit's call service, which the provider starts and stops for you. A notification with a Leave button shows during a call.

What happens in the background:

| | Behaviour | Change it with |
| --- | --- | --- |
| Received video | Pauses at the server, using no data | |
| Sound | Keeps playing | |
| Your camera | Switches off, and comes back with the app | `background={{ pauseCamera: false }}`, which needs the plugin's `android.callServiceCamera` |
| Your microphone | Keeps sending | `background={{ pauseMic: true }}` |

Check that it is working with `useCallService()`: `declared` should be true, and `running` true during a call.

On Xiaomi, Redmi and POCO phones, battery savers can stop background apps beyond what Android does. The call service held on a POCO X3 Pro in testing. If calls
end in the background on such a phone, ask users to set the app's battery saver to No restrictions.

## Google Play

Because the app declares foreground service types, Play Console asks you to describe each one, under **Monitor and improve → App content**, with a short
video of a user starting the feature. The defaults here are `microphone` and `mediaPlayback`. See
[Google Play's declaration](https://voltkit.in/docs/react-native-sdk#google-plays-declaration).

## Costs

Rooms are billed per participant-minute, by the media used, from your VoltKit wallet. See [Usage and billing](https://voltkit.in/docs/usage-and-billing).

- Show `useWalletLow()` as a banner, as this app does, so a room does not end without warning.
- Your backend can check `getBalance()` before going live.
- Pick publish quality on purpose. See [Integrate VoltKit, step 7](integrate-into-your-app.md#7-publish).

## Safety

Open rooms with strangers need moderation from day one. This app includes age confirmation, report and block, moderator roles, and a limit that restricts an
account after several people report it. Reports are stored by the backend, but nothing here reviews them: for a real product, you need someone who does.
