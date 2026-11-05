/**
 * Random 1v1 video calls. A call is a VoltKit room with two people: the backend's matchmaker makes the room and
 * sends each phone its token over Socket.IO. Guide: docs/one-to-one-calls.md
 */
import { RpcError } from '@voltkit-rtc/client';
import {
  VideoTrack,
  VoltkitProvider,
  useLocalMedia,
  useParticipants,
  useRemoteTracks,
  useRoom,
  useVoltkitEvent,
} from '@voltkit-rtc/react-native';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api } from '../api/client';
import { getSocket, useSocketEvent } from '../api/socket';
import { ReportSheet } from '../components/room/sheets';
import { Avatar, GhostButton, GradientButton, IconButton, PoweredBy, Sheet, SheetRow, T } from '../components/ui';
import { clock } from '../lib/format';
import { useKeyboardHeight } from '../lib/keyboard';
import { toast } from '../lib/toast';
import type { Screen } from '../navigation';
import { mediaProblem } from '../rtc/errors';
import { useMediaConsent } from '../rtc/consent';
import { useGuest, useSession } from '../state/session';
import { colors, fill, gradients, radius } from '../theme';
import type { GuestPublic, MatchFound } from '../types';

type Phase = 'searching' | 'call' | 'ended';

const PEER_AWAY_MS = 30_000;

function Radar() {
  const rings = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  useEffect(() => {
    const loops = rings.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [rings]);
  return (
    <>
      {rings.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.5] }) }],
            },
          ]}
        />
      ))}
    </>
  );
}

const CallChat = memo(function CallChat({ peerName }: { peerName: string }) {
  const [lines, setLines] = useState<{ id: string; mine: boolean; text: string }[]>([]);
  const me = useGuest();
  useVoltkitEvent('message', (m) => {
    if (m.type !== 'text' || !m.text) return;
    setLines((prev) => [{ id: m.id, mine: m.from === me.id, text: m.text ?? '' }, ...prev].slice(0, 40));
  });
  return (
    <FlatList
      testID="call-chat"
      data={lines}
      inverted
      style={styles.callChat}
      keyExtractor={(l) => l.id}
      contentContainerStyle={{ gap: 4 }}
      renderItem={({ item }) => (
        <View style={[styles.callLine, item.mine && { alignSelf: 'flex-end', backgroundColor: 'rgba(139,92,246,0.72)' }]}>
          <T variant="small">
            {item.mine ? '' : `${peerName}: `}
            {item.text}
          </T>
        </View>
      )}
    />
  );
});

