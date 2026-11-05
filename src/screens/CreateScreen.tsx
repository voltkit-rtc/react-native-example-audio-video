import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api } from '../api/client';
import { THEME_KEYS, coverSource } from '../assets';
import { GradientButton, IconButton, PoweredBy, T } from '../components/ui';
import { useKeyboardHeight } from '../lib/keyboard';
import { toast } from '../lib/toast';
import type { Screen } from '../navigation';
import { useMediaConsent } from '../rtc/consent';
import { useGuest } from '../state/session';
import { colors, fonts, gradients, radius } from '../theme';
import type { RoomLayout, RoomType, SeatMode } from '../types';

const SEATS: Record<RoomType, number[]> = { video: [4, 6, 9], audio: [8, 10, 15] };

function Option({ label, on, onPress, testID }: { label: string; on: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={onPress} style={[styles.option, on && styles.optionOn]}>
      <T variant="small" style={{ color: on ? colors.white : colors.textDim }}>
        {label}
      </T>
    </Pressable>
  );
}

export function CreateScreen({ navigation, route }: Screen<'Create'>) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const guest = useGuest();
  const ask = useMediaConsent();
  const [type, setType] = useState<RoomType>(route.params?.type ?? 'video');
  const [title, setTitle] = useState(`${guest.name}'s room`);
  const [theme, setTheme] = useState('royal');
  const [seats, setSeats] = useState(SEATS[route.params?.type ?? 'video'][1]);
  const [seatMode, setSeatMode] = useState<SeatMode>('request');
  const [layout, setLayout] = useState<RoomLayout>('stage');
  const [busy, setBusy] = useState(false);

  function pickType(next: RoomType) {
    setType(next);
    setSeats(SEATS[next][1]);
  }

  async function goLive() {
    if (title.trim().length < 3) return toast('Give your room a title of at least 3 characters.', 'error');
    setBusy(true);
    try {
      if (!(await ask(type))) return;
      const { room, credentials } = await api.createRoom({ type, title: title.trim(), theme, seats, seatMode, layout });
      navigation.replace('Room', { roomId: room.id, initial: { room, credentials } });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not start the room.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: Math.max(keyboard, insets.bottom) + 20, gap: 8 }}
      >
        <View style={styles.top}>
          <IconButton testID="create-close" size={40} icon="chevron-back" label="Back" onPress={() => navigation.goBack()} />
          <T variant="title">Start a room</T>
        </View>

        <View style={styles.typeRow}>
          {(['video', 'audio'] as const).map((t) => {
            const on = type === t;
            return (
              <Pressable key={t} testID={`create-type-${t}`} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${t} room`} onPress={() => pickType(t)} style={{ flex: 1 }}>
                <LinearGradient colors={on ? (t === 'video' ? gradients.video : gradients.audio) : gradients.panel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.type}>
                  <Ionicons name={t === 'video' ? 'videocam' : 'mic'} size={26} color={colors.white} />
                  <T variant="heading">{t === 'video' ? 'Video room' : 'Audio room'}</T>
                  <T variant="tiny" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {t === 'video' ? 'Cards for you and co-hosts' : 'A throne and numbered seats'}
                  </T>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        <T variant="small" style={styles.label}>
          Title
        </T>
        <TextInput testID="create-title" value={title} onChangeText={setTitle} maxLength={48} placeholder="What is this room about?" placeholderTextColor={colors.textFaint} style={styles.input} />

        <T variant="small" style={styles.label}>
          Backdrop
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {THEME_KEYS.map((key) => (
            <Pressable key={key} accessibilityRole="radio" accessibilityState={{ selected: theme === key }} accessibilityLabel={`${key} backdrop`} onPress={() => setTheme(key)}>
              <Image source={coverSource(key)} style={[styles.theme, theme === key && styles.themeOn]} fadeDuration={0} />
            </Pressable>
          ))}
        </ScrollView>

        <T variant="small" style={styles.label}>
          {type === 'video' ? 'Video cards, including yours' : 'Seats on stage'}
        </T>
        <View style={styles.options}>
          {SEATS[type].map((n) => (
            <Option key={n} testID={`create-seats-${n}`} label={String(n)} on={seats === n} onPress={() => setSeats(n)} />
          ))}
        </View>

        {type === 'video' && (
          <>
            <T variant="small" style={styles.label}>
              Layout
            </T>
            <View style={styles.options}>
              <Option label="Stage" on={layout === 'stage'} onPress={() => setLayout('stage')} />
              <Option label="Grid" on={layout === 'grid'} onPress={() => setLayout('grid')} />
            </View>
          </>
        )}

        <T variant="small" style={styles.label}>
          Who gets on stage
        </T>
        <View style={styles.options}>
          <Option testID="create-mode-request" label="I approve each person" on={seatMode === 'request'} onPress={() => setSeatMode('request')} />
          <Option testID="create-mode-open" label="Anyone can take a seat" on={seatMode === 'open'} onPress={() => setSeatMode('open')} />
        </View>

        <GradientButton testID="create-go" label={type === 'video' ? 'Go live' : 'Open the room'} icon="radio" loading={busy} onPress={goLive} style={{ marginTop: 14 }} />
        <PoweredBy style={{ marginTop: 10 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  typeRow: { flexDirection: 'row', gap: 10 },
  type: { padding: 14, borderRadius: radius.lg, gap: 3, minHeight: 112, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder },
  label: { color: colors.textDim, marginTop: 10 },
  input: { height: 50, borderRadius: radius.md, paddingHorizontal: 15, backgroundColor: colors.glass, color: colors.white, fontFamily: fonts.medium, fontSize: 16 },
  theme: { width: 76, height: 100, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' },
  themeOn: { borderColor: colors.gold },
  options: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  option: { paddingHorizontal: 16, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass },
  optionOn: { backgroundColor: colors.purple },
});
