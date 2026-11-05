import { VideoTrack, useIsSpeaking, useStreamFallback, type RemoteTrack } from '@voltkit-rtc/react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { CRESTS } from '../../assets';
import { videoLayout, type Rect } from '../../rtc/layout';
import { allSeats, seatNumber } from '../../rtc/seats';
import type { Member, RoomEngine } from '../../rtc/useRoomEngine';
import { colors, fill, gradients, radius } from '../../theme';
import type { Frame, Role } from '../../types';
import { Avatar, RoleBadge, T } from '../ui';

const SpeakingEdge = memo(function SpeakingEdge({ identity, host }: { identity: string; host: boolean }) {
  const speaking = useIsSpeaking(identity);
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.edge,
        host && { borderColor: 'rgba(255,215,101,0.75)' },
        speaking && { borderColor: colors.cyan, borderWidth: 2.5, boxShadow: `0 0 14px ${colors.cyan}` },
      ]}
    />
  );
});

/**
 * producerId turns on adaptive video: this view receives the copy that fits its size, and pauses when hidden.
 * useStreamFallback says when a viewer's connection cannot carry the video, so the card can say so.
 */
function RemoteVideo({ track, compact }: { track: RemoteTrack; compact: boolean }) {
  const held = useStreamFallback(track.producerId);
  return (
    <>
      <VideoTrack track={track.track} producerId={track.producerId} objectFit="cover" style={StyleSheet.absoluteFill} />
      {held && !compact && (
        <View style={styles.weak}>
          <T variant="tiny">Weak connection</T>
        </View>
      )}
    </>
  );
}

interface CardProps {
  rect: Rect;
  seatLabel?: string;
  identity?: string;
  name?: string;
  avatar?: string;
  frame?: Frame;
  role?: Role;
  host?: boolean;
  micOn?: boolean;
  remote?: RemoteTrack;
  localTrack?: unknown;
  mirror?: boolean;
  away?: boolean;
  locked?: boolean;
  onPress: () => void;
  testID?: string;
}

const VideoCard = memo(function VideoCard({
  rect,
  seatLabel,
  identity,
  name,
  avatar,
  frame = 'none',
  role,
  host,
  micOn,
  remote,
  localTrack,
  mirror,
  away,
  locked,
  onPress,
  testID,
}: CardProps) {
  const compact = rect.w < 150;
  const filled = Boolean(identity);
  const showVideo = Boolean(localTrack) || Boolean(remote && !remote.paused);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={filled ? `${name}, ${role}` : locked ? `${seatLabel}, locked` : `${seatLabel}, empty`}
      onPress={onPress}
      style={[styles.card, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}
    >
      {filled ? (
        <>
          <LinearGradient colors={host ? ['#3B2A08', '#170B2E'] : ['#241243', '#0D0720']} style={StyleSheet.absoluteFill} />
          <View style={styles.center}>
            <Avatar avatar={avatar} size={Math.min(rect.w, rect.h) * (compact ? 0.42 : 0.34)} />
          </View>
          {remote && !remote.paused && <RemoteVideo track={remote} compact={compact} />}
          {localTrack ? <VideoTrack track={localTrack as never} mirror={mirror} objectFit="cover" style={StyleSheet.absoluteFill} /> : null}
          {away && <View style={styles.away} />}
          {identity && <SpeakingEdge identity={identity} host={Boolean(host)} />}
          {frame !== 'none' && showVideo && <Image source={CRESTS[frame]} style={[styles.crest, compact && styles.crestSmall]} fadeDuration={0} />}
          <LinearGradient colors={gradients.scrimBottom} style={styles.nameScrim} pointerEvents="none" />
          <View style={styles.nameRow} pointerEvents="none">
            <View style={[styles.micDot, !micOn && { backgroundColor: colors.danger }]}>
              <Ionicons name={micOn ? 'mic' : 'mic-off'} size={10} color={colors.white} />
            </View>
            <T variant="tiny" numberOfLines={1} style={styles.name}>
              {away ? 'Reconnecting…' : name}
            </T>
          </View>
          <View style={styles.badge} pointerEvents="none">
            {role && <RoleBadge role={role} />}
          </View>
        </>
      ) : (
        <View style={[styles.center, styles.emptyCard]}>
          <Ionicons name={locked ? 'lock-closed' : 'add'} size={compact ? 22 : 28} color={colors.textDim} />
          <T variant="tiny" style={{ color: colors.textFaint }}>
            {seatLabel}
          </T>
        </View>
      )}
    </Pressable>
  );
});

export function VideoStage({
  engine,
  width,
  height,
  onMember,
  onSeat,
}: {
  engine: RoomEngine;
  width: number;
  height: number;
  onMember: (identity: string) => void;
  onSeat: (key: string) => void;
}) {
  const { room, me, local, claims, locked, memberById, videoById, micIsOn } = engine;
  const rects = useMemo(() => videoLayout(room.seats, engine.layout, width, height), [room.seats, engine.layout, width, height]);
  const keys = useMemo(() => allSeats(engine.seats), [engine.seats]);
  const camera = local.camEnabled ? local.stream?.getVideoTracks()[0] : undefined;

  const person = (member: Member | undefined, fallback?: { id: string; name: string; avatar: string; frame: Frame }) => {
    const identity = member?.identity ?? fallback?.id;
    if (!identity) return {};
    const mine = identity === me.id;
    return {
      identity,
      name: mine ? `${member?.name ?? me.name} (you)` : (member?.name ?? fallback?.name),
      avatar: member?.avatar ?? fallback?.avatar,
      frame: member?.frame ?? fallback?.frame,
      role: member?.role,
      micOn: micIsOn(identity),
      remote: mine ? undefined : videoById.get(identity),
      localTrack: mine ? camera : undefined,
      mirror: mine && local.facingMode === 'user',
    };
  };

  return (
    <View style={{ width, height }}>
      <VideoCard
        key="host"
        testID="video-card-host"
        host
        rect={rects[0]}
        seatLabel="Host"
        {...person(memberById.get(room.host.id), room.host)}
        role="host"
        onPress={() => onMember(room.host.id)}
      />
      {keys.map((key, i) => {
        const claim = claims[key];
        const n = seatNumber(key);
        return (
          <VideoCard
            key={key}
            testID={`video-card-${key}`}
            rect={rects[i + 1]}
            seatLabel={`No.${n}`}
            locked={locked.has(key)}
            away={claim?.state === 'away'}
            {...(claim ? person(memberById.get(claim.identity), { id: claim.identity, name: 'Guest', avatar: 'a01', frame: 'none' }) : {})}
            onPress={() => (claim ? onMember(claim.identity) : onSeat(key))}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', borderRadius: radius.sm, overflow: 'hidden' },
  center: { ...fill, alignItems: 'center', justifyContent: 'center', gap: 4 },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    borderStyle: 'dashed',
    borderRadius: radius.sm,
  },
  edge: { borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  away: { ...fill, backgroundColor: 'rgba(0,0,0,0.55)' },
  weak: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  crest: { position: 'absolute', top: 4, right: 4, width: 42, height: 42 },
  crestSmall: { width: 28, height: 28, top: 2, right: 2 },
  nameScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44 },
  nameRow: { position: 'absolute', left: 6, right: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  micDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' },
  name: { color: colors.white, flex: 1 },
  badge: { position: 'absolute', top: 6, left: 6 },
});
