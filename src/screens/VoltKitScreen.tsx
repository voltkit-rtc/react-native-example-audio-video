import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { ART } from '../assets';
import { BuiltWith, GhostButton, GradientButton, IconButton, IconName, Panel, T, Wordmark } from '../components/ui';
import { VOLTKIT } from '../config';
import type { Screen } from '../navigation';
import { colors, gradients, radius } from '../theme';
import type { Rates } from '../types';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'videocam', title: 'Video rooms', text: 'Host and co-host cards with adaptive video, up to 1080p' },
  { icon: 'mic', title: 'Audio rooms', text: 'Seats kept by the server, with live speaking indicators' },
  { icon: 'shuffle', title: '1v1 calls', text: 'Face-to-face video that reconnects on its own' },
  { icon: 'shield-checkmark', title: 'Roles and moderation', text: 'Host, co-host, moderator and viewer, enforced by the service' },
  { icon: 'chatbubbles', title: 'Realtime chat', text: 'In every room, in the lounge and in direct messages' },
  { icon: 'sparkles', title: 'SVGA gifts', text: 'Animated gifts and entrance effects, sent through chat' },
];

export function VoltKitScreen({ navigation }: Screen<'VoltKit'>) {
  const insets = useSafeAreaInsets();
  const [rates, setRates] = useState<Rates | null>(null);

  useEffect(() => {
    api.voltkit().then((r) => setRates(r.rates), () => {});
  }, []);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#2A1159', colors.plum, colors.bg]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 14 }} showsVerticalScrollIndicator={false}>
        <IconButton size={40} icon="chevron-back" label="Back" onPress={() => navigation.goBack()} />
        <View style={styles.hero}>
          <Image source={ART.mark} style={{ width: 84, height: 84 }} fadeDuration={0} />
          <Wordmark size={40} />
          <T variant="heading" style={{ color: colors.gold, textAlign: 'center' }}>
            {VOLTKIT.tagline}
          </T>
          <T style={{ color: colors.textDim, textAlign: 'center' }}>{VOLTKIT.build}.</T>
          <BuiltWith style={{ marginTop: 6 }} />
        </View>

        <Panel style={{ gap: 4 }}>
          <T variant="small" style={{ color: colors.gold }}>
            {VOLTKIT.demoLine}
          </T>
          <T style={{ color: colors.textDim }}>
            This app is built with React Native, and everything live in it runs on VoltKit RTC. Want the same experience in your own app? Start with an API key and the React Native SDK.
          </T>
        </Panel>

        <View style={{ gap: 8 }}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <LinearGradient colors={gradients.video} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featureIcon}>
                <Ionicons name={f.icon} size={19} color={colors.white} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <T variant="medium">{f.title}</T>
                <T variant="small" style={{ color: colors.textDim }}>
                  {f.text}
                </T>
              </View>
            </View>
          ))}
        </View>

        {rates?.audio && rates.video && (
          <View style={styles.prices}>
            <Panel style={styles.price}>
              <T variant="small" style={{ color: colors.textDim }}>
                Audio from
              </T>
              <T variant="display" style={{ color: colors.gold }}>
                ₹{Number(rates.audio)}
              </T>
            </Panel>
            <Panel style={styles.price}>
              <T variant="small" style={{ color: colors.textDim }}>
                Video
              </T>
              <T variant="display" style={{ color: colors.gold }}>
                ₹{Number(rates.video)}
              </T>
            </Panel>
          </View>
        )}
        {rates?.audio && (
          <T variant="tiny" style={{ color: colors.textFaint, textAlign: 'center', marginTop: -6 }}>
            {rates.unit}
          </T>
        )}

        <GradientButton testID="voltkit-site" label="Build this into your app" icon="arrow-forward" dark colorsOverride={gradients.gold} onPress={() => void Linking.openURL(VOLTKIT.rnPage)} />
        <GhostButton label="Go to voltkit.in" icon="globe-outline" onPress={() => void Linking.openURL(VOLTKIT.site)} />
        <GhostButton label="React Native SDK docs" icon="logo-react" onPress={() => void Linking.openURL(VOLTKIT.rnDocs)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: { alignItems: 'center', gap: 6 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.md, backgroundColor: colors.glass },
  featureIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  prices: { flexDirection: 'row', gap: 10 },
  price: { flex: 1, alignItems: 'center' },
});
