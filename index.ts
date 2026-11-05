// The VoltKit SDK must load first: it registers react-native-webrtc's globals, which the client needs.
import '@voltkit-rtc/react-native';
import debug from 'debug';
import { registerRootComponent } from 'expo';
import App from './src/App';

// react-native-webrtc switches its debug logging on when it loads, even in a release build.
if (!__DEV__) debug.disable();

registerRootComponent(App);
