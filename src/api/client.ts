import { API_URL } from '../config';
import type {
  ConversationSummary,
  Credentials,
  DirectMessage,
  Gift,
  Guest,
  GuestPublic,
  Rates,
  Room,
  RoomLayout,
  RoomType,
  SeatMode,
} from '../types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

let sessionToken: string | null = null;
export const setSessionToken = (token: string | null) => {
  sessionToken = token;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection.', 0, 'network');
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // A proxy's error page: handled below by its status.
  }
  if (!res.ok) {
    throw new ApiError(data?.error?.message ?? 'Something went wrong. Try again.', res.status, data?.error?.code ?? 'unknown');
  }
  return data as T;
}

export interface CreateRoomInput {
  type: RoomType;
  title: string;
  theme: string;
  seats: number;
  seatMode: SeatMode;
  layout: RoomLayout;
}

export const api = {
  createGuest: (name: string, avatar: string) =>
    request<{ token: string; guest: Guest }>('POST', '/guests', { name, avatar, ageConfirmed: true }),
  me: () => request<{ guest: Guest }>('GET', '/me'),
  updateMe: (patch: Partial<Pick<Guest, 'name' | 'avatar' | 'frame'>>) => request<{ guest: Guest }>('PATCH', '/me', patch),
  topUp: () => request<{ guest: Guest }>('POST', '/me/coins/topup'),
  deleteMe: () => request<void>('DELETE', '/me'),
  guest: (id: string) => request<{ guest: GuestPublic & { giftsReceived: number }; blockedByMe: boolean }>('GET', `/guests/${id}`),

  blocks: () => request<{ guests: GuestPublic[] }>('GET', '/blocks'),
  block: (id: string) => request<void>('POST', `/blocks/${id}`),
  unblock: (id: string) => request<void>('DELETE', `/blocks/${id}`),
  report: (target: string, reason: string, roomId?: string) => request<{ ok: true }>('POST', '/reports', { target, reason, roomId }),

  rooms: (type?: RoomType) => request<{ rooms: Room[] }>('GET', `/rooms${type ? `?type=${type}` : ''}`),
  createRoom: (input: CreateRoomInput) => request<{ room: Room; credentials: Credentials }>('POST', '/rooms', input),
  joinRoom: (id: string) => request<{ room: Room; credentials: Credentials }>('POST', `/rooms/${id}/join`),
  refreshRoomToken: (id: string) => request<{ credentials: Credentials }>('POST', `/rooms/${id}/token`),
  endRoom: (id: string) => request<void>('POST', `/rooms/${id}/end`),
  banFromRoom: (id: string, identity: string) => request<void>('POST', `/rooms/${id}/bans`, { identity }),

  gifts: () => request<{ gifts: Gift[]; demoCoins: true }>('GET', '/gifts'),
  sendGift: (roomId: string, giftId: string, to: string, count: number) =>
    request<{ guest: Guest }>('POST', `/rooms/${roomId}/gifts`, { giftId, to, count }),

  loungeToken: () => request<{ channel: string; token: string; wsUrl: string }>('POST', '/chat/lounge/token'),
  conversations: () => request<{ conversations: ConversationSummary[] }>('GET', '/conversations'),
  startConversation: (peerId: string) => request<{ conversation: ConversationSummary }>('POST', '/conversations', { peerId }),
  conversation: (id: string) =>
    request<{
      conversation: ConversationSummary;
      messages: DirectMessage[];
      chat: { channel: string; token: string; wsUrl: string };
    }>('GET', `/conversations/${id}`),
  sendDirect: (id: string, text: string) => request<{ message: DirectMessage }>('POST', `/conversations/${id}/messages`, { text }),
  markRead: (id: string) => request<void>('POST', `/conversations/${id}/read`),

  stats: () => request<{ liveRooms: number; online: number; waiting: number }>('GET', '/stats'),
  voltkit: () => request<{ rates: Rates | null; site: string; docs: string }>('GET', '/voltkit'),
};
