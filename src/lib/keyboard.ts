import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How much of the screen the keyboard covers, navigation bar included. The app draws edge to edge, so the
 * window does not resize for it, and React Native's height leaves the navigation bar out: on a phone with
 * three-button navigation, that would put the input behind the keyboard.
 */
export function useKeyboardHeight() {
  const { bottom } = useSafeAreaInsets();
  // A screen can open with the keyboard already up, and then no "shown" event will come.
  const [height, setHeight] = useState(() => (Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0));
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height ? height + bottom : 0;
}
