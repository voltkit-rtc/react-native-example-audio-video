import { Ionicons } from '@expo/vector-icons';
import { useVoltkitEvent } from '@voltkit-rtc/react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

const MAX_ON_SCREEN = 12;
const TINTS = [colors.pink, colors.magenta, colors.purple, colors.gold];

const Heart = memo(function Heart({ id, onDone }: { id: number; onDone: (id: number) => void }) {
  const p = useRef(new Animated.Value(0)).current;
  const sway = useRef(10 + Math.random() * 30).current;
  const side = useRef(Math.random() > 0.5 ? 1 : -1).current;
  const tint = useRef(TINTS[id % TINTS.length]).current;
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onDone(id));
  }, [p, id, onDone]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        opacity: p.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
        transform: [
          { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, -280] }) },
          { translateX: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, side * sway, -side * sway * 0.5] }) },
          { scale: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1.15, 0.9] }) },
        ],
      }}
    >
      <Ionicons name="heart" size={30} color={tint} />
    </Animated.View>
  );
});

/** Hearts from everyone. They travel as ephemeral chat messages, which are delivered and never stored. */
export const Reactions = memo(function Reactions() {
  const [hearts, setHearts] = useState<number[]>([]);
  const seq = useRef(0);
  const done = useCallback((id: number) => setHearts((h) => h.filter((x) => x !== id)), []);

  useVoltkitEvent('message', (m) => {
    if (m.type !== 'reaction') return;
    seq.current += 1;
    const id = seq.current;
    setHearts((h) => (h.length >= MAX_ON_SCREEN ? h : [...h, id]));
  });

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {hearts.map((id) => (
        <Heart key={id} id={id} onDone={done} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({ wrap: { position: 'absolute', right: 26, bottom: 96, width: 40, height: 10 } });
