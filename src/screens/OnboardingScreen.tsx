import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { ART, AVATAR_KEYS } from '../assets';
import { Avatar, BuiltWith, GradientButton, T, Wordmark } from '../components/ui';
import { VOLTKIT } from '../config';
import { useKeyboardHeight } from '../lib/keyboard';
import { useSession } from '../state/session';
import { colors, fonts, radius } from '../theme';

const SUGGESTIONS = ['Star', 'Nova', 'Echo', 'Blaze', 'Luna', 'Orbit', 'Pixel', 'Comet'];
const suggestName = () => `${SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)]}${Math.floor(100 + Math.random() * 900)}`;

export function OnboardingScreen() {
  const { start } = useSession();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const [name, setName] = useState(suggestName);
  const [avatar, setAvatar] = useState(() => AVATAR_KEYS[Math.floor(Math.random() * AVATAR_KEYS.length)]);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = name.trim().length >= 2 && adult;

  async function enter() {
    setBusy(true);
    setError(null);
    try {
      await start(name.trim(), avatar);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not get you in. Try again.');
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, keyboard) + 14 }]}>
      <LinearGradient colors={['#2A1159', colors.plum, colors.bg]} style={StyleSheet.absoluteFill} />
      <View style={styles.brand}>
        <Image source={ART.mark} style={styles.mark} fadeDuration={0} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Wordmark size={34} />
          <T variant="title" style={{ color: colors.textDim }}>
            {VOLTKIT.appSuffix}
          </T>
        </View>
        <T variant="medium" style={{ color: colors.white, textAlign: 'center' }}>
          {VOLTKIT.demoLine}
        </T>
        <T style={{ color: colors.textDim, textAlign: 'center' }}>{VOLTKIT.tagline}</T>
      </View>

      <View style={styles.form}>
        <T variant="small" style={{ color: colors.textDim }}>
          Pick an avatar
        </T>
        <FlatList
          horizontal
          data={AVATAR_KEYS}
          keyExtractor={(k) => k}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`Avatar ${item}`} onPress={() => setAvatar(item)} style={[styles.pick, avatar === item && styles.pickOn]}>
              <Avatar avatar={item} size={56} />
            </Pressable>
          )}
        />

        <T variant="small" style={{ color: colors.textDim, marginTop: 8 }}>
          Your name
        </T>
        <TextInput
          testID="onboarding-name"
          value={name}
          onChangeText={setName}
          maxLength={24}
          placeholder="What should people call you?"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
        />

        <Pressable testID="onboarding-age" accessibilityRole="checkbox" accessibilityState={{ checked: adult }} accessibilityLabel="I am 18 or older" onPress={() => setAdult(!adult)} style={styles.check}>
          <View style={[styles.box, adult && styles.boxOn]}>{adult && <Ionicons name="checkmark" size={16} color={colors.white} />}</View>
          <T variant="small" style={{ color: colors.textDim, flex: 1 }}>
            I am 18 or older, and I will be kind. People who break the rules get removed.
          </T>
        </Pressable>

        {error && (
          <T variant="small" style={{ color: colors.danger }}>
            {error}
          </T>
        )}
        <GradientButton testID="onboarding-enter" label="Enter" icon="arrow-forward" disabled={!ok} loading={busy} onPress={enter} style={{ marginTop: 8 }} />
        <T variant="tiny" style={{ color: colors.textFaint, textAlign: 'center' }}>
          No account, no password. You are a guest on this phone.
        </T>
      </View>

      <BuiltWith />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, justifyContent: 'space-between' },
  brand: { alignItems: 'center', gap: 6, marginTop: 12 },
  mark: { width: 88, height: 88 },
  form: { gap: 6 },
  pick: { borderRadius: 34, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  pickOn: { borderColor: colors.magenta },
  input: {
    height: 50,
    borderRadius: radius.md,
    paddingHorizontal: 15,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: 16,
  },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.textDim, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.purple, borderColor: colors.purple },
});
