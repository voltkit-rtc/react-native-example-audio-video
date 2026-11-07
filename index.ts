// The VoltKit SDK must load first: it registers react-native-webrtc's globals, which the client needs.
import '@voltkit-rtc/react-native';
import { registerRootComponent } from 'expo';
import App from './src/App';

registerRootComponent(App);
