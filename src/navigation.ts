import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Credentials, GuestPublic, Room, RoomType } from './types';

export type RootStack = {
  Tabs: undefined;
  Create: { type?: RoomType } | undefined;
  Room: { roomId: string; initial?: { room: Room; credentials: Credentials } };
  Match: undefined;
  Thread: { conversationId: string; peer: GuestPublic };
  Lounge: undefined;
  VoltKit: undefined;
  Blocked: undefined;
};

export type Screen<K extends keyof RootStack> = NativeStackScreenProps<RootStack, K>;
