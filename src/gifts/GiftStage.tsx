import { SvgaCache, SvgaPlayer } from '@dasimems/react-native-svga';
import { useVoltkitEvent } from '@voltkit-rtc/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, StyleSheet, View } from 'react-native';
import { giftIcon } from '../assets';
import { Avatar, T } from '../components/ui';
import { assetUrl } from '../config';
import { colors, fill, radius } from '../theme';
import type { Frame } from '../types';
import { GiftQueue, type StageItem } from './queue';

/** Gets the catalog's animations on disk before the first gift, so nothing has to wait for a download. */
export function preloadGifts(urls: string[]) {
  SvgaCache.preload(urls.map(assetUrl)).catch(() => {
    // A file that did not arrive is fetched when it is played, or falls back to its icon.
  });
}

const Fallback = memo(function Fallback({ icon, onDone }: { icon: string; onDone: () => void }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(p, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(p, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(onDone);
  }, [p, onDone]);
  return (
    <View style={styles.full} pointerEvents="none">
      <Animated.Image source={giftIcon(icon)} style={{ width: 200, height: 200, opacity: p, transform: [{ scale: p }] }} fadeDuration={0} />
    </View>
  );
});

function Banner({ item }: { item: Extract<StageItem, { kind: 'gift' }> }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [x]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        { opacity: x, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-220, 0] }) }] },
      ]}
    >
      <LinearGradient colors={['rgba(139,92,246,0.95)', 'rgba(236,72,153,0.82)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bannerInner}>
        <View style={{ flexShrink: 1 }}>
          <T variant="small" numberOfLines={1}>
            {item.fromName}
          </T>
          <T variant="tiny" numberOfLines={1} style={{ color: colors.gold }}>
            sent {item.giftName} to {item.toName}
          </T>
        </View>
        <Image source={giftIcon(item.icon)} style={styles.bannerGift} fadeDuration={0} />
        {item.count > 1 && (
          <T variant="heading" style={{ color: colors.gold }}>
            ×{item.count}
          </T>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

function EntranceName({ name, frame }: { name: string; frame: Frame }) {
  return (
    <View style={styles.entrance} pointerEvents="none">
      <Avatar frame={frame === 'none' ? 'lion' : frame} size={40} avatar={undefined} />
      <T variant="heading" numberOfLines={1} style={styles.entranceText}>
        {name}
      </T>
      <T variant="tiny" style={{ color: colors.gold }}>
        has arrived
      </T>
    </View>
  );
}

/**
 * Plays gifts and entrances one at a time over the room. Everything arrives as a VoltKit chat message sent
 * by the backend. A file that cannot be played falls back to the gift's icon, and a stall skips ahead, so a
 * bad animation can never hold up the queue.
 */
export const GiftStage = memo(function GiftStage() {
  const queue = useRef(new GiftQueue()).current;
  const [item, setItem] = useState<StageItem | null>(null);
  const [failed, setFailed] = useState(false);

  const next = useCallback(() => {
    setFailed(false);
    setItem(queue.next());
  }, [queue]);

  const add = useCallback(
    (entry: StageItem) => {
      queue.push(entry);
      setItem((current) => current ?? queue.next());
    },
    [queue],
  );

  useVoltkitEvent('message', (m) => {
    const meta = (m.metadata ?? {}) as Record<string, any>;
    if (m.type === 'gift' && meta.svgaUrl) {
      add({
        kind: 'gift',
        id: m.id,
        url: assetUrl(meta.svgaUrl),
        icon: meta.icon ?? meta.giftId,
        fromName: meta.fromName ?? 'Someone',
        toName: meta.toName ?? 'the host',
        giftName: meta.giftName ?? 'a gift',
        count: meta.count ?? 1,
        tier: meta.tier ?? 'basic',
      });
    } else if (m.type === 'entrance' && meta.svgaUrl) {
      add({ kind: 'entrance', id: m.id, url: assetUrl(meta.svgaUrl), name: meta.name ?? 'Guest', frame: meta.frame ?? 'none' });
    }
  });

  // onFinish never comes for a player that was paused or stalled.
  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(next, 9000);
    return () => clearTimeout(timer);
  }, [item, next]);

  // The player pauses in the background, so anything queued is stale by the time the app returns.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        queue.clear();
        setItem(null);
        setFailed(false);
      }
    });
    return () => sub.remove();
  }, [queue]);

  if (!item) return null;
  const isGift = item.kind === 'gift';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="gift-stage">
      {failed && isGift ? (
        <Fallback key={item.id} icon={item.icon} onDone={next} />
      ) : (
        <View style={isGift ? styles.full : styles.entranceWrap}>
          <SvgaPlayer
            key={item.id}
            source={item.url}
            loops={1}
            style={isGift ? styles.movie : styles.entranceMovie}
            onFinish={next}
            onError={(message) => {
              console.warn('svga failed:', message);
              if (isGift) setFailed(true);
              else next();
            }}
          />
        </View>
      )}
      {isGift ? <Banner key={`b${item.id}`} item={item} /> : <EntranceName name={item.name} frame={item.frame} />}
    </View>
  );
});

const styles = StyleSheet.create({
  full: { ...fill, alignItems: 'center', justifyContent: 'center' },
  movie: { width: '100%', aspectRatio: 1 },
  entranceWrap: { position: 'absolute', left: 0, right: 0, top: '30%', alignItems: 'center' },
  entranceMovie: { width: '100%', aspectRatio: 750 / 320 },
  entrance: { position: 'absolute', left: 0, right: 0, top: '37%', alignItems: 'center', gap: 2 },
  entranceText: { color: colors.white, marginTop: 8, textShadowColor: '#000', textShadowRadius: 6 },
  banner: { position: 'absolute', left: 10, top: '42%', maxWidth: '76%' },
  bannerInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 8, paddingVertical: 6, borderRadius: radius.pill },
  bannerGift: { width: 34, height: 34 },
});
