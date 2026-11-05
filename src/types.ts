export type Frame = 'none' | 'lion' | 'wolf';
export type RoomType = 'video' | 'audio';
export type SeatMode = 'open' | 'request';
export type RoomLayout = 'stage' | 'grid';
export type Role = 'host' | 'cohost' | 'moderator' | 'viewer';

export interface GuestPublic {
  id: string;
  name: string;
  avatar: string;
  frame: Frame;
}

export interface Guest extends GuestPublic {
  coins: number;
  giftsReceived: number;
  blocked: string[];
  restricted: boolean;
}

export interface Room {
  id: string;
  type: RoomType;
  title: string;
  theme: string;
  seats: number;
  seatMode: SeatMode;
  layout: RoomLayout;
  host: GuestPublic;
  status: 'live' | 'ended';
  viewers: number;
  giftCoins: number;
  createdAt: string;
}

export interface Credentials {
  token: string;
  wsUrl: string;
  role: Role;
  expiresAt: number;
}

export interface Gift {
  id: string;
  name: string;
  price: number;
  tier: 'basic' | 'premium' | 'royal';
  svgaUrl: string;
  icon: string;
}

export interface ConversationSummary {
  id: string;
  peer: GuestPublic;
  last: { text: string; from: string | null; at: string } | null;
  unread: number;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  from: string;
  text: string;
  at: string;
}

export interface MatchFound {
  callId: string;
  token: string;
  wsUrl: string;
  role: Role;
  peer: GuestPublic;
}

export interface Rates {
  audio: string | null;
  video: string | null;
  unit: string;
}
