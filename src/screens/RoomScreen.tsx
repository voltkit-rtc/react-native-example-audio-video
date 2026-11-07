/**
 * Owns a room session: gets a token, mounts VoltkitProvider, and decides what to show when it ends.
 * What happens inside a room is in rtc/useRoomEngine.ts. Guide: docs/integrate-into-your-app.md
 */
import {
  VoltkitProvider,
  useRoom,
  useVoltkitEvent,
  useWalletLow,
  type ClosedReason,
} from '@voltkit-rtc/react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Keyboard, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api } from '../api/client';
import { coverSource } from '../assets';
import { RoomChat, type ChatLine } from '../components/room/chat';
import { Reactions } from '../components/room/reactions';
import {
  ConfirmEndSheet,
  InviteSheet,
  MemberSheet,
  MoreSheet,
  PeopleSheet,
  ReportSheet,
  SeatSheet,
  useRoomCoins,
} from '../components/room/sheets';
import { AudioStage } from '../components/room/stage-audio';
import { VideoStage } from '../components/room/stage-video';
import { Avatar, Chip, GhostButton, GradientButton, IconButton, LivePill, PoweredBy, T } from '../components/ui';
import { GiftSheet, loadCatalog } from '../gifts/GiftSheet';
import { GiftStage, preloadGifts } from '../gifts/GiftStage';
import { useKeyboardHeight } from '../lib/keyboard';
import { toast } from '../lib/toast';
import type { Screen } from '../navigation';
import { CLOSED_TEXT, actionProblem, joinProblem } from '../rtc/errors';
import { canModerate, canPublish } from '../rtc/permissions';
import { useRoomEngine, type Member, type RoomEngine } from '../rtc/useRoomEngine';
import { useGuest } from '../state/session';
import { colors, gradients, radius } from '../theme';
import type { Credentials, Guest, Room } from '../types';

function Banners({ engine }: { engine: RoomEngine }) {
  const { state } = engine;
  const wallet = useWalletLow();
  if (state === 'reconnecting') {
    return (
      <View style={styles.banner}>
        <ActivityIndicator size="small" color={colors.white} />
        <T variant="small">Reconnecting…</T>
      </View>
    );
  }
  if (wallet.active) {
    return (
      <View style={[styles.banner, { backgroundColor: 'rgba(251,59,102,0.85)' }]}>
        <T variant="small">Demo credit is running out. This room may end soon.</T>
      </View>
    );
  }
  return null;
}

function Header({ engine, onPeople, onMore, onHost }: { engine: RoomEngine; onPeople: () => void; onMore: () => void; onHost: () => void }) {
  const { room, members, hands, myRole } = engine;
  const coins = useRoomCoins(room.giftCoins);
  const pending = canModerate(myRole) ? hands.length : 0;
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Host" onPress={onHost} style={styles.hostChip}>
        <Avatar avatar={room.host.avatar} size={36} />
        <View style={{ flexShrink: 1, maxWidth: 150 }}>
          <T variant="small" numberOfLines={1}>
            {room.title}
          </T>
          <T variant="tiny" numberOfLines={1} style={{ color: colors.textDim }}>
            {room.host.name}
          </T>
        </View>
      </Pressable>
      <View style={{ flex: 1 }} />
      <Chip icon="trophy" label={coins} tint={colors.gold} />
      <LivePill />
      <IconButton testID="room-people" size={34} icon="people" label={`People, ${members.length}`} badge={pending || undefined} onPress={onPeople} />
      <IconButton testID="room-more" size={34} icon="ellipsis-horizontal" label="Room menu" onPress={onMore} />
    </View>
  );
}

