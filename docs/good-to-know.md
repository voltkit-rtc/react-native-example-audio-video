# Good to know

Things that are easy to get wrong, found while building this app. Look here first when something does not work.

## SDK behaviour

### There is no `client.identity`

The Kotlin examples in VoltKit's guides use `client.identity`. On the JavaScript and React Native clients it does not exist, so
`e.identity === client.identity` is quietly false. Use your own user id, or `client.info?.identity`.

### `connect()` takes no metadata

The Kotlin guides pass a name to `connect()`. In JavaScript and React Native, call `client.setMetadata()` after joining. So `participantJoined` arrives with
no name: wait for `participantUpdated` before showing "Asha joined". See [`chat.tsx`](../src/components/room/chat.tsx).

### Import values from the client package

`RpcError`, `ChatClient` and `isTerminalError` come from `@voltkit-rtc/client`. Hooks and components come from `@voltkit-rtc/react-native`.

### A closed session stays closed

After `onClosed`, the client is finished. Mount a new provider, with a new `key` and a fresh token.

### Do not end a call on `onError`

It also carries warnings that change nothing, such as `frame-rate-fallback`. Use `onClosed` to learn that a session ended.

### A demotion does not free the seat

After `promote(id, 'viewer')` the seat stays held. Release it as well, or an empty card stays behind.

### A released microphone stays off

`forceMute(id, 'audio', false)` allows the owner to switch it on. It does not switch it on for them.

### There is no in-app music on React Native

`publishMusic` needs a browser, and rejects with `music-unavailable` here. Leave it out of the app.

### Use `VideoTrack`, not `RTCView`

`VideoTrack` manages the native stream for you. Wrapping tracks in your own `MediaStream` can crash the app when a call ends.

## Android

### Text fields hide behind the keyboard

Edge-to-edge apps do not resize for the keyboard, and React Native's keyboard height leaves out the navigation bar. On a phone with three-button navigation,
your input ends up behind the keyboard. [`keyboard.ts`](../src/lib/keyboard.ts) adds the bottom inset, and also reads the keyboard's state when a screen
opens with it already up.

### Keep what people typed when the keyboard closes

If a composer sits above the keyboard and the keyboard closes, the text vanishes with it. [`RoomScreen`](../src/screens/RoomScreen.tsx) closes the composer and
keeps the draft in the chat pill.

### Back should not end a live room

A stray press should not end someone's live. [`RoomScreen`](../src/screens/RoomScreen.tsx) asks first, and uses `useFocusEffect` so the guard only applies
while the room is the screen in front.

### Keep the screen on

Use `useKeepAwake()` from `expo-keep-awake` in rooms and calls.

## The emulator

- Its microphone is silent, so test sound on a phone.
- Its cameras are simulated: expect a test pattern.
- It has only a loudspeaker, so test the earpiece and Bluetooth on a phone.
- From the emulator, your computer is `10.0.2.2`, not `localhost`.

## Symptoms

| You see | Likely cause | Fix |
| --- | --- | --- |
| `needs a development build` | Running in Expo Go, or not rebuilt after installing | `npx expo run:android` |
| `UnsupportedError: device not supported` | The client loaded before the SDK | Import `@voltkit-rtc/react-native` first in your entry file |
| The call drops about 6 seconds after leaving the app | The call service is not running | Check `useCallService()`, and keep the plugin's `android.callService` on |
| `CLEARTEXT communication not permitted` | An `http://` backend in a release build | Use https, or run `npx expo prebuild --clean` so the local exception is added |
| The app shows "Could not reach the server" | The wrong address in `.env`, or the backend is off | Check `EXPO_PUBLIC_API_URL`, then rebuild |
| A plugin option has no effect | The Android project is out of date | `npx expo prebuild --clean` |
| `forbidden` on `publish()` | The role is not host or cohost yet | Publish after `roleChanged` |
| `source-already-published` | A second `publish()` while on air | Safe to ignore, or check `local.publishing` first |
| 1v1 never connects on a server | The proxy does not pass WebSockets | See the [backend's deployment guide](https://github.com/voltkit-rtc/voltkit-rtc-backend-demo/blob/main/docs/deployment.md) |
| `Duplicate class org.webrtc...` | Another SDK bundles WebRTC | Remove it |

## Getting help

- [Troubleshooting](https://voltkit.in/docs/troubleshooting) and [every error code](https://voltkit.in/docs/errors)
- [Support](https://voltkit.in/docs/support), including the diagnostics snapshot from `client.getDiagnostics()`
