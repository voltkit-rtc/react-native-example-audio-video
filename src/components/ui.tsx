import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useReducer, useRef, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ART, avatarSource, FRAMES } from '../assets';
import { VOLTKIT } from '../config';
import { useKeyboardHeight } from '../lib/keyboard';
import { colors, fonts, gradients, radius } from '../theme';
import type { Frame } from '../types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

const VARIANTS = {
  display: { fontFamily: fonts.black, fontSize: 30, lineHeight: 36 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  medium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  tiny: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
} satisfies Record<string, TextStyle>;

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: keyof typeof VARIANTS }) {
  return <Text allowFontScaling={false} style={[{ color: colors.text }, VARIANTS[variant], style]} {...rest} />;
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <Text allowFontScaling={false} style={{ fontFamily: fonts.black, fontSize: size, color: colors.white, letterSpacing: -0.4 }}>
      Volt<Text style={{ color: colors.cyan }}>Kit</Text>
    </Text>
  );
}

export function GradientButton({
  label,
  icon,
  onPress,
  disabled,
  loading,
  colorsOverride,
  dark,
  style,
  testID,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  colorsOverride?: readonly [string, string, ...string[]];
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const ink = dark ? '#201000' : colors.white;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      <LinearGradient colors={colorsOverride ?? gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
        {loading ? (
          <ActivityIndicator color={ink} />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={19} color={ink} />}
            <T variant="heading" style={{ color: ink }}>
              {label}
            </T>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({
  label,
  icon,
  onPress,
  danger,
  style,
  testID,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const tint = danger ? colors.danger : colors.white;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.ghost, { opacity: pressed ? 0.7 : 1 }, style]}
    >
      {icon && <Ionicons name={icon} size={18} color={tint} />}
      <T variant="medium" style={{ color: tint }}>
        {label}
      </T>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 44,
  active,
  danger,
  tint,
  badge,
  disabled,
  style,
  testID,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  active?: boolean;
  danger?: boolean;
  tint?: string;
  badge?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.glassBorder,
          backgroundColor: danger ? colors.danger : active ? colors.purple : colors.glassStrong,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={size * 0.5} color={tint ?? colors.white} />
      {!!badge && (
        <View style={styles.badge}>
          <T variant="tiny" style={{ color: colors.white, fontSize: 10 }}>
            {badge > 9 ? '9+' : badge}
          </T>
        </View>
      )}
    </Pressable>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={gradients.panel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.panel, style]}>
      {children}
    </LinearGradient>
  );
}

export const Avatar = memo(function Avatar({ avatar, frame = 'none', size = 44 }: { avatar?: string; frame?: Frame; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={avatarSource(avatar)} style={{ width: size, height: size, borderRadius: size / 2 }} fadeDuration={0} />
      {frame !== 'none' && (
        <Image
          source={FRAMES[frame]}
          fadeDuration={0}
          style={{ position: 'absolute', width: size * 1.92, height: size * 1.92, left: -size * 0.46, top: -size * 0.46 }}
        />
      )}
    </View>
  );
});

export function Chip({ icon, label, tint, style }: { icon?: IconName; label: string; tint?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.chip, style]}>
      {icon && <Ionicons name={icon} size={12} color={tint ?? colors.white} />}
      <T variant="tiny" style={{ color: tint ?? colors.white }}>
        {label}
      </T>
    </View>
  );
}

export function RoleBadge({ role }: { role: string }) {
  if (role === 'viewer') return null;
  const look =
    role === 'host'
      ? { label: 'HOST', bg: colors.gold, ink: '#201000' }
      : role === 'moderator'
        ? { label: 'MOD', bg: colors.success, ink: '#032016' }
        : { label: 'CO-HOST', bg: colors.purple, ink: colors.white };
  return (
    <View style={[styles.role, { backgroundColor: look.bg }]}>
      <T variant="tiny" style={{ color: look.ink, fontSize: 9, lineHeight: 12 }}>
        {look.label}
      </T>
    </View>
  );
}

export function LiveDot({ size = 7 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.white, opacity: pulse }} />;
}

export function LivePill() {
  return (
    <LinearGradient colors={['#FB3B66', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.live}>
      <LiveDot size={6} />
      <T variant="tiny" style={{ color: colors.white }}>
        LIVE
      </T>
    </LinearGradient>
  );
}

export function PoweredBy({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={VOLTKIT.poweredBy}
      onPress={() => void Linking.openURL(VOLTKIT.site)}
      style={[styles.powered, style]}
    >
      <Image source={ART.mark} style={styles.poweredLogo} fadeDuration={0} />
      <T variant="tiny" style={{ color: colors.textDim }}>
        Powered by{' '}
        <T variant="tiny" style={{ color: colors.white }}>
          VoltKit RTC
        </T>
      </T>
    </Pressable>
  );
}

/** Says what this app is: a React Native demo, running on VoltKit RTC. Both open the page that explains how. */
export function BuiltWith({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.builtRow, style]}>
      <PoweredBy />
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={VOLTKIT.madeWith}
        onPress={() => void Linking.openURL(VOLTKIT.rnPage)}
        style={styles.powered}
      >
        <Ionicons name="logo-react" size={13} color={colors.cyan} />
        <T variant="tiny" style={{ color: colors.textDim }}>
          Made with{' '}
          <T variant="tiny" style={{ color: colors.white }}>
            React Native
          </T>
        </T>
      </Pressable>
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const shown = useRef(new Animated.Value(0)).current;
  const mounted = useMounted(visible, shown);
  if (!mounted) return null;
  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: shown }]}>
        <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <View style={{ flex: 1 }} pointerEvents="box-none" />
      <Animated.View
        testID={testID}
        style={[
          styles.sheet,
          {
            paddingBottom: (keyboard || Math.max(insets.bottom, 14)) + 8,
            transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }],
          },
        ]}
      >
        <View style={styles.grabber} />
        {title && (
          <T variant="heading" style={{ marginBottom: 12 }}>
            {title}
          </T>
        )}
        {children}
      </Animated.View>
    </Modal>
  );
}

/** Keeps a sheet on screen through its closing animation. */
function useMounted(visible: boolean, value: Animated.Value) {
  const mounted = useRef(visible);
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (visible) {
      mounted.current = true;
      force();
      Animated.timing(value, { toValue: 1, duration: 230, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted.current) {
      Animated.timing(value, { toValue: 0, duration: 170, useNativeDriver: true }).start(({ finished }) => {
        if (finished) {
          mounted.current = false;
          force();
        }
      });
    }
  }, [visible, value, force]);
  return mounted.current;
}


export function SheetRow({
  icon,
  label,
  hint,
  onPress,
  danger,
  gold,
  right,
  testID,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
  gold?: boolean;
  right?: ReactNode;
  testID?: string;
}) {
  const tint = danger ? colors.danger : gold ? colors.gold : colors.white;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={19} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <T variant="medium" style={{ color: tint }}>
          {label}
        </T>
        {hint && (
          <T variant="small" style={{ color: colors.textFaint }}>
            {hint}
          </T>
        )}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 52, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 22 },
  ghost: {
    height: 48,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder, padding: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  role: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  powered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  poweredLogo: { width: 14, height: 14 },
  builtRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6 },
  sheet: {
    backgroundColor: colors.plum,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    paddingHorizontal: 18,
    paddingTop: 10,
    maxHeight: '88%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.glassStrong, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass },
});
