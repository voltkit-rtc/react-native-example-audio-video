# Integrate VoltKit into your app

From an empty Expo app to a working live room, one step at a time. Each step says what to do and why. Every example comes from this app,
cut down to the part you need.

You will need a VoltKit project and a backend that can mint tokens. The
[backend guide](https://github.com/voltkit-rtc/voltkit-rtc-backend-demo/blob/main/docs/voltkit-server-sdk.md) covers that side.

## 1. Install

```bash
npx expo install @voltkit-rtc/react-native @voltkit-rtc/react @voltkit-rtc/client react-native-webrtc expo-dev-client expo-build-properties
```

| Requirement | Value |
| --- | --- |
| Expo | SDK 58 or newer, in a development build. Expo Go cannot load the native code |
| React Native | 0.82 or newer, New Architecture |
| React | 19.1 or newer |
| Android | minSdk 24 |

**Why three VoltKit packages:** `client` is the engine, `react` adds hooks, and `react-native` adds what a phone needs. Install all of them
beside each other so the app shares one copy of each.

> [!WARNING]
> Use one WebRTC in your app. Do not add a fork of `react-native-webrtc` or another calling SDK: two copies clash on native symbols.

## 2. Configure the Expo plugin

In `app.config.js`:

```js
module.exports = {
  expo: {
    android: {
      package: 'com.example.myapp',
      // Expo adds these to every app. A live app needs none of them.
      blockedPermissions: [
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
    },
    plugins: [
      [
        '@voltkit-rtc/react-native',
        {
          cameraPermission: 'Your camera is shown live to the people in your room or call.',
          microphonePermission: 'Your microphone is heard live by the people in your room or call.',
        },
      ],
      ['expo-build-properties', { android: { minSdkVersion: 24 } }],
    ],
  },
};
```

**Why:** the plugin writes the Android permissions and the call service for you. The call service is what keeps a call alive when someone leaves
the app: without it, Android cuts the connection about 6 seconds after the app goes to the background.

Then build:

```bash
npx expo run:android
```

Build again whenever native code changes, that is after installing or upgrading the SDK or changing plugin options. Run
`npx expo prebuild --clean` first when you change plugin options.

## 3. Load the SDK first

In your entry file, before anything else:

```ts
import '@voltkit-rtc/react-native';
```

**Why:** this import registers `react-native-webrtc`'s globals, which the client needs. Anything that loads the client before it fails with
`UnsupportedError: device not supported`. See [`index.ts`](../index.ts).

## 4. Get a token from your backend

```ts
export interface Credentials {
  token: string;
  wsUrl: string;
  role: 'host' | 'cohost' | 'moderator' | 'viewer';
}

export async function joinRoom(roomId: string, sessionToken: string): Promise<Credentials> {
  const res = await fetch(`https://api.example.com/v1/rooms/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` }, // your app's own sign-in
  });
  if (!res.ok) throw new Error(`Could not join (${res.status})`);
  const { credentials } = (await res.json()) as { credentials: Credentials };
  return credentials;
}
```

**Why ask right before joining:** tokens last ten minutes, and only the connection handshake needs one to be valid. Once connected, VoltKit
refreshes the session's token itself, so a call can run for hours.

## 5. Ask before going on air

Viewers need no permissions, so ask only when someone is about to publish.

```tsx
import { requestMediaPermissions } from '@voltkit-rtc/react-native';
import { Linking } from 'react-native';

export async function askForMedia(video: boolean): Promise<boolean> {
  const kinds = video ? (['camera', 'microphone'] as const) : (['microphone'] as const);
  const statuses = await requestMediaPermissions([...kinds]);
  await requestMediaPermissions(['notifications']); // shows the call's notification; the call works without it

  const refused = kinds.filter((kind) => statuses[kind] !== 'granted');
  if (refused.some((kind) => statuses[kind] === 'blocked')) void Linking.openSettings();
  return refused.length === 0;
}
```

`requestMediaPermissions` never rejects. Each status is `granted`, `denied` (the dialog may still show) or `blocked` (only Settings can grant it).

**Why not ask at launch:** a request people understand gets accepted. This app also shows its own explanation first, once, so people know they
are about to be live. See [`consent.tsx`](../src/rtc/consent.tsx).

## 6. Mount the provider

`VoltkitProvider` makes the client, connects it, and closes it when it unmounts.

```tsx
import { VoltkitProvider, type ClosedReason } from '@voltkit-rtc/react-native';
import { useState, type ReactNode } from 'react';

