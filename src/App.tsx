import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold, useFonts } from '@expo-google-fonts/outfit';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ART } from './assets';
import { BuiltWith, GradientButton, IconName, T, Wordmark } from './components/ui';
import { VOLTKIT } from './config';
import { ToastHost } from './lib/toast';
import type { RootStack } from './navigation';
import { MediaConsentProvider } from './rtc/consent';
import { BlockedScreen, ProfileScreen } from './screens/ProfileScreen';
import { CreateScreen } from './screens/CreateScreen';
import { HomeScreen } from './screens/HomeScreen';
import { InboxScreen, LoungeScreen, ThreadScreen } from './screens/ChatScreens';
import { MatchLanding } from './screens/MatchLanding';
import { MatchScreen } from './screens/MatchScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { RoomScreen } from './screens/RoomScreen';
import { VoltKitScreen } from './screens/VoltKitScreen';
import { SessionProvider, useSession } from './state/session';
import { colors, gradients } from './theme';

void SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator<RootStack>();
const Tab = createBottomTabNavigator();

const navTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg } };

const TAB_LOOK: Record<string, { icon: IconName; on: IconName; label: string }> = {
  Home: { icon: 'home-outline', on: 'home', label: 'Home' },
  Face: { icon: 'shuffle-outline', on: 'shuffle', label: '1v1' },
  Chat: { icon: 'chatbubbles-outline', on: 'chatbubbles', label: 'Chat' },
  Me: { icon: 'person-outline', on: 'person', label: 'Me' },
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const stack = navigation.getParent();
  const item = (index: number) => {
    const route = state.routes[index];
    const on = state.index === index;
    const look = TAB_LOOK[route.name];
    return (
      <Pressable
        key={route.key}
        testID={`tab-${route.name}`}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={look.label}
        onPress={() => navigation.navigate(route.name)}
        style={styles.tab}
      >
        <Ionicons name={on ? look.on : look.icon} size={22} color={on ? colors.magenta : colors.textDim} />
        <T variant="tiny" style={{ color: on ? colors.white : colors.textDim }}>
          {look.label}
        </T>
      </Pressable>
    );
  };
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {item(0)}
      {item(1)}
      <Pressable testID="tab-create" accessibilityRole="button" accessibilityLabel="Start a room" onPress={() => stack?.navigate('Create')} style={styles.fabWrap}>
        <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
          <Ionicons name="add" size={30} color={colors.white} />
        </LinearGradient>
      </Pressable>
      {item(2)}
      {item(3)}
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Face" component={MatchLanding} />
      <Tab.Screen name="Chat" component={InboxScreen} />
      <Tab.Screen name="Me" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function SignedIn() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Create" component={CreateScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Room" component={RoomScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="Match" component={MatchScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="Thread" component={ThreadScreen} />
      <Stack.Screen name="Lounge" component={LoungeScreen} />
      <Stack.Screen name="VoltKit" component={VoltKitScreen} />
      <Stack.Screen name="Blocked" component={BlockedScreen} />
    </Stack.Navigator>
  );
}

/** Every start says what this is, long enough to read, before the app itself. */
function LaunchScreen() {
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [shown]);
  return (
    <View style={styles.launch} testID="launch-screen">
      <LinearGradient colors={['#2A1159', colors.plum, colors.bg]} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[
          styles.launchBrand,
          { opacity: shown, transform: [{ scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] },
        ]}
      >
        <Image source={ART.mark} style={styles.launchLogo} fadeDuration={0} />
        <Wordmark size={38} />
        <T variant="heading" style={{ color: colors.textDim }}>
          {VOLTKIT.demoLine}
        </T>
        <T variant="small" style={{ color: colors.gold }}>
          {VOLTKIT.tagline}
        </T>
      </Animated.View>
      <Animated.View style={[styles.launchFoot, { opacity: shown }]}>
        <BuiltWith />
      </Animated.View>
    </View>
  );
}

const LAUNCH_MS = 1600;

function Root() {
  const { status, retry } = useSession();
  const [launched, setLaunched] = useState(false);
  useEffect(() => {
    void SplashScreen.hideAsync();
    const timer = setTimeout(() => setLaunched(true), LAUNCH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (status === 'loading' || !launched) return <LaunchScreen />;
  if (status === 'offline') {
    return (
      <View style={styles.center}>
        <Wordmark size={32} />
        <Ionicons name="cloud-offline-outline" size={40} color={colors.textDim} />
        <T style={{ color: colors.textDim, textAlign: 'center' }}>Could not reach the server.</T>
        <GradientButton label="Try again" onPress={retry} />
      </View>
    );
  }
  if (status === 'guest-needed') return <OnboardingScreen />;
  return (
    <NavigationContainer theme={navTheme}>
      <SignedIn />
    </NavigationContainer>
  );
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error('app crashed:', error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.center}>
        <T variant="title">Something went wrong</T>
        <GradientButton label="Reload" onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

export default function App() {
  const [fonts] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold });
  if (!fonts) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Boundary>
        <SessionProvider>
          <MediaConsentProvider>
            <Root />
          </MediaConsentProvider>
        </SessionProvider>
      </Boundary>
      <ToastHost />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 30 },
  launch: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  launchBrand: { alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  launchLogo: { width: 104, height: 104, marginBottom: 10 },
  launchFoot: { position: 'absolute', left: 16, right: 16, bottom: 56 },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    backgroundColor: 'rgba(16,9,32,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  fabWrap: { flex: 1, alignItems: 'center' },
  fab: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: -24, boxShadow: `0 4px 18px ${colors.magenta}` },
});
