import { useIsSpeaking } from '@voltkit-rtc/react-native';
import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ART } from '../../assets';
import { audioColumns } from '../../rtc/layout';
import { allSeats, seatNumber } from '../../rtc/seats';
import type { RoomEngine } from '../../rtc/useRoomEngine';
import { colors } from '../../theme';
import type { Frame } from '../../types';
import { Avatar, T } from '../ui';

const SpeakingRing = memo(function SpeakingRing({ identity, size }: { identity: string; size: number }) {
  const speaking = useIsSpeaking(identity);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!speaking) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [speaking, pulse]);
  if (!speaking) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2.5,
        borderColor: colors.cyan,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
      }}
    />
  );
});

interface SeatProps {
  label: string;
  size: number;
  identity?: string;
  name?: string;
  avatar?: string;
  frame?: Frame;
  micOn?: boolean;
  away?: boolean;
  locked?: boolean;
  width: number;
  onPress: () => void;
  testID?: string;
}

const Seat = memo(function Seat({ label, size, identity, name, avatar, frame, micOn, away, locked, width, onPress, testID }: SeatProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={identity ? `${name}, seat ${label}` : locked ? `Seat ${label}, locked` : `Seat ${label}, empty`}
      onPress={onPress}
      style={[styles.seat, { width }]}
    >
      <View style={[styles.seatCircle, { width: size, height: size, borderRadius: size / 2 }]}>
        {identity ? (
          <>
            <SpeakingRing identity={identity} size={size} />
            <View style={{ opacity: away ? 0.45 : 1 }}>
              <Avatar avatar={avatar} frame={frame} size={size} />
            </View>
            <View style={[styles.mic, !micOn && { backgroundColor: colors.danger }]}>
              <Ionicons name={micOn ? 'mic' : 'mic-off'} size={10} color={colors.white} />
            </View>
          </>
        ) : (
          <View style={[styles.emptyInner, { width: size * 0.66, height: size * 0.66, borderRadius: size * 0.33 }]}>
            <Ionicons name={locked ? 'lock-closed' : 'mic'} size={size * 0.3} color={colors.textDim} />
          </View>
        )}
      </View>
      <T variant="tiny" numberOfLines={1} style={[styles.seatLabel, identity ? { color: colors.white } : null]}>
        {identity ? (away ? 'Reconnecting' : name) : label}
      </T>
    </Pressable>
  );
});

export function AudioStage({
  engine,
  onMember,
  onSeat,
}: {
  engine: RoomEngine;
  onMember: (identity: string) => void;
  onSeat: (key: string) => void;
}) {
  const { width } = useWindowDimensions();
  const { room, claims, locked, memberById, micIsOn } = engine;
  const cols = audioColumns(engine.seats);
  // Whole numbers: cells that add up to the exact width can round over it and wrap a seat onto a new row.
  const cellW = Math.floor((width - 20) / cols);
  const size = Math.min(cellW - 18, 58);
  const keys = useMemo(() => allSeats(engine.seats), [engine.seats]);
  const host = memberById.get(room.host.id);

  return (
    <View>
      <Pressable
        testID="audio-host"
        accessibilityRole="button"
        accessibilityLabel={`Host ${room.host.name}`}
        onPress={() => onMember(room.host.id)}
        style={styles.throneWrap}
      >
        <Image source={ART.throne} style={styles.throne} fadeDuration={0} />
        <View style={styles.hostOnThrone}>
          <SpeakingRing identity={room.host.id} size={60} />
          <Avatar avatar={host?.avatar ?? room.host.avatar} frame={host?.frame ?? room.host.frame} size={60} />
          <View style={[styles.mic, !micIsOn(room.host.id) && { backgroundColor: colors.danger }]}>
            <Ionicons name={micIsOn(room.host.id) ? 'mic' : 'mic-off'} size={10} color={colors.white} />
          </View>
        </View>
        <T variant="small" numberOfLines={1} style={styles.hostName}>
          {host?.name ?? room.host.name}
        </T>
      </Pressable>

      <View style={styles.grid}>
        {keys.map((key) => {
          const claim = claims[key];
          const m = claim ? memberById.get(claim.identity) : undefined;
          return (
            <Seat
              key={key}
              testID={`audio-${key}`}
              width={cellW}
              size={size}
              label={`No.${seatNumber(key)}`}
              identity={claim?.identity}
              name={m?.name ?? 'Guest'}
              avatar={m?.avatar}
              frame={m?.frame}
              micOn={claim ? micIsOn(claim.identity) : false}
              away={claim?.state === 'away'}
              locked={locked.has(key)}
              onPress={() => (claim ? onMember(claim.identity) : onSeat(key))}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  throneWrap: { alignItems: 'center', marginTop: -2 },
  throne: { width: 128, height: 128 },
  hostOnThrone: { position: 'absolute', top: 19, alignItems: 'center', justifyContent: 'center' },
  hostName: { marginTop: -8, color: colors.gold, maxWidth: 180 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 10, marginTop: 10, rowGap: 12 },
  seat: { alignItems: 'center', gap: 5 },
  seatCircle: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(120,170,255,0.35)' },
  emptyInner: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.09)' },
  seatLabel: { color: colors.textDim, maxWidth: 66 },
  mic: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
    borderWidth: 1.5,
    borderColor: colors.plum,
  },
});
