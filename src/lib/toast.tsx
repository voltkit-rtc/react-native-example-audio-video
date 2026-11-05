import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../components/ui';
import { colors, radius } from '../theme';

type Kind = 'info' | 'error' | 'success';
type Listener = (text: string, kind: Kind) => void;

let listener: Listener | null = null;

export const toast = (text: string, kind: Kind = 'info') => listener?.(text, kind);

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<{ text: string; kind: Kind } | null>(null);
  const y = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = (text, kind) => {
      setItem({ text, kind });
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(y, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(y, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => finished && setItem(null));
      }, 2800);
    };
    return () => {
      listener = null;
    };
  }, [y]);

  if (!item) return null;
  const tint = item.kind === 'error' ? colors.danger : item.kind === 'success' ? colors.success : colors.purple;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          opacity: y,
          transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        },
      ]}
    >
      <View style={[styles.toast, { borderColor: tint }]}>
        <T variant="small" style={styles.text}>
          {item.text}
        </T>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 1000 },
  toast: {
    backgroundColor: 'rgba(23,11,46,0.97)',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  text: { color: colors.white, textAlign: 'center' },
});
