import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api } from '../api/client';
import { useSocketEvent } from '../api/socket';
import { ART, coverSource } from '../assets';
import { Avatar, BuiltWith, Chip, GradientButton, IconName, LivePill, T, Wordmark } from '../components/ui';
import { VOLTKIT } from '../config';
import { compact } from '../lib/format';
import type { RootStack } from '../navigation';
import { useGuest } from '../state/session';
import { colors, gradients, radius } from '../theme';
import type { Room, RoomType } from '../types';

type Filter = 'all' | RoomType;
const FILTERS: { id: Filter; label: string; icon: IconName }[] = [
  { id: 'all', label: 'All live', icon: 'flame' },
  { id: 'video', label: 'Video', icon: 'videocam' },
  { id: 'audio', label: 'Audio', icon: 'mic' },
];

function Equalizer() {
  const bars = useRef([new Animated.Value(0.4), new Animated.Value(0.9), new Animated.Value(0.6)]).current;
  useEffect(() => {
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 300 + i * 120, useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.3, duration: 340 + i * 90, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [bars]);
  return (
    <View style={styles.eq}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={[styles.eqBar, { transform: [{ scaleY: b }] }]} />
      ))}
    </View>
  );
}

const RoomCard = memo(function RoomCard({ room, onPress }: { room: Room; onPress: (room: Room) => void }) {
  return (
    <Pressable
      testID={`room-card-${room.type}`}
      accessibilityRole="button"
      accessibilityLabel={`${room.type} room, ${room.title}, hosted by ${room.host.name}, ${room.viewers} people`}
      onPress={() => onPress(room)}
      style={({ pressed }) => [styles.card, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <View style={styles.cardImage}>
        <Image source={coverSource(room.theme)} style={styles.cardCover} fadeDuration={0} />
        <LinearGradient colors={['rgba(5,3,9,0.35)', 'transparent', 'rgba(5,3,9,0.95)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.cardTop}>
          <LivePill />
          <Chip icon="people" label={compact(room.viewers)} />
        </View>
        <View style={styles.cardCenter}>
          <Avatar avatar={room.host.avatar} frame={room.host.frame} size={58} />
        </View>
        <View style={styles.cardBottom}>
          <View style={styles.cardKind}>
            <Ionicons name={room.type === 'video' ? 'videocam' : 'mic'} size={13} color={room.type === 'video' ? colors.pink : colors.cyan} />
            {room.type === 'audio' && <Equalizer />}
            <T variant="tiny" style={{ color: colors.textDim }}>
              {room.type === 'video' ? 'Video room' : 'Audio room'}
            </T>
          </View>
          <T variant="heading" numberOfLines={1}>
            {room.title}
          </T>
          <T variant="small" numberOfLines={1} style={{ color: colors.textDim }}>
            {room.host.name}
          </T>
        </View>
      </View>
    </Pressable>
  );
});

function QuickAction({ icon, title, hint, tint, onPress, testID }: { icon: IconName; title: string; hint: string; tint: readonly [string, string]; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.quick, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={colors.white} />
      </LinearGradient>
      <T variant="small" numberOfLines={1}>
        {title}
      </T>
      <T variant="tiny" numberOfLines={1} style={{ color: colors.textFaint }}>
        {hint}
      </T>
    </Pressable>
  );
}

function Hero({ onLearn }: { onLearn: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={VOLTKIT.poweredBy} onPress={onLearn}>
      <LinearGradient colors={['#2A1159', '#5B1FA8', '#C026D3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="title">Your room.</T>
          <T variant="title">Your layout.</T>
          <T variant="small" style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
            {VOLTKIT.demoLine}
          </T>
          <View style={styles.heroLink}>
            <T variant="tiny" style={{ color: colors.gold }}>
              Build yours at voltkit.in
            </T>
            <Ionicons name="arrow-forward" size={12} color={colors.gold} />
          </View>
        </View>
        <Image source={ART.crown} style={styles.heroArt} fadeDuration={0} />
      </LinearGradient>
    </Pressable>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const insets = useSafeAreaInsets();
  const guest = useGuest();
  const [filter, setFilter] = useState<Filter>('all');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [online, setOnline] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, stats] = await Promise.all([api.rooms(), api.stats()]);
      setRooms(list.rooms);
      setOnline(stats.online);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the rooms.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useSocketEvent('rooms:changed', () => void load());
  // Once the live connection is up, and after each reconnect: the count includes this phone, and rooms missed while
  // offline appear.
  useSocketEvent('connect', () => void load());

  const pull = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = useCallback((room: Room) => navigation.navigate('Room', { roomId: room.id }), [navigation]);
  const shown = filter === 'all' ? rooms : rooms.filter((r) => r.type === filter);

  const header = (
    <View style={{ gap: 14, paddingBottom: 12 }}>
      <View style={styles.top}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Image source={ART.mark} style={{ width: 32, height: 32 }} fadeDuration={0} />
          <Wordmark size={23} />
          <T variant="heading" style={{ color: colors.textDim }}>
            Live
          </T>
        </View>
        <View style={{ flex: 1 }} />
        {online !== null && (
          <View style={styles.online}>
            <View style={styles.onlineDot} />
            <T variant="tiny">{compact(online)} online</T>
          </View>
        )}
        <View style={styles.coins}>
          <Ionicons name="logo-bitcoin" size={14} color={colors.gold} />
          <T variant="tiny" style={{ color: colors.gold }}>
            {compact(guest.coins)}
          </T>
        </View>
      </View>

      <Hero onLearn={() => navigation.navigate('VoltKit')} />

      <View style={styles.quickRow}>
        <QuickAction testID="go-video" icon="videocam" title="Go live" hint="Video room" tint={gradients.video} onPress={() => navigation.navigate('Create', { type: 'video' })} />
        <QuickAction testID="go-audio" icon="mic" title="Audio room" hint="Seats and voices" tint={gradients.audio} onPress={() => navigation.navigate('Create', { type: 'audio' })} />
        <QuickAction testID="go-match" icon="shuffle" title="1v1 Face" hint="Meet someone" tint={gradients.match} onPress={() => navigation.navigate('Match')} />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <Pressable key={f.id} testID={`filter-${f.id}`} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={f.label} onPress={() => setFilter(f.id)} style={[styles.filter, on && styles.filterOn]}>
              <Ionicons name={f.icon} size={13} color={on ? colors.white : colors.textDim} />
              <T variant="small" style={{ color: on ? colors.white : colors.textDim }}>
                {f.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const empty = !loaded ? undefined : (
    <View style={styles.empty} testID="home-empty">
      {error ? (
        <>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textDim} />
          <T style={{ color: colors.textDim, textAlign: 'center' }}>{error}</T>
          <GradientButton label="Try again" onPress={() => void load()} />
        </>
      ) : (
        <>
          <Ionicons name="radio-outline" size={42} color={colors.magenta} />
          <T variant="heading">Nobody is live right now</T>
          <T style={{ color: colors.textDim, textAlign: 'center' }}>Start the first room and be the one others find.</T>
          <GradientButton testID="home-empty-create" label="Go live" icon="radio" onPress={() => navigation.navigate('Create', { type: filter === 'audio' ? 'audio' : 'video' })} />
        </>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
      <FlatList
        testID="home-list"
        data={shown}
        numColumns={2}
        keyExtractor={(r) => r.id}
        columnWrapperStyle={{ gap: 10 }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<BuiltWith style={{ marginTop: 18 }} />}
        renderItem={({ item }) => <RoomCard room={item} onPress={open} />}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: insets.top + 8, paddingBottom: 110, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={colors.magenta} colors={[colors.magenta]} progressBackgroundColor={colors.plum} />}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        windowSize={7}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  online: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 28, borderRadius: radius.pill, backgroundColor: colors.glass },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, height: 28, borderRadius: radius.pill, backgroundColor: 'rgba(255,215,101,0.12)' },
  hero: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 16, overflow: 'hidden' },
  heroArt: { width: 124, height: 124, marginVertical: -14, marginRight: -6 },
  heroLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quick: { flex: 1, alignItems: 'flex-start', gap: 3, padding: 12, borderRadius: radius.md, backgroundColor: colors.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder },
  quickIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  filters: { flexDirection: 'row', gap: 8 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, height: 34, borderRadius: radius.pill, backgroundColor: colors.glass },
  filterOn: { backgroundColor: colors.purple },
  card: { flex: 1, maxWidth: '50%', aspectRatio: 0.74, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.plum, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder },
  cardImage: { flex: 1, justifyContent: 'space-between' },
  cardCover: { position: 'absolute', width: '100%', height: '100%' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 9 },
  cardCenter: { alignItems: 'center' },
  cardBottom: { padding: 11, gap: 1 },
  cardKind: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  eq: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 11 },
  eqBar: { width: 2.5, height: 11, borderRadius: 1, backgroundColor: colors.cyan },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 },
});