function CallView({
  peer,
  onNext,
  onStop,
  onPeerLeft,
}: {
  peer: GuestPublic;
  onNext: () => void;
  onStop: () => void;
  onPeerLeft: () => void;
}) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const { refresh } = useSession();
  const { state, client } = useRoom();
  const local = useLocalMedia();
  const people = useParticipants();
  const video = useRemoteTracks({ kind: 'video', source: 'camera' });
  const audio = useRemoteTracks({ kind: 'audio', source: 'mic' });
  const [seconds, setSeconds] = useState(0);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState<{ id: string; name: string } | null>(null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const published = useRef(false);

  const remote = video.find((t) => !t.paused);
  const remoteMicOff = audio.length > 0 && audio.every((t) => t.paused);
  const peerHere = people.some((p) => p.identity === peer.id);
  const camera = local.camEnabled ? local.stream?.getVideoTracks()[0] : undefined;

  useEffect(() => {
    if (state !== 'connected' || published.current) return;
    published.current = true;
    local.publish({ quality: '720p' }).catch((err) => {
      if (err instanceof RpcError && err.code === 'source-already-published') return;
      toast(mediaProblem(err).text, 'error');
    });
  }, [state, local]);

  useEffect(() => {
    if (!peerHere) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [peerHere]);

  // A drop may be a network blip: their SDK reconnects. Give it time, as VoltKit's call guide does, so a
  // peer whose app was killed does not leave this side waiting forever.
  const away = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAway = () => {
    if (away.current) clearTimeout(away.current);
    away.current = null;
  };
  useEffect(() => clearAway, []);
  useVoltkitEvent('participantLeft', ({ identity, reason }) => {
    if (identity !== peer.id) return;
    if (reason === 'disconnected' || reason === 'presence-lost') {
      clearAway();
      away.current = setTimeout(onPeerLeft, PEER_AWAY_MS);
    } else {
      onPeerLeft();
    }
  });
  useVoltkitEvent('participantJoined', ({ identity }) => {
    if (identity === peer.id) clearAway();
  });

  const send = () => {
    const body = text.trim();
    if (body) client?.sendMessage(body).catch(() => toast('Your message was not sent.', 'error'));
    setText('');
    setTyping(false);
  };

  async function block() {
    setMenu(false);
    try {
      await api.block(peer.id);
      await refresh();
      toast(`${peer.name} is blocked. You will not be matched again.`, 'success');
      onNext();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'That did not work.', 'error');
    }
  }

  return (
    <View style={styles.call}>
      {remote ? (
        <VideoTrack testID="remote-video" track={remote.track} producerId={remote.producerId} objectFit="cover" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={styles.peerFallback}>
          <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
          <Avatar avatar={peer.avatar} frame={peer.frame} size={120} />
          <T variant="heading" style={{ marginTop: 40 }}>
            {peerHere ? `${peer.name} has their camera off` : `Connecting to ${peer.name}…`}
          </T>
        </View>
      )}

      {camera && (
        <View style={[styles.pip, { top: insets.top + 64 }]}>
          <VideoTrack track={camera} mirror={local.facingMode === 'user'} objectFit="cover" zOrder={1} style={StyleSheet.absoluteFill} />
        </View>
      )}

      <LinearGradient colors={['rgba(5,3,9,0.75)', 'transparent']} style={styles.topScrim} pointerEvents="none" />
      <View style={[styles.callTop, { top: insets.top + 8 }]}>
        <View style={styles.peerChip}>
          <Avatar avatar={peer.avatar} size={34} />
          <View>
            <T variant="small">{peer.name}</T>
            <T variant="tiny" style={{ color: colors.textDim }}>
              {remoteMicOff ? 'Muted · ' : ''}
              {clock(seconds)}
            </T>
          </View>
        </View>
        <View style={{ flex: 1 }} />
        <IconButton testID="call-menu" size={38} icon="shield-half" label="Safety" onPress={() => setMenu(true)} />
      </View>

      {state === 'reconnecting' && (
        <View style={styles.reconnecting}>
          <T variant="small">Reconnecting…</T>
        </View>
      )}

      <View style={[styles.callBottom, { paddingBottom: (keyboard || insets.bottom) + 10 }]} pointerEvents="box-none">
        <LinearGradient colors={gradients.scrimBottom} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <CallChat peerName={peer.name} />
        {typing ? (
          <View style={styles.callComposer}>
            <TextInput
              testID="call-input"
              autoFocus
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              onBlur={() => setTyping(false)}
              placeholder={`Message ${peer.name}`}
              placeholderTextColor={colors.textFaint}
              returnKeyType="send"
              maxLength={280}
              style={styles.callInput}
            />
            <IconButton icon="send" size={42} active label="Send" onPress={send} />
          </View>
        ) : (
          <View style={styles.callControls}>
            <IconButton testID="call-mic" size={50} icon={local.micEnabled ? 'mic' : 'mic-off'} danger={!local.micEnabled} label={local.micEnabled ? 'Mute' : 'Unmute'} onPress={() => void local.setMicEnabled(!local.micEnabled).catch(() => {})} />
            <IconButton testID="call-cam" size={50} icon={local.camEnabled ? 'videocam' : 'videocam-off'} danger={!local.camEnabled} label={local.camEnabled ? 'Camera off' : 'Camera on'} onPress={() => void local.setCamEnabled(!local.camEnabled).catch(() => {})} />
            <IconButton testID="call-flip" size={50} icon="camera-reverse" label="Flip camera" onPress={() => void local.switchCamera().catch(() => {})} />
            <IconButton testID="call-chat-open" size={50} icon="chatbubble-ellipses" label="Send a message" onPress={() => setTyping(true)} />
            <IconButton testID="call-next" size={50} icon="play-skip-forward" active label="Next person" onPress={onNext} />
            <IconButton testID="call-end" size={50} icon="call" danger label="End call" onPress={onStop} style={{ transform: [{ rotate: '135deg' }] }} />
          </View>
        )}
      </View>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Safety" testID="call-safety">
        <SheetRow
          testID="call-report"
          icon="flag-outline"
          label={`Report ${peer.name}`}
          onPress={() => {
            setMenu(false);
            setReport({ id: peer.id, name: peer.name });
          }}
        />
        <SheetRow testID="call-block" icon="ban-outline" danger label={`Block ${peer.name}`} hint="You will not be matched again" onPress={() => void block()} />
      </Sheet>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </View>
  );
}