function ControlBar({
  engine,
  draft,
  onChat,
  onGift,
  onHeart,
  onMore,
}: {
  engine: RoomEngine;
  draft: string;
  onChat: () => void;
  onGift: () => void;
  onHeart: () => void;
  onMore: () => void;
}) {
  const { room, local, myRole, myHand, actions, iMutedInChat } = engine;
  const onStage = canPublish(myRole);
  const video = room.type === 'video';
  return (
    <View style={styles.controls}>
      <Pressable testID="chat-open" accessibilityRole="button" accessibilityLabel="Write a message" onPress={onChat} disabled={iMutedInChat} style={styles.chatPill}>
        <Ionicons name={iMutedInChat ? 'lock-closed' : 'chatbubble-ellipses'} size={15} color={colors.textDim} />
        <T variant="small" numberOfLines={1} style={{ color: draft ? colors.white : colors.textDim, flexShrink: 1 }}>
          {iMutedInChat ? 'Muted' : draft || 'Say hi…'}
        </T>
      </Pressable>
      {onStage ? (
        <>
          <IconButton testID="ctl-mic" size={42} icon={local.publishing && local.micEnabled ? 'mic' : 'mic-off'} danger={!local.publishing || !local.micEnabled} label={local.micEnabled ? 'Mute' : 'Unmute'} onPress={() => void actions.toggleMic()} />
          {video && <IconButton testID="ctl-cam" size={42} icon={local.camEnabled ? 'videocam' : 'videocam-off'} danger={!local.camEnabled} label={local.camEnabled ? 'Camera off' : 'Camera on'} onPress={() => void actions.toggleCam()} />}
          {video && <IconButton testID="ctl-flip" size={42} icon="camera-reverse" label="Flip camera" onPress={() => void actions.flipCamera()} />}
        </>
      ) : (
        <>
          {myRole === 'viewer' && (
            <IconButton
              testID="ctl-hand"
              size={42}
              icon="hand-left"
              active={myHand}
              label={myHand ? 'Cancel request' : 'Ask to join the stage'}
              onPress={() => void (myHand ? actions.cancelRequest() : actions.requestSeat())}
            />
          )}
          <IconButton testID="ctl-heart" size={42} icon="heart" tint={colors.pink} label="Send a heart" onPress={onHeart} />
        </>
      )}
      <IconButton testID="ctl-gift" size={42} icon="gift" tint={colors.gold} label="Send a gift" onPress={onGift} />
      <IconButton size={42} icon="grid" label="Room menu" onPress={onMore} />
    </View>
  );
}

/**
 * The message box, above the keyboard. When the keyboard goes away it closes too and the draft stays in the
 * "Say hi" pill, so what was typed is neither hidden nor lost.
 */
function Composer({
  visible,
  draft,
  onDraft,
  onClose,
  onSend,
}: {
  visible: boolean;
  draft: string;
  onDraft: (text: string) => void;
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const keyboard = useKeyboardHeight();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const sub = Keyboard.addListener('keyboardDidHide', onClose);
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;
  const send = () => {
    const body = draft.trim();
    if (body) onSend(body);
    onDraft('');
    Keyboard.dismiss();
    onClose();
  };
  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
      <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
      <View style={[styles.composer, { marginBottom: keyboard || insets.bottom }]}>
        <TextInput
          testID="chat-input"
          autoFocus
          value={draft}
          onChangeText={onDraft}
          onSubmitEditing={send}
          placeholder="Say something nice"
          placeholderTextColor={colors.textFaint}
          returnKeyType="send"
          submitBehavior="submit"
          maxLength={280}
          style={styles.input}
        />
        <IconButton testID="chat-send" icon="send" size={40} active label="Send" onPress={send} />
      </View>
    </View>
  );
}

