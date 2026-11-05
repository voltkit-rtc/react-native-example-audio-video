import { SDK_VERSION } from '@voltkit-rtc/react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { FlatList, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api } from '../api/client';
import { AVATAR_KEYS } from '../assets';
import { version as APP_VERSION } from '../../package.json';
import { Avatar, BuiltWith, GhostButton, GradientButton, IconButton, Panel, Sheet, SheetRow, T } from '../components/ui';
import { VOLTKIT } from '../config';
import { toast } from '../lib/toast';
import type { RootStack, Screen } from '../navigation';
import { useGuest, useSession } from '../state/session';
import { colors, fonts, gradients, radius } from '../theme';
import type { Frame, GuestPublic } from '../types';

const { major, minor, patch } = Platform.constants.reactNativeVersion;
const RN_VERSION = `${major}.${minor}.${patch}`;

const FRAME_OPTIONS: { id: Frame; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'lion', label: 'Golden Lion' },
  { id: 'wolf', label: 'Silver Wolf' },
];

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const insets = useSafeAreaInsets();
  const guest = useGuest();
  const { setGuest, forget } = useSession();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(guest.name);
  const [avatars, setAvatars] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  async function update(patch: Parameters<typeof api.updateMe>[0]) {
    try {
      setGuest((await api.updateMe(patch)).guest);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'That was not saved.', 'error');
    }
  }

  async function saveName() {
    setSaving(true);
    await update({ name: name.trim() });
    setSaving(false);
    setEditing(false);
  }

  async function topUp() {
    try {
      setGuest((await api.topUp()).guest);
      toast('Demo coins added', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Try again in a moment.', 'error');
    }
  }

  async function deleteAll() {
    setConfirmDelete(false);
    try {
      await api.deleteMe();
      await forget();
    } catch {
      toast('That did not work. Try again.', 'error');
    }
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 120, gap: 12 }} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <Pressable testID="profile-avatar" accessibilityRole="button" accessibilityLabel="Change avatar" onPress={() => setAvatars(true)} style={{ marginVertical: 26 }}>
            <Avatar avatar={guest.avatar} frame={guest.frame} size={92} />
          </Pressable>
          <Pressable testID="profile-name" accessibilityRole="button" accessibilityLabel="Change name" onPress={() => setEditing(true)} style={styles.nameRow}>
            <T variant="title">{guest.name}</T>
            <Ionicons name="pencil" size={15} color={colors.textDim} />
          </Pressable>
          <T variant="tiny" style={{ color: colors.textFaint }}>
            Guest on this phone
          </T>
        </View>

        <Panel>
          <View style={styles.coinRow}>
            <View style={{ flex: 1 }}>
              <T variant="small" style={{ color: colors.textDim }}>
                Demo coins
              </T>
              <T testID="coin-balance" variant="display" style={{ color: colors.gold }}>
                {guest.coins.toLocaleString()}
              </T>
            </View>
            <GradientButton testID="profile-topup" label="Get more" icon="add" dark colorsOverride={gradients.gold} onPress={() => void topUp()} />
          </View>
          <T variant="tiny" style={{ color: colors.textFaint, marginTop: 6 }}>
            Free and fictional. For trying gifts only: they have no value and cannot be bought or cashed out.
          </T>
        </Panel>

        <Panel>
          <T variant="small" style={{ color: colors.textDim, marginBottom: 8 }}>
            Avatar frame
          </T>
          <View style={styles.frames}>
            {FRAME_OPTIONS.map((f) => (
              <Pressable
                key={f.id}
                testID={`frame-${f.id}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: guest.frame === f.id }}
                accessibilityLabel={`${f.label} frame`}
                onPress={() => void update({ frame: f.id })}
                style={[styles.frame, guest.frame === f.id && styles.frameOn]}
              >
                <View style={{ height: 66, justifyContent: 'center' }}>
                  <Avatar avatar={guest.avatar} frame={f.id} size={36} />
                </View>
                <T variant="tiny" numberOfLines={1}>
                  {f.label}
                </T>
              </Pressable>
            ))}
          </View>
          <T variant="tiny" style={{ color: colors.textFaint, marginTop: 8 }}>
            A frame shows on your seat, and plays an entrance effect when you join a room.
          </T>
        </Panel>

        <T variant="small" style={styles.section}>
          Settings
        </T>
        <Panel style={{ paddingVertical: 6 }}>
          <SheetRow testID="profile-blocked" icon="ban-outline" label="Blocked people" onPress={() => navigation.navigate('Blocked')} />
          <SheetRow testID="profile-delete" icon="trash-outline" danger label="Delete my data" hint="Removes this guest and their messages" onPress={() => setConfirmDelete(true)} />
        </Panel>

        <T variant="small" style={styles.section}>
          About this app
        </T>
        <Panel style={{ gap: 4 }}>
          <T variant="heading">{VOLTKIT.demoLine}</T>
          <T variant="small" style={{ color: colors.textDim }}>
            Everything live in here runs on VoltKit RTC: rooms, calls, chat and gifts. Want the same experience in your own app? You can build it with VoltKit.
          </T>
          <BuiltWith style={{ justifyContent: 'flex-start', marginTop: 8 }} />
        </Panel>
        <Panel style={{ paddingVertical: 6 }}>
          <SheetRow testID="about-build" icon="rocket-outline" gold label="Build this into your app" hint="Video, voice, chat and gifts with React Native" onPress={() => void Linking.openURL(VOLTKIT.rnPage)} />
          <SheetRow testID="about-site" icon="globe-outline" label="Go to voltkit.in" hint="All of VoltKit RTC" onPress={() => void Linking.openURL(VOLTKIT.site)} />
          <SheetRow testID="about-docs" icon="logo-react" label="React Native SDK docs" hint="Hooks, components and Expo setup" onPress={() => void Linking.openURL(VOLTKIT.rnDocs)} />
          <SheetRow testID="about-quickstart" icon="flash-outline" label="Quickstart" hint="From sign-up to a working call" onPress={() => void Linking.openURL(VOLTKIT.quickstart)} />
          <SheetRow testID="profile-voltkit" icon="information-circle-outline" label="What this demo shows" onPress={() => navigation.navigate('VoltKit')} />
        </Panel>
        <T testID="about-versions" variant="tiny" style={styles.versions}>
          Version {APP_VERSION}  ·  React Native {RN_VERSION}  ·  VoltKit SDK {SDK_VERSION}
        </T>
      </ScrollView>

      <Sheet visible={avatars} onClose={() => setAvatars(false)} title="Pick an avatar">
        <FlatList
          data={AVATAR_KEYS}
          numColumns={4}
          keyExtractor={(k) => k}
          style={{ flexGrow: 0 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Avatar ${item}`}
              onPress={() => {
                setAvatars(false);
                void update({ avatar: item });
              }}
            >
              <Avatar avatar={item} size={68} />
            </Pressable>
          )}
        />
      </Sheet>

      <Sheet visible={editing} onClose={() => setEditing(false)} title="Your name">
        <TextInput testID="profile-name-input" value={name} onChangeText={setName} maxLength={24} autoFocus style={styles.input} placeholderTextColor={colors.textFaint} />
        <GradientButton testID="profile-name-save" label="Save" loading={saving} disabled={name.trim().length < 2} onPress={() => void saveName()} style={{ marginTop: 12 }} />
      </Sheet>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <View style={{ gap: 10 }}>
          <T variant="title">Delete everything?</T>
          <T style={{ color: colors.textDim }}>This guest, their coins and their direct messages are removed for good. Live rooms you host end.</T>
          <GradientButton testID="profile-delete-yes" label="Delete my data" colorsOverride={['#FB3B66', '#EC4899']} onPress={() => void deleteAll()} style={{ marginTop: 6 }} />
          <GhostButton label="Keep it" onPress={() => setConfirmDelete(false)} />
        </View>
      </Sheet>
    </View>
  );
}