export function MatchScreen({ navigation }: Screen<'Match'>) {
  const ask = useMediaConsent();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('searching');
  const [call, setCall] = useState<MatchFound | null>(null);
  const [lastPeer, setLastPeer] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);
  const callRef = useRef<MatchFound | null>(null);
  callRef.current = call;

  const search = useCallback(() => {
    setPhase('searching');
    setCall(null);
    getSocket()?.emit('match:join');
  }, []);

  const hangUp = useCallback(() => {
    const current = callRef.current;
    if (current) getSocket()?.emit('match:end', { callId: current.callId });
    setCall(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void ask('video').then((yes) => {
      if (cancelled) return;
      if (yes) search();
      else navigation.goBack();
    });
    return () => {
      cancelled = true;
      getSocket()?.emit('match:leave');
      const current = callRef.current;
      if (current) getSocket()?.emit('match:end', { callId: current.callId });
    };
  }, [ask, navigation, search]);

  useSocketEvent<MatchFound>('match:found', (found) => {
    setCall(found);
    setPhase('call');
  });
  useSocketEvent<{ waiting: number }>('match:waiting', (e) => setWaiting(e.waiting));
  useSocketEvent<{ callId: string }>('match:ended', (e) => {
    if (e.callId !== callRef.current?.callId) return;
    setLastPeer(callRef.current?.peer.name ?? null);
    setCall(null);
    setPhase('ended');
  });
  useSocketEvent<{ message: string }>('match:error', (e) => {
    toast(e.message, 'error');
    navigation.goBack();
  });

  const peerLeft = useCallback(() => {
    setLastPeer(callRef.current?.peer.name ?? null);
    hangUp();
    setPhase('ended');
  }, [hangUp]);

  const next = useCallback(() => {
    hangUp();
    search();
  }, [hangUp, search]);

  const stop = useCallback(() => {
    hangUp();
    navigation.goBack();
  }, [hangUp, navigation]);

  const service = useMemo(() => ({ title: 'VoltKit Live call', text: 'Tap to return to the call', leaveLabel: 'End call' }), []);

  if (call) {
    return (
      <VoltkitProvider key={call.callId} wsUrl={call.wsUrl} token={call.token} callService={service} onClosed={(reason) => reason !== 'left' && peerLeft()}>
        <CallView peer={call.peer} onNext={next} onStop={stop} onPeerLeft={peerLeft} />
      </VoltkitProvider>
    );
  }

  return (
    <View style={[styles.search, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
      <View style={styles.searchTop}>
        <IconButton testID="match-close" size={40} icon="close" label="Close" onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.radar}>
        {phase === 'searching' && <Radar />}
        <LinearGradient colors={gradients.match} style={styles.radarCore}>
          <Ionicons name="videocam" size={38} color={colors.white} />
        </LinearGradient>
      </View>
      {phase === 'searching' ? (
        <View style={styles.searchCopy}>
          <T testID="match-status" variant="title">
            Finding someone…
          </T>
          <T style={{ color: colors.textDim, textAlign: 'center' }}>
            {waiting > 1 ? `${waiting} people are looking right now` : 'You will be connected as soon as someone else joins'}
          </T>
        </View>
      ) : (
        <View style={styles.searchCopy}>
          <T testID="match-status" variant="title">
            {lastPeer ? `${lastPeer} left` : 'Call ended'}
          </T>
          <GradientButton testID="match-again" label="Find someone new" icon="shuffle" onPress={search} colorsOverride={gradients.match} style={{ alignSelf: 'stretch', marginTop: 12 }} />
          <GhostButton label="Back to home" onPress={() => navigation.goBack()} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
      <PoweredBy />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flex: 1, alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg },
  searchTop: { alignSelf: 'stretch', paddingHorizontal: 14, alignItems: 'flex-start' },
  radar: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 2, borderColor: colors.pink },
  radarCore: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  searchCopy: { alignItems: 'center', gap: 8, paddingHorizontal: 30, alignSelf: 'stretch' },

  call: { flex: 1, backgroundColor: '#000' },
  peerFallback: { ...fill, alignItems: 'center', justifyContent: 'center' },
  pip: { position: 'absolute', right: 12, width: 104, height: 150, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.white, backgroundColor: colors.plum },
  topScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: 130 },
  callTop: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center' },
  peerChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 14, paddingLeft: 3, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.45)' },
  reconnecting: { position: 'absolute', top: '45%', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.65)' },
  callBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 36, paddingHorizontal: 12, gap: 10 },
  callChat: { maxHeight: 160, flexGrow: 0 },
  callLine: { alignSelf: 'flex-start', maxWidth: '80%', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.5)' },
  callControls: { flexDirection: 'row', justifyContent: 'space-between' },
  callComposer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  callInput: { flex: 1, height: 44, borderRadius: radius.pill, paddingHorizontal: 15, color: colors.white, backgroundColor: 'rgba(255,255,255,0.14)', fontFamily: 'Outfit_400Regular', fontSize: 15 },
});
