import { requestMediaPermissions } from '@voltkit-rtc/react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, View } from 'react-native';
import { GhostButton, GradientButton, Sheet, T } from '../components/ui';
import { toast } from '../lib/toast';
import { colors } from '../theme';
import type { RoomType } from '../types';

const KEY = 'media-consent-v1';

type Ask = (type: RoomType) => Promise<boolean>;

const Context = createContext<Ask>(async () => false);

export const useMediaConsent = () => useContext(Context);

/**
 * Nothing goes on air without this: the app explains what happens once, then the system asks. Viewers are
 * never asked, because they publish nothing.
 */
export function MediaConsentProvider({ children }: { children: ReactNode }) {
  const [asking, setAsking] = useState<RoomType | null>(null);
  const answer = useRef<((yes: boolean) => void) | null>(null);

  const ask = useCallback<Ask>(async (type) => {
    if (!(await SecureStore.getItemAsync(KEY))) {
      const yes = await new Promise<boolean>((resolve) => {
        answer.current = resolve;
        setAsking(type);
      });
      setAsking(null);
      if (!yes) return false;
      await SecureStore.setItemAsync(KEY, '1');
    }

    const kinds = type === 'video' ? (['camera', 'microphone'] as const) : (['microphone'] as const);
    const statuses = await requestMediaPermissions([...kinds]);
    // Only so the call's notification shows. The call works without it.
    await requestMediaPermissions(['notifications']);

    const refused = kinds.filter((k) => statuses[k] !== 'granted');
    if (refused.length === 0) return true;
    if (refused.some((k) => statuses[k] === 'blocked')) {
      toast(`Allow the ${refused.join(' and ')} in Settings to go on air.`, 'error');
      void Linking.openSettings();
    } else {
      toast(`The ${refused.join(' and ')} ${refused.length > 1 ? 'are' : 'is'} needed to go on air.`, 'error');
    }
    return false;
  }, []);

  const value = useMemo(() => ask, [ask]);
  return (
    <Context.Provider value={value}>
      {children}
      <Sheet visible={asking !== null} onClose={() => answer.current?.(false)} testID="consent-sheet">
        <View style={{ alignItems: 'center', gap: 10, paddingBottom: 6 }}>
          <Ionicons name={asking === 'video' ? 'videocam' : 'mic'} size={38} color={colors.magenta} />
          <T variant="title">Going on air</T>
          <T style={{ color: colors.textDim, textAlign: 'center' }}>
            Everyone in the room or call sees and hears you live. Your {asking === 'video' ? 'camera and microphone are' : 'microphone is'} only
            on while you are on stage, and you can switch {asking === 'video' ? 'them' : 'it'} off at any time. This app does not record you.
          </T>
          <GradientButton testID="consent-accept" label="I understand" onPress={() => answer.current?.(true)} style={{ alignSelf: 'stretch', marginTop: 8 }} />
          <GhostButton label="Not now" onPress={() => answer.current?.(false)} style={{ alignSelf: 'stretch' }} />
        </View>
      </Sheet>
    </Context.Provider>
  );
}
