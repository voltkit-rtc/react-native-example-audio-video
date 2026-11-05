import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ApiError, api } from '../api/client';
import { giftIcon } from '../assets';
import { Avatar, GradientButton, Sheet, T } from '../components/ui';
import { compact } from '../lib/format';
import { toast } from '../lib/toast';
import { useSession } from '../state/session';
import { colors, gradients, radius } from '../theme';
import type { Gift, Room } from '../types';
import type { Member } from '../rtc/useRoomEngine';

const COUNTS = [1, 5, 10];

let catalog: Gift[] | null = null;
export async function loadCatalog() {
  if (!catalog) catalog = (await api.gifts()).gifts;
  return catalog;
}

export function GiftSheet({
  visible,
  onClose,
  room,
  people,
  initialTo,
}: {
  visible: boolean;
  onClose: () => void;
  room: Room;
  people: Member[];
  initialTo?: string | null;
}) {
  const { guest, setGuest } = useSession();
  const [gifts, setGifts] = useState<Gift[]>(catalog ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    loadCatalog().then(setGifts, () => toast('Could not load the gifts', 'error'));
    setTo(initialTo ?? null);
  }, [visible, initialTo]);

  const target = people.find((p) => p.identity === to) ?? people[0];
  const gift = gifts.find((g) => g.id === selected) ?? gifts[0];
  const cost = (gift?.price ?? 0) * count;
  const short = (guest?.coins ?? 0) < cost;

  async function send() {
    if (!gift || !target) return;
    setBusy(true);
    try {
      const res = await api.sendGift(room.id, gift.id, target.identity, count);
      setGuest(res.guest);
      onClose();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'That gift did not go through.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function topUp() {
    try {
      setGuest((await api.topUp()).guest);
      toast('Demo coins added', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Try again in a moment.', 'error');
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} testID="gift-sheet">
      <View style={styles.head}>
        <T variant="heading">Send a gift</T>
        <Pressable testID="topup" accessibilityRole="button" accessibilityLabel="Get more demo coins" onPress={topUp} style={styles.coins}>
          <Ionicons name="logo-bitcoin" size={15} color={colors.gold} />
          <T variant="small" style={{ color: colors.gold }}>
            {compact(guest?.coins ?? 0)}
          </T>
          <Ionicons name="add-circle" size={17} color={colors.gold} />
        </Pressable>
      </View>
      <T variant="tiny" style={{ color: colors.textFaint, marginBottom: 10 }}>
        Demo coins only. They are free, have no value and cannot be bought or cashed out.
      </T>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        {people.map((p) => {
          const mine = p.identity === guest?.id;
          return (
            <Pressable
              key={p.identity}
              testID={mine ? 'gift-to-me' : `gift-to-${p.identity}`}
              accessibilityRole="button"
              accessibilityLabel={`Send to ${mine ? 'yourself' : p.name}`}
              onPress={() => setTo(p.identity)}
              style={[styles.person, target?.identity === p.identity && styles.personOn]}
            >
              <Avatar avatar={p.avatar} size={24} />
              <T variant="tiny" numberOfLines={1} style={{ maxWidth: 90 }}>
                {mine ? `${p.name} (you)` : p.name}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.grid}>
        {gifts.map((g) => {
          const on = gift?.id === g.id;
          return (
            <Pressable
              key={g.id}
              testID={`gift-${g.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${g.name}, ${g.price} demo coins`}
              onPress={() => setSelected(g.id)}
              style={[styles.gift, on && styles.giftOn]}
            >
              <Image source={giftIcon(g.icon)} style={styles.giftImg} fadeDuration={0} />
              <T variant="tiny" numberOfLines={1}>
                {g.name}
              </T>
              <View style={styles.price}>
                <Ionicons name="logo-bitcoin" size={10} color={colors.gold} />
                <T variant="tiny" style={{ color: colors.gold }}>
                  {compact(g.price)}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.foot}>
        <View style={styles.counts}>
          {COUNTS.map((c) => (
            <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Send ${c}`} onPress={() => setCount(c)} style={[styles.count, count === c && styles.countOn]}>
              <T variant="small">×{c}</T>
            </Pressable>
          ))}
        </View>
        <GradientButton
          testID="gift-send"
          label={short ? 'Not enough coins' : `Send · ${compact(cost)}`}
          disabled={short || !target || !gift}
          loading={busy}
          onPress={send}
          colorsOverride={gradients.accent}
          style={{ flex: 1 }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.glass },
  person: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingRight: 10, height: 34, borderRadius: radius.pill, backgroundColor: colors.glass, borderWidth: 1, borderColor: 'transparent' },
  personOn: { borderColor: colors.magenta, backgroundColor: 'rgba(217,70,239,0.2)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gift: { width: '23%', flexGrow: 1, maxWidth: '24.2%', alignItems: 'center', paddingVertical: 8, gap: 2, borderRadius: radius.md, backgroundColor: colors.glass, borderWidth: 1, borderColor: 'transparent' },
  giftOn: { borderColor: colors.gold, backgroundColor: 'rgba(255,215,101,0.1)' },
  giftImg: { width: 54, height: 54 },
  price: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  counts: { flexDirection: 'row', gap: 4 },
  count: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass },
  countOn: { backgroundColor: colors.purple },
});