function RoomView({
  room,
  me,
  onTokenRefresh,
  onLeaving,
  onExit,
  onOpenThread,
}: {
  room: Room;
  me: Guest;
  onTokenRefresh: () => void;
  onLeaving: () => void;
  onExit: () => void;
  onOpenThread: (identity: string) => void;
}) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const engine = useRoomEngine(room, me);
  const { client, leave } = useRoom();
  const [member, setMember] = useState<{ identity: string; messageId?: string } | null>(null);
  const [seat, setSeat] = useState<string | null>(null);
  const [people, setPeople] = useState(false);
  const [more, setMore] = useState(false);
  const [gift, setGift] = useState<{ to?: string } | null>(null);
  const [report, setReport] = useState<{ id: string; name: string } | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const stopComposing = useCallback(() => setComposing(false), []);

  useVoltkitEvent('tokenExpiring', onTokenRefresh);

  useEffect(() => {
    loadCatalog().then((gifts) => preloadGifts(gifts.map((g) => g.svgaUrl)), () => {});
  }, []);

  const sendChat = useCallback(
    (text: string) => {
      client?.sendMessage(text, { metadata: { name: me.name, avatar: me.avatar, frame: me.frame } }).catch((err) => toast(actionProblem(err), 'error'));
    },
    [client, me.avatar, me.frame, me.name],
  );
  const sendHeart = useCallback(() => {
    client?.sendMessage('', { type: 'reaction', metadata: { emoji: 'heart' }, ephemeral: true }).catch(() => {});
  }, [client]);
  const pressLine = useCallback((line: ChatLine) => {
    if (line.from) setMember({ identity: line.from, messageId: line.id });
  }, []);

  async function exit() {
    setConfirmEnd(false);
    onLeaving();
    if (engine.isHost) await engine.actions.endRoom();
    else leave();
    onExit();
  }

  // Header, gaps and controls take the rest; the chat gets whatever is left under the stage.
  const stageHeight = Math.round((height - insets.top - insets.bottom) * 0.58);
  const giftPeople = useMemo(() => {
    const onStage = (m: Member) => (m.identity === room.host.id ? 0 : m.seat ? 1 : 2);
    return [...engine.members].sort((a, b) => onStage(a) - onStage(b)).slice(0, 40);
  }, [engine.members, room.host.id]);

  return (
    <View style={styles.screen}>
      <Image source={coverSource(room.theme)} style={[StyleSheet.absoluteFill, { width, height }]} fadeDuration={0} />
      <LinearGradient colors={['rgba(8,6,16,0.82)', 'rgba(8,6,16,0.58)', 'rgba(8,6,16,0.94)']} style={StyleSheet.absoluteFill} />

      <View style={{ flex: 1, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 6 }}>
        <Header engine={engine} onPeople={() => setPeople(true)} onMore={() => setMore(true)} onHost={() => setMember({ identity: room.host.id })} />
        <Banners engine={engine} />
        <View style={{ paddingHorizontal: room.type === 'video' ? 6 : 0, marginTop: 8 }}>
          {room.type === 'video' ? (
            <VideoStage engine={engine} width={width - 12} height={stageHeight} onMember={(identity) => setMember({ identity })} onSeat={setSeat} />
          ) : (
            <AudioStage engine={engine} onMember={(identity) => setMember({ identity })} onSeat={setSeat} />
          )}
        </View>
        <RoomChat selfId={me.id} blocked={me.blocked} onPressLine={pressLine} style={{ flex: 1, marginTop: 6 }} />
        <PoweredBy style={{ marginBottom: 4 }} />
        <ControlBar engine={engine} draft={draft} onChat={() => setComposing(true)} onGift={() => setGift({})} onHeart={sendHeart} onMore={() => setMore(true)} />
      </View>

      <Reactions />
      <GiftStage />
      <Composer visible={composing} draft={draft} onDraft={setDraft} onClose={stopComposing} onSend={sendChat} />

      <MemberSheet
        engine={engine}
        identity={member?.identity ?? null}
        messageId={member?.messageId}
        onClose={() => setMember(null)}
        onGift={(to) => setGift({ to })}
        onReport={setReport}
        onMessage={onOpenThread}
      />
      <SeatSheet engine={engine} seat={seat} onClose={() => setSeat(null)} />
      <PeopleSheet engine={engine} visible={people} onClose={() => setPeople(false)} onMember={(identity) => setMember({ identity })} />
      <MoreSheet
        engine={engine}
        visible={more}
        onClose={() => setMore(false)}
        onLeave={() => setConfirmEnd(true)}
        onPeople={() => setPeople(true)}
        onReportRoom={() => setReport({ id: room.host.id, name: room.title })}
      />
      <GiftSheet visible={gift !== null} onClose={() => setGift(null)} room={room} people={giftPeople} initialTo={gift?.to} />
      <ReportSheet target={report} roomId={room.id} onClose={() => setReport(null)} />
      <InviteSheet engine={engine} />
      <ConfirmEndSheet visible={confirmEnd} isHost={engine.isHost} onClose={() => setConfirmEnd(false)} onConfirm={() => void exit()} />
      <BackGuard onBack={() => setConfirmEnd(true)} />
    </View>
  );
}

/** The room can only be left on purpose: a stray back press should not end someone's live. */
function BackGuard({ onBack }: { onBack: () => void }) {
  const latest = useRef(onBack);
  latest.current = onBack;
  // Only while the room is the screen in front: back from a chat opened out of the room just closes the chat.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        latest.current();
        return true;
      });
      return () => sub.remove();
    }, []),
  );
  return null;
}

/** The provider connects once and does not retry: a failed join leaves the state idle, with the error set. */
function ConnectionWatch({ onFailed }: { onFailed: (err: Error) => void }) {
  const { state, error } = useRoom();
  const latest = useRef(onFailed);
  latest.current = onFailed;
  useEffect(() => {
    if (state === 'idle' && error) latest.current(error);
  }, [state, error]);
  return null;
}