export function BlockedScreen({ navigation }: Screen<'Blocked'>) {
  const insets = useSafeAreaInsets();
  const { refresh } = useSession();
  const [people, setPeople] = useState<GuestPublic[] | null>(null);

  useEffect(() => {
    api.blocks().then((r) => setPeople(r.guests), () => setPeople([]));
  }, []);

  async function unblock(id: string) {
    await api.unblock(id).catch(() => {});
    await refresh().catch(() => {});
    setPeople((list) => list?.filter((p) => p.id !== id) ?? null);
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <IconButton size={38} icon="chevron-back" label="Back" onPress={() => navigation.goBack()} />
        <T variant="title">Blocked people</T>
      </View>
      <FlatList
        data={people ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={people ? <T style={{ color: colors.textDim, textAlign: 'center', marginTop: 30 }}>Nobody is blocked.</T> : undefined}
        renderItem={({ item }) => (
          <View style={styles.blockedRow}>
            <Avatar avatar={item.avatar} size={42} />
            <T variant="medium" numberOfLines={1} style={{ flex: 1 }}>
              {item.name}
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel={`Unblock ${item.name}`} onPress={() => void unblock(item.id)} style={styles.unblock}>
              <T variant="tiny">Unblock</T>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  identity: { alignItems: 'center', gap: 4 },
  section: { color: colors.textDim, marginTop: 6 },
  versions: { color: colors.textFaint, textAlign: 'center', marginTop: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  frames: { flexDirection: 'row', gap: 8 },
  frame: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.glass, borderWidth: 1, borderColor: 'transparent', overflow: 'hidden' },
  frameOn: { borderColor: colors.gold },
  input: { height: 50, borderRadius: radius.md, paddingHorizontal: 15, backgroundColor: colors.glass, color: colors.white, fontFamily: fonts.medium, fontSize: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, backgroundColor: colors.glass },
  unblock: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.glassStrong },
});