const ENDED: Record<ClosedReason, string> = {
  left: 'You left the room.',
  kicked: 'You were removed from this room.',
  'room-closed': 'This room has ended.',
  replaced: 'You joined this room from another device.',
  'gave-up': 'The connection was lost.',
};

export function LiveSession(props: { wsUrl: string; token: string; onEnded: (text: string) => void; children: ReactNode }) {
  const [attempt] = useState(0); // add 1 to rejoin: a new key makes a new client
  return (
    <VoltkitProvider
      key={attempt}
      wsUrl={props.wsUrl}
      token={props.token}
      callService={{ title: 'Friday night live', text: 'Tap to return to the room', leaveLabel: 'Leave' }}
      onError={(err) => console.warn('[voltkit]', err.message)}
      onClosed={(reason) => props.onEnded(ENDED[reason])}
    >
      {props.children}
    </VoltkitProvider>
  );
}
```

**Why `key`:** a closed session stays closed, so rejoining needs a new client. **Why log `onError`:** it also carries warnings that change
nothing, such as a frame rate that fell back. Do not end a call on them.

The provider tries to connect once. If that fails, `useRoom().state` goes back to `idle` with `error` set, so watch for it:

```tsx
import { useRoom } from '@voltkit-rtc/react-native';
import { useEffect } from 'react';

export function ConnectionWatch({ onFailed }: { onFailed: (err: Error) => void }) {
  const { state, error } = useRoom();
  useEffect(() => {
    if (state === 'idle' && error) onFailed(error);
  }, [state, error, onFailed]);
  return null;
}
```

## 7. Publish

Only hosts and co-hosts can publish. Wait until the session is connected, then publish once.

```tsx
import { useLocalMedia, useRoom } from '@voltkit-rtc/react-native';
import { useEffect, useRef } from 'react';

export function useGoLive(video: boolean) {
  const { state, info } = useRoom();
  const local = useLocalMedia();
  const started = useRef(false);

  useEffect(() => {
    const canPublish = info?.role === 'host' || info?.role === 'cohost';
    if (state !== 'connected' || !canPublish || started.current) return;
    started.current = true;
    local.publish(video ? { quality: '720p' } : { video: false }).catch((err) => console.warn(err));
  }, [state, info?.role, local, video]);
}
```

**Why pass a quality:** with no options `publish()` sends the highest your project allows, 1080p by default. That is your users' data and your
bandwidth. This app uses 720p, and 480p for rooms of more than six.

**Why `{ video: false }` for audio:** the camera is never opened, and it is never asked for.

## 8. Show video

`VideoTrack` draws one track. Your own camera comes from `useLocalMedia`, and everyone else's from `useRemoteTracks`.

```tsx
import { VideoTrack, useLocalMedia, useRemoteTracks } from '@voltkit-rtc/react-native';
import { StyleSheet, View } from 'react-native';

