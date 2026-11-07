export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000').replace(/\/$/, '');

/** Gift animations may be paths on the backend or full URLs on a CDN. */
export const assetUrl = (pathOrUrl: string) => (/^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${API_URL}${pathOrUrl}`);

export const VOLTKIT = {
  /** The app's name. Its Flutter twin is VoltKit Flutter. */
  appName: 'VoltKit Native',
  appSuffix: 'Native',
  site: 'https://voltkit.in',
  docs: 'https://voltkit.in/docs',
  rnPage: 'https://voltkit.in/rtc/react-native',
  rnDocs: 'https://voltkit.in/docs/react-native-sdk',
  quickstart: 'https://voltkit.in/docs/quickstart',
  tagline: 'Connect the world in one click.',
  poweredBy: 'Powered by VoltKit RTC',
  madeWith: 'Made with React Native',
  demoLine: 'React Native demo app from VoltKit',
  build: 'Build your own live streaming, audio and video app with VoltKit',
};
