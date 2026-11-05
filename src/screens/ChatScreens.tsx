/**
 * Chat outside a room: the inbox, the Public Lounge and direct messages, each over a chat-only ChatClient.
 * Room chat is in components/room/chat.tsx. Guide: docs/chat-and-gifts.md
 */
import { ChatClient, type ChatMessage } from '@voltkit-rtc/client';
import '@voltkit-rtc/react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api } from '../api/client';
import { useSocketEvent } from '../api/socket';
import { ReportSheet } from '../components/room/sheets';
import { Avatar, GhostButton, IconButton, Sheet, SheetRow, T } from '../components/ui';
import { shortTime } from '../lib/format';
import { useKeyboardHeight } from '../lib/keyboard';
import { toast } from '../lib/toast';
import type { RootStack, Screen } from '../navigation';
import { useGuest, useSession } from '../state/session';
import { colors, fonts, gradients, radius } from '../theme';
import type { ConversationSummary, Frame } from '../types';

export function InboxScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setList((await api.conversations()).conversations);
    } catch {
      // The lounge still works, and the next focus tries again.
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useSocketEvent('dm:new', () => void load());

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
      <FlatList
        testID="inbox-list"
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 14, paddingBottom: 110, gap: 6 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <T variant="display">Chat</T>
            <Pressable testID="open-lounge" accessibilityRole="button" accessibilityLabel="Public lounge" onPress={() => navigation.navigate('Lounge')}>
              <LinearGradient colors={['#3A1578', '#9D2BC0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.lounge}>
                <View style={styles.loungeIcon}>
                  <Ionicons name="planet" size={24} color={colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="heading">Public Lounge</T>
                  <T variant="small" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    Talk with everyone online
                  </T>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.white} />
              </LinearGradient>
            </Pressable>
            <T variant="small" style={{ color: colors.textDim, marginTop: 4 }}>
              Direct messages
            </T>
          </View>
        }
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.textDim} />
              <T style={{ color: colors.textDim, textAlign: 'center' }}>No messages yet. Tap someone in a room to start a conversation.</T>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`conversation-${item.peer.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Conversation with ${item.peer.name}`}
            onPress={() => navigation.navigate('Thread', { conversationId: item.id, peer: item.peer })}
            style={styles.row}
          >
            <Avatar avatar={item.peer.avatar} size={48} />
            <View style={{ flex: 1 }}>
              <T variant="medium" numberOfLines={1}>
                {item.peer.name}
              </T>
              <T variant="small" numberOfLines={1} style={{ color: colors.textDim }}>
                {item.last?.text ?? 'Say hello'}
              </T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {item.last && (
                <T variant="tiny" style={{ color: colors.textFaint }}>
                  {shortTime(item.last.at)}
                </T>
              )}
              {item.unread > 0 && (
                <View style={styles.unread}>
                  <T variant="tiny" style={{ fontSize: 10 }}>
                    {item.unread}
                  </T>
                </View>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

interface Bubble {
  id: string;
  mine: boolean;
  text: string;
  name?: string;
  avatar?: string;
  frame?: Frame;
  from?: string;
  time?: string;
}

const MessageBubble = memo(function MessageBubble({ item, showName, onPressName }: { item: Bubble; showName: boolean; onPressName?: (b: Bubble) => void }) {
  return (
    <View style={[styles.line, item.mine && { justifyContent: 'flex-end' }]}>
      {showName && !item.mine && (
        <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => onPressName?.(item)}>
          <Avatar avatar={item.avatar} size={30} />
        </Pressable>
      )}
      <View style={{ maxWidth: '78%', gap: 2 }}>
        {showName && !item.mine && (
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, options`} onPress={() => onPressName?.(item)}>
            <T variant="tiny" style={{ color: colors.gold, marginLeft: 8 }}>
              {item.name}
            </T>
          </Pressable>
        )}
        {item.mine ? (
          <LinearGradient colors={gradients.video} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, { borderBottomRightRadius: 5 }]}>
            <T>{item.text}</T>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.bubbleOther]}>
            <T>{item.text}</T>
          </View>
        )}
      </View>
    </View>
  );
});

function InputBar({ onSend, testID, disabled }: { onSend: (text: string) => void; testID: string; disabled?: boolean }) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const [text, setText] = useState('');
  const send = () => {
    const body = text.trim();
    if (!body) return;
    onSend(body);
    setText('');
  };
  return (
    <View style={[styles.inputBar, { paddingBottom: (keyboard || insets.bottom) + 8 }]}>
      <TextInput
        testID={testID}
        value={text}
        onChangeText={setText}
        onSubmitEditing={send}
        placeholder="Message"
        placeholderTextColor={colors.textFaint}
        returnKeyType="send"
        maxLength={1000}
        editable={!disabled}
        submitBehavior="submit"
        style={styles.input}
      />
      <IconButton testID={`${testID}-send`} icon="send" active size={44} label="Send" disabled={disabled} onPress={send} />
    </View>
  );
}

function ChatHeader({ title, subtitle, avatar, right, onBack }: { title: string; subtitle?: string; avatar?: string; right?: React.ReactNode; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <IconButton
        testID="chat-back"
        size={38}
        icon="chevron-back"
        label="Back"
        onPress={() => {
          Keyboard.dismiss();
          onBack();
        }}
      />
      {avatar && <Avatar avatar={avatar} size={38} />}
      <View style={{ flex: 1 }}>
        <T variant="heading" numberOfLines={1}>
          {title}
        </T>
        {subtitle && (
          <T variant="tiny" numberOfLines={1} style={{ color: colors.textDim }}>
            {subtitle}
          </T>
        )}
      </View>
      {right}
    </View>
  );
}

/** One chat channel over its own VoltKit connection: no room, no media, just messages. */
function useChatChannel(open: () => Promise<{ token: string; wsUrl: string }>, onMessage: (m: ChatMessage) => void, onHistory?: (m: ChatMessage[]) => void) {
  const [state, setState] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  const [members, setMembers] = useState(0);
  const client = useRef<ChatClient | null>(null);
  const handler = useRef(onMessage);
  const history = useRef(onHistory);
  const opener = useRef(open);
  handler.current = onMessage;
  history.current = onHistory;
  opener.current = open;

  useEffect(() => {
    let cancelled = false;
    let chat: ChatClient | null = null;
    (async () => {
      try {
        const { token, wsUrl } = await opener.current();
        if (cancelled) return;
        chat = new ChatClient(wsUrl, token);
        client.current = chat;
        chat.on('message', (m) => handler.current(m));
        chat.on('closed', (reason) => {
          if (reason !== 'left' && !cancelled) setState('failed');
        });
        const joined = await chat.connect();
        if (cancelled) return chat.close();
        setMembers(joined.members);
        history.current?.(joined.messages ?? []);
        setState('connected');
      } catch {
        if (!cancelled) setState('failed');
      }
    })();
    return () => {
      cancelled = true;
      chat?.close();
      client.current = null;
    };
  }, []);

  return { state, members, client };
}

export function LoungeScreen({ navigation }: Screen<'Lounge'>) {
  const me = useGuest();
  const { refresh } = useSession();
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [person, setPerson] = useState<Bubble | null>(null);
  const [report, setReport] = useState<{ id: string; name: string } | null>(null);

  const toBubble = useCallback(
    (m: ChatMessage): Bubble | null => {
      if (m.type !== 'text' || !m.text || me.blocked.includes(m.from)) return null;
      const meta = (m.metadata ?? {}) as { name?: string; avatar?: string; frame?: Frame };
      return { id: m.id, mine: m.from === me.id, text: m.text, name: meta.name ?? 'Guest', avatar: meta.avatar, frame: meta.frame, from: m.from };
    },
    [me.blocked, me.id],
  );

  const { state, client } = useChatChannel(
    () => api.loungeToken(),
    (m) => {
      const b = toBubble(m);
      if (b) setMessages((prev) => (prev.some((x) => x.id === b.id) ? prev : [b, ...prev].slice(0, 200)));
    },
    (history) => setMessages(history.map(toBubble).filter((b): b is Bubble => b !== null).reverse()),
  );

  async function send(text: string) {
    try {
      await client.current?.sendMessage(text, { metadata: { name: me.name, avatar: me.avatar, frame: me.frame } });
    } catch {
      toast('Your message was not sent.', 'error');
    }
  }

  async function message(b: Bubble) {
    setPerson(null);
    try {
      const { conversation } = await api.startConversation(b.from!);
      navigation.navigate('Thread', { conversationId: conversation.id, peer: conversation.peer });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not start that conversation.', 'error');
    }
  }

  async function block(b: Bubble) {
    setPerson(null);
    await api.block(b.from!).then(refresh, () => toast('That did not work.', 'error'));
    setMessages((prev) => prev.filter((x) => x.from !== b.from));
    toast(`${b.name} is blocked`, 'success');
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
      <ChatHeader title="Public Lounge" subtitle="Chat by VoltKit RTC" onBack={() => navigation.goBack()} />
      {state === 'connecting' && <ActivityIndicator color={colors.magenta} style={{ marginTop: 40 }} />}
      {state === 'failed' && (
        <View style={styles.empty}>
          <T style={{ color: colors.textDim }}>Could not connect to the lounge.</T>
          <GhostButton label="Back" onPress={() => navigation.goBack()} />
        </View>
      )}
      <FlatList
        testID="lounge-list"
        style={{ flex: 1 }}
        data={messages}
        inverted
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble item={item} showName onPressName={setPerson} />}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        ListEmptyComponent={
          state === 'connected' ? (
            <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
              <T style={{ color: colors.textDim, textAlign: 'center' }}>It is quiet in here. Say hello.</T>
            </View>
          ) : undefined
        }
      />
      <InputBar testID="lounge-input" onSend={(t) => void send(t)} disabled={state !== 'connected'} />
      <Sheet visible={person !== null} onClose={() => setPerson(null)} title={person?.name}>
        {person && (
          <>
            <SheetRow icon="chatbubble-ellipses-outline" label="Send a message" onPress={() => void message(person)} />
            <SheetRow
              icon="flag-outline"
              label="Report"
              onPress={() => {
                setReport({ id: person.from!, name: person.name ?? 'Guest' });
                setPerson(null);
              }}
            />
            <SheetRow icon="ban-outline" danger label="Block" onPress={() => void block(person)} />
          </>
        )}
      </Sheet>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </View>
  );
}

export function ThreadScreen({ route, navigation }: Screen<'Thread'>) {
  const { conversationId, peer } = route.params;
  const me = useGuest();
  const { refresh } = useSession();
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState<{ id: string; name: string } | null>(null);

  const add = useCallback((b: Bubble) => {
    setMessages((prev) => (prev.some((x) => x.id === b.id) ? prev : [b, ...prev]));
  }, []);

  useChatChannel(
    async () => {
      const res = await api.conversation(conversationId);
      setMessages(res.messages.map((m) => ({ id: m.id, mine: m.from === me.id, text: m.text, time: m.at })));
      void api.markRead(conversationId).catch(() => {});
      return res.chat;
    },
    (m) => {
      if (m.from === me.id || !m.text) return; // our own already show, from the send below
      const id = (m.metadata as { messageId?: string } | undefined)?.messageId ?? m.id;
      add({ id, mine: false, text: m.text });
      void api.markRead(conversationId).catch(() => {});
    },
  );

  async function send(text: string) {
    try {
      const { message } = await api.sendDirect(conversationId, text);
      add({ id: message.id, mine: true, text: message.text, time: message.at });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Your message was not sent.', 'error');
    }
  }

  async function block() {
    setMenu(false);
    try {
      await api.block(peer.id);
      await refresh();
      navigation.goBack();
      toast(`${peer.name} is blocked`, 'success');
    } catch {
      toast('That did not work.', 'error');
    }
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
      <ChatHeader
        title={peer.name}
        subtitle="Direct message"
        avatar={peer.avatar}
        onBack={() => navigation.goBack()}
        right={<IconButton testID="thread-menu" size={38} icon="ellipsis-horizontal" label="Options" onPress={() => setMenu(true)} />}
      />
      <FlatList
        testID="thread-list"
        style={{ flex: 1 }}
        data={messages}
        inverted
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble item={item} showName={false} />}
        contentContainerStyle={{ padding: 12, gap: 6 }}
      />
      <InputBar testID="thread-input" onSend={(t) => void send(t)} />
      <Sheet visible={menu} onClose={() => setMenu(false)} title={peer.name}>
        <SheetRow
          icon="flag-outline"
          label="Report"
          onPress={() => {
            setMenu(false);
            setReport({ id: peer.id, name: peer.name });
          }}
        />
        <SheetRow icon="ban-outline" danger label="Block" onPress={() => void block()} />
      </Sheet>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  lounge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg },
  loungeIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.md, backgroundColor: colors.glass },
  unread: { minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pink },
  empty: { alignItems: 'center', gap: 10, padding: 30 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.glassBorder },
  line: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubble: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18 },
  bubbleOther: { backgroundColor: colors.glassStrong, borderBottomLeftRadius: 5 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingTop: 8, backgroundColor: colors.plum },
  input: { flex: 1, height: 44, borderRadius: radius.pill, paddingHorizontal: 15, color: colors.white, backgroundColor: colors.glass, fontFamily: fonts.regular, fontSize: 15 },
});
