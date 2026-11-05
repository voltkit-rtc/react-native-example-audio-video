import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { GradientButton, Panel, PoweredBy, T } from '../components/ui';
import type { RootStack } from '../navigation';
import { useGuest } from '../state/session';
import { colors, gradients } from '../theme';

const RULES = ['You are matched with someone at random', 'Tap Next at any time to meet someone new', 'Report or block anyone from the call'];

export function MatchLanding() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>();
  const insets = useSafeAreaInsets();
  const guest = useGuest();
  const [waiting, setWaiting] = useState(0);

  useFocusEffect(
    useCallback(() => {
      api.stats().then((s) => setWaiting(s.waiting), () => {});
    }, []),
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: 110 }]}>
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
      <T variant="display">1v1 Face Live</T>
      <T style={{ color: colors.textDim }}>Face to face with someone new, in one tap.</T>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <View style={{ alignItems: 'center' }}>
          <LinearGradient colors={gradients.match} style={styles.orb}>
            <Ionicons name="videocam" size={52} color={colors.white} />
          </LinearGradient>
        </View>
        <Panel style={{ gap: 8 }}>
          {RULES.map((r) => (
            <View key={r} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={17} color={colors.success} />
              <T variant="small" style={{ color: colors.textDim, flex: 1 }}>
                {r}
              </T>
            </View>
          ))}
        </Panel>
        {waiting > 0 && (
          <T variant="small" style={{ color: colors.gold, textAlign: 'center' }}>
            {waiting} {waiting === 1 ? 'person is' : 'people are'} waiting now
          </T>
        )}
      </View>
      <GradientButton
        testID="match-start"
        label="Start matching"
        icon="shuffle"
        disabled={guest.restricted}
        colorsOverride={gradients.match}
        onPress={() => navigation.navigate('Match')}
      />
      <PoweredBy style={{ marginTop: 12 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, gap: 4 },
  orb: { width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center' },
});