interface Session {
  room: Room;
  credentials: Credentials;
}

export function RoomScreen({ route, navigation }: Screen<'Room'>) {
  const { roomId, initial } = route.params;
  const me = useGuest();
  const [session, setSession] = useState<Session | null>(initial ?? null);
  const [attempt, setAttempt] = useState(0);
  const [ended, setEnded] = useState<{ text: string; canRejoin: boolean } | null>(null);
  const exiting = useRef(false);

  const join = useCallback(async () => {
    setEnded(null);
    setSession(null);
    try {
      const res = await api.joinRoom(roomId);
      setSession(res);
      setAttempt((n) => n + 1);
    } catch (err) {
      const gone = err instanceof ApiError && ['room-ended', 'banned', 'room-full', 'rtc-unavailable'].includes(err.code);
      setEnded({ text: err instanceof ApiError ? err.message : 'Could not join this room.', canRejoin: !gone });
    }
  }, [roomId]);

  useEffect(() => {
    if (!initial) void join();
  }, [initial, join]);

  const refreshToken = useCallback(async () => {
    try {
      const { credentials } = await api.refreshRoomToken(roomId);
      // A new token for the same session goes to the live connection, with no reconnect.
      setSession((s) => (s ? { ...s, credentials } : s));
    } catch {
      // The session keeps its token: only a reconnect after it has expired would need a new one.
    }
  }, [roomId]);

  const onClosed = useCallback(
    (reason: ClosedReason) => {
      if (exiting.current || reason === 'left') return;
      setSession(null);
      setEnded({ text: CLOSED_TEXT[reason], canRejoin: reason === 'gave-up' });
    },
    [],
  );

  const onFailed = useCallback((err: Error) => {
    const problem = joinProblem(err);
    setSession(null);
    setEnded({ text: problem.text, canRejoin: problem.canRetry });
  }, []);

  const leaving = useCallback(() => {
    exiting.current = true;
  }, []);
  const exit = useCallback(() => navigation.goBack(), [navigation]);

  const openThread = useCallback(
    async (identity: string) => {
      try {
        const { conversation } = await api.startConversation(identity);
        navigation.navigate('Thread', { conversationId: conversation.id, peer: conversation.peer });
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Could not start that conversation.', 'error');
      }
    },
    [navigation],
  );

  if (ended) {
    return (
      <View style={[styles.screen, styles.center]}>
        <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
        <Ionicons name="radio-outline" size={46} color={colors.magenta} />
        <T testID="room-ended-text" variant="title" style={{ textAlign: 'center', paddingHorizontal: 30 }}>
          {ended.text}
        </T>
        {ended.canRejoin && <GradientButton label="Join again" onPress={() => void join()} style={{ alignSelf: 'stretch', marginHorizontal: 40 }} />}
        <GhostButton testID="room-ended-home" label="Back to home" onPress={() => navigation.goBack()} style={{ alignSelf: 'stretch', marginHorizontal: 40 }} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.screen, styles.center]}>
        <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={colors.magenta} size="large" />
        <T style={{ color: colors.textDim }}>Joining…</T>
      </View>
    );
  }

  return (
    // A closed session stays closed, so rejoining needs a new client: a new key is how React makes one.
    <VoltkitProvider
      key={attempt}
      wsUrl={session.credentials.wsUrl}
      token={session.credentials.token}
      metadata={{ name: me.name, avatar: me.avatar, frame: me.frame }}
      callService={{ title: session.room.title, text: 'Tap to return to the room', leaveLabel: 'Leave' }}
      onError={(err) => {
        if (__DEV__) console.warn('[voltkit]', err.message);
      }}
      onClosed={onClosed}
    >
      <ConnectionWatch onFailed={onFailed} />
      <RoomView room={session.room} me={me} onTokenRefresh={refreshToken} onLeaving={leaving} onExit={exit} onOpenThread={openThread} />
    </VoltkitProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  hostChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 12,
    paddingLeft: 3,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.42)',
    flexShrink: 1,
  },
  banner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
    marginTop: 6,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  chatPill: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    backgroundColor: colors.glassStrong,
  },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.plum },
  input: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    color: colors.white,
    backgroundColor: colors.glass,
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
  },
});
