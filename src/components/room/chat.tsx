import type { ChatMessage } from '@voltkit-rtc/client';
import { useRoom, useVoltkitClient, useVoltkitEvent } from '@voltkit-rtc/react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../../theme';
import type { Frame } from '../../types';
import { Avatar, T } from '../ui';

export interface ChatLine {
  id: string;
  kind: 'text' | 'gift' | 'notice';
  from?: string;
  name?: string;
  avatar?: string;
  frame?: Frame;
  text: string;
}

const MAX_LINES = 120;
const WELCOME: ChatLine = {
  id: 'welcome',
  kind: 'notice',
  text: 'Welcome. Be kind: harassment, nudity and spam get you removed. Tap anyone to report or block them.',
};

function toLine(m: ChatMessage): ChatLine | null {
  const meta = (m.metadata ?? {}) as Record<string, any>;
  if (m.type === 'text' && m.text?.trim()) {
    return { id: m.id, kind: 'text', from: m.from, name: meta.name ?? 'Guest', avatar: meta.avatar, frame: meta.frame, text: m.text };
  }
  if (m.type === 'gift') {
    const times = meta.count > 1 ? ` ×${meta.count}` : '';
    return { id: m.id, kind: 'gift', from: m.from, text: `${meta.fromName ?? 'Someone'} sent ${meta.giftName ?? 'a gift'}${times} to ${meta.toName ?? 'the host'}` };
  }
  return null;
}

const Line = memo(function Line({ line, onPress }: { line: ChatLine; onPress: (line: ChatLine) => void }) {
  if (line.kind === 'notice') {
    return (
      <View style={styles.notice}>
        <T variant="tiny" style={{ color: colors.cyan }}>
          {line.text}
        </T>
      </View>
    );
  }
  if (line.kind === 'gift') {
    return (
      <View style={styles.bubble}>
        <T variant="small" style={{ color: colors.gold }}>
          {line.text}
        </T>
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Message from ${line.name}`} onPress={() => onPress(line)} style={styles.bubble}>
      <Avatar avatar={line.avatar} size={20} />
      <T variant="small" style={styles.text}>
        <T variant="small" style={{ color: colors.gold }}>
          {line.name}
          {'  '}
        </T>
        {line.text}
      </T>
    </Pressable>
  );
});

/** Chat lives on the room's own connection, so there is no second socket and no second token. */
export const RoomChat = memo(function RoomChat({
  selfId,
  blocked,
  onPressLine,
  style,
}: {
  selfId: string;
  blocked: string[];
  onPressLine: (line: ChatLine) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const client = useVoltkitClient();
  const { state } = useRoom();
  const [lines, setLines] = useState<ChatLine[]>([WELCOME]);
  const greeted = useRef(new Set<string>());
  const loaded = useRef(false);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  const push = useCallback((line: ChatLine) => {
    setLines((prev) => (prev.some((l) => l.id === line.id) ? prev : [line, ...prev].slice(0, MAX_LINES)));
  }, []);

  useEffect(() => {
    if (state !== 'connected' || !client || loaded.current) return;
    loaded.current = true;
    // Whoever is already here has already arrived: someone reconnecting joins again.
    for (const p of client.participants) greeted.current.add(p.identity);
    client
      .getMessages({ limit: 30 })
      .then((history) => {
        const old = history.map(toLine).filter((l): l is ChatLine => l !== null && !blockedRef.current.includes(l.from ?? ''));
        setLines((prev) => [...prev.filter((l) => l.id !== 'welcome'), ...old.reverse(), WELCOME].slice(0, MAX_LINES));
      })
      .catch(() => {});
  }, [client, state]);

  useVoltkitEvent('message', (m) => {
    if (blockedRef.current.includes(m.from)) return;
    const line = toLine(m);
    if (line) push(line);
  });
  useVoltkitEvent('messageDeleted', ({ id }) => setLines((prev) => prev.filter((l) => l.id !== id)));

  // A name comes with the join. A client that sets it afterwards sends it just after, as an update.
  const greet = (identity: string, metadata: unknown) => {
    const name = (metadata as { name?: string } | undefined)?.name;
    if (!name || identity === selfId || greeted.current.has(identity)) return;
    greeted.current.add(identity);
    push({ id: `joined-${identity}-${Date.now()}`, kind: 'notice', text: `${name} joined` });
  };
  useVoltkitEvent('participantJoined', ({ identity, metadata }) => greet(identity, metadata));
  useVoltkitEvent('participantUpdated', ({ identity, metadata }) => greet(identity, metadata));

  return (
    <FlatList
      testID="room-chat"
      style={style}
      data={lines}
      inverted
      keyExtractor={(l) => l.id}
      renderItem={({ item }) => <Line line={item} onPress={onPressLine} />}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={5}
      contentContainerStyle={{ paddingHorizontal: 10, gap: 5, paddingBottom: 6 }}
    />
  );
});

const styles = StyleSheet.create({
  notice: { alignSelf: 'flex-start', maxWidth: '92%', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: 'rgba(0,0,0,0.42)' },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  text: { color: colors.white, flexShrink: 1 },
});
