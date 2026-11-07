const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000';
const api = new URL(API_URL);
const cleartextHosts = api.protocol === 'http:' ? [api.hostname] : [];

module.exports = {
  expo: {
    name: 'VoltKit Native',
    slug: 'voltkit-live-demo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/brand/icon.png',
    userInterfaceStyle: 'dark',
    backgroundColor: '#080610',
    android: {
      package: 'in.voltkit.livedemo',
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/brand/adaptive-foreground.png',
        backgroundImage: './assets/brand/adaptive-background.png',
      },
      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: 'resize',
      // Expo adds these to every app; a live app needs none of them.
      blockedPermissions: [
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
    },
    ios: {
      bundleIdentifier: 'in.voltkit.livedemo',
      supportsTablet: false,
    },
    plugins: [
      [
        '@voltkit-rtc/react-native',
        {
          cameraPermission: 'Your camera is shown live to the people in your room or call.',
          microphonePermission: 'Your microphone is heard live by the people in your room or call.',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 24,
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
        },
      ],
      'expo-secure-store',
      [
        'expo-font',
        {
          fonts: [
            'node_modules/@expo-google-fonts/outfit/400Regular/Outfit_400Regular.ttf',
            'node_modules/@expo-google-fonts/outfit/500Medium/Outfit_500Medium.ttf',
            'node_modules/@expo-google-fonts/outfit/600SemiBold/Outfit_600SemiBold.ttf',
            'node_modules/@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf',
            'node_modules/@expo-google-fonts/outfit/800ExtraBold/Outfit_800ExtraBold.ttf',
          ],
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#080610',
          image: './assets/brand/splash-mark.png',
          imageWidth: 180,
        },
      ],
      ['./plugins/with-dev-cleartext', { hosts: cleartextHosts }],
      './plugins/with-release-signing',
    ],
    extra: { apiUrl: API_URL },
  },
};