export function Stage() {
  const local = useLocalMedia();
  const videos = useRemoteTracks({ kind: 'video', source: 'camera' });
  const camera = local.camEnabled ? local.stream?.getVideoTracks()[0] : undefined;

  return (
    <View style={styles.grid}>
      {camera && <VideoTrack track={camera} mirror={local.facingMode === 'user'} style={styles.tile} />}
      {videos
        .filter((video) => !video.paused)
        .map((video) => (
          <VideoTrack key={video.producerId} track={video.track} producerId={video.producerId} objectFit="cover" style={styles.tile} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '50%', aspectRatio: 3 / 4 },
});
```

**Why `producerId` on remote video:** it turns on adaptive video. The client receives each video at the size it is shown, and pauses it when hidden
or in the background. A small tile receives a small copy, which saves data and keeps rooms smooth.

**Why `mirror`:** people expect their own front camera to look like a mirror. Viewers see it the normal way round.

**Why filter on `paused`:** a paused track means the person switched their camera off. Draw their avatar instead of a frozen picture.

Remote sound needs no component: `react-native-webrtc` plays it. Render an `AudioTrack` only to change one person's volume.

## 9. Add controls

```tsx
import { useLocalMedia, useRoom } from '@voltkit-rtc/react-native';
import { Button, View } from 'react-native';

export function Controls() {
  const local = useLocalMedia();
  const { leave } = useRoom();
  const report = (err: Error) => console.warn(err.message);
  return (
    <View>
      <Button title={local.micEnabled ? 'Mute' : 'Unmute'} onPress={() => void local.setMicEnabled(!local.micEnabled).catch(report)} />
      <Button title={local.camEnabled ? 'Camera off' : 'Camera on'} onPress={() => void local.setCamEnabled(!local.camEnabled).catch(report)} />
      <Button title="Flip" onPress={() => void local.switchCamera().catch(report)} />
      <Button title="Leave" onPress={leave} />
    </View>
  );
}
```

These calls reject when a moderator holds that device off, with the code `force-muted`. Show that to the person instead of ignoring it:
[`errors.ts`](../src/rtc/errors.ts) turns codes into words.

`switchCamera()` keeps the same track, so viewers see no gap.

## 10. Show names and avatars

Participants carry only what you put on them. Pass it with the join.

```tsx
<VoltkitProvider wsUrl={wsUrl} token={token} metadata={{ name, avatar }}>
```

Read it back from `useParticipants()`, as `participant.metadata`. Others get it on `participantJoined`.

**Why with the join:** everyone hears the name from the first event, and it stays through reconnects. To change it later, call `client.setMetadata()`, which
others hear through `participantUpdated`.

## 11. Handle what goes wrong

Branch on `err.code`, and write your own words. [`errors.ts`](../src/rtc/errors.ts) has the full mapping.

```ts
import { RpcError, isTerminalError } from '@voltkit-rtc/client';

export function joinProblem(err: Error): { text: string; canRetry: boolean } {
  const code = err instanceof RpcError ? err.code : '';
  switch (code) {
    case 'room-ended':
    case 'no-room':
      return { text: 'This room has ended.', canRetry: false };
    case 'kicked':
      return { text: 'You were removed from this room.', canRetry: false };
    case 'no-capacity':
      return { text: 'This room is full right now. Try again in a moment.', canRetry: true };
    default:
      return { text: 'Could not connect. Check your connection and try again.', canRetry: !isTerminalError(code) };
  }
}
```

**Reconnection needs no code.** The client retries on its own and publishes your media again. Show it while it happens:

```tsx
import { useConnectionState } from '@voltkit-rtc/react-native';
import { Text } from 'react-native';

export function ReconnectBanner() {
  return useConnectionState() === 'reconnecting' ? <Text>Reconnecting…</Text> : null;
}
```

Keep the room on screen: nothing unmounts during a reconnect. After eight failed attempts, about a minute offline, `onClosed` gets `gave-up`, and
that is the time to offer a Join again button.

## 12. Refresh tokens when asked

VoltKit refreshes tokens by itself. When it cannot, the client fires `tokenExpiring` about a minute before expiry.

```tsx
import { useVoltkitEvent } from '@voltkit-rtc/react-native';

export function TokenRefresher({ fetchToken, onToken }: { fetchToken: () => Promise<string>; onToken: (token: string) => void }) {
  useVoltkitEvent('tokenExpiring', () => {
    fetchToken().then(onToken, () => {
      // The session keeps its token. Only a reconnect after it has expired would need a new one.
    });
  });
  return null;
}
```

Pass the new token to the provider's `token` prop. For the same room and identity, it goes to the live session with no reconnect.

## 13. Next

- Roles, seats and moderation: [Rooms, roles and seats](rooms-roles-seats.md)
- Chat and gifts: [Chat and gifts](chat-and-gifts.md)
- 1v1 calls: [One-to-one calls](one-to-one-calls.md)
- Release builds: [Going to production](going-to-production.md)
