/**
 * The heart of a room: all its VoltKit logic in one hook, so components only draw state and call `actions`.
 * It must be used inside a VoltkitProvider.
 *
 * Guide: docs/rooms-roles-seats.md
 */
import { RpcError } from '@voltkit-rtc/client';
import {
  useLocalMedia,
  useParticipants,
  useRemoteTracks,
  useRoom,
  useVoltkitEvent,
  type LocalMedia,
} from '@voltkit-rtc/react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { api } from '../api/client';
import { toast } from '../lib/toast';
import type { Frame, GuestPublic, Role, Room, RoomLayout, SeatMode } from '../types';
import { useMediaConsent } from './consent';
import { actionProblem, mediaProblem } from './errors';
import { canPublish } from './permissions';
import { applyClaim, firstFreeSeat, pickSeat, seatOf, type Claims } from './seats';

export interface Member {
  identity: string;
  name: string;
  avatar?: string;
  frame: Frame;
  role: Role;
  handRaised: boolean;
  wantedSeat?: string;
  micLocked: boolean;
  camLocked: boolean;
  seat: string | null;
}

type Display = { name?: string; avatar?: string; frame?: Frame };

/** How many seats there are besides the host. A video room counts the host's own card in `seats`. */
export const seatCount = (room: Pick<Room, 'type' | 'seats'>) => (room.type === 'video' ? room.seats - 1 : room.seats);

export type RoomEngine = ReturnType<typeof useRoomEngine>;

/**
 * Everything a room does, on VoltKit's own primitives. Roles, seats and moderation are enforced by the
 * service; the host's client is the one that says yes to a seat, because only a host may promote.
 */
export function useRoomEngine(room: Room, me: GuestPublic) {
  const { client, state, info } = useRoom();
  const participants = useParticipants();
  const local = useLocalMedia();
  const videoTracks = useRemoteTracks({ kind: 'video', source: 'camera' });
  const audioTracks = useRemoteTracks({ kind: 'audio', source: 'mic' });
  const askConsent = useMediaConsent();

  const [claims, setClaims] = useState<Claims>({});
  const [locked, setLocked] = useState<ReadonlySet<string>>(new Set());
  const [layout, setLayout] = useState<RoomLayout>(room.layout);
  const [seatMode, setSeatMode] = useState<SeatMode>(room.seatMode);
  const [chatMuted, setChatMuted] = useState<ReadonlySet<string>>(new Set());
  const [invitedTo, setInvitedTo] = useState<string | null>(null);
  const [iMutedInChat, setIMutedInChat] = useState(false);

  const isHost = room.host.id === me.id;
  const myRole: Role = participants.find((p) => p.identity === me.id)?.role ?? info?.role ?? (isHost ? 'host' : 'viewer');
  const seats = seatCount(room);

  // Handlers run later than the render that made them: these always hold what is true now. Two events can arrive
  // between renders, and reading rendered state would lose the first.
  const claimsRef = useRef(claims);
  const lockedRef = useRef(locked);
  const seatModeRef = useRef(seatMode);
  const participantsRef = useRef(participants);
  const localRef = useRef<LocalMedia>(local);
  const invites = useRef(new Map<string, string>());
  // What this person means to do, kept apart from whether they are publishing. Going on air spans a role change and
  // sometimes a reconnect, in either order, so one effect below compares the two.
  const wantOnAir = useRef(isHost);
  const publishing = useRef(false);
  participantsRef.current = participants;
  localRef.current = local;

  const run = useCallback(async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) toast(done, 'success');
    } catch (err) {
      toast(actionProblem(err), 'error');
    }
  }, []);

  const roleOf = (identity: string) => participantsRef.current.find((p) => p.identity === identity)?.role;

  // Seats and room settings: read once from the join result, then followed through events. It runs after every rejoin,
  // which also puts the profile back: connect() takes no metadata in JS, so setMetadata is how names get out.
  const seed = useCallback(() => {
    const joined = client?.info;
    if (!joined) return;
    claimsRef.current = Object.fromEntries((joined.claims ?? []).map((c) => [c.key, { identity: c.identity, state: c.state }]));
    lockedRef.current = new Set(joined.blockedSlots ?? []);
    setClaims(claimsRef.current);
    setLocked(lockedRef.current);
    const meta = joined.metadata as { layout?: RoomLayout; seatMode?: SeatMode } | undefined;
    if (meta?.layout) setLayout(meta.layout);
    if (meta?.seatMode) {
      seatModeRef.current = meta.seatMode;
      setSeatMode(meta.seatMode);
    }
    client?.setMetadata({ name: me.name, avatar: me.avatar, frame: me.frame }).catch(() => {});
  }, [client, me.name, me.avatar, me.frame]);

  useVoltkitEvent('joined', seed);
  useEffect(() => {
    if (state === 'connected') seed();
  }, [state, seed]);

  const goOnAir = useCallback(async () => {
    if (publishing.current) return;
    publishing.current = true;
    try {
      // With no options publish() sends the highest quality the project allows: pick one on purpose.
      await localRef.current.publish(room.type === 'video' ? { quality: room.seats > 6 ? '480p' : '720p' } : { video: false });
    } catch (err) {
      // Cut off by the move to the publishing server: the SDK publishes again itself once it has moved.
      if (err instanceof RpcError && (err.code === 'disconnected' || err.code === 'source-already-published')) return;
      wantOnAir.current = false;
      const { text, openSettings } = mediaProblem(err);
      toast(text, 'error');
      if (openSettings) void Linking.openSettings();
      const seat = seatOf(claimsRef.current, me.id);
      if (seat) await client?.release(seat).catch(() => {});
    } finally {
      publishing.current = false;
    }
  }, [client, me.id, room.seats, room.type]);

  useEffect(() => {
    if (state === 'connected' && wantOnAir.current && canPublish(myRole) && !local.publishing) void goOnAir();
  }, [state, myRole, local.publishing, goOnAir]);

  useVoltkitEvent('roleChanged', ({ identity, role }) => {
    if (identity !== me.id) return;
    if (canPublish(role)) {
      wantOnAir.current = true;
      toast('You are on stage', 'success');
    } else {
      wantOnAir.current = false;
      toast(role === 'moderator' ? 'You are now a moderator' : 'You are back in the audience');
      // A demotion leaves the seat claimed on the service, and an empty card behind it.
      const seat = seatOf(claimsRef.current, me.id);
      if (seat) client?.release(seat).catch(() => {});
    }
  });

  /** The host's side of a seat: claim first, so a seat that has gone means nothing else happened. */
  const seatGuest = useCallback(
    async (identity: string, wanted?: unknown) => {
      const seat = pickSeat(wanted, seats, claimsRef.current, lockedRef.current);
      if (!seat) {
        await client?.lowerHand(identity).catch(() => {});
        toast('All seats are taken');
        return;
      }
      try {
        await client?.claim(seat, identity);
        await client?.promote(identity, 'cohost');
      } catch (err) {
        await client?.release(seat).catch(() => {});
        await client?.lowerHand(identity).catch(() => {});
        toast(actionProblem(err), 'error');
      }
    },
    [client, seats],
  );

  useVoltkitEvent('handRaised', ({ identity, handRaised, metadata, reason }) => {
    if (identity === me.id) {
      if (!handRaised && reason === 'declined') toast('The host declined your request');
      return;
    }
    if (!handRaised || !isHost) return;
    const invitedSeat = invites.current.get(identity);
    if (invitedSeat || seatModeRef.current === 'open') {
      invites.current.delete(identity);
      void seatGuest(identity, invitedSeat ?? metadata?.slot);
      return;
    }
    const who = participantsRef.current.find((p) => p.identity === identity)?.metadata as { name?: string } | undefined;
    toast(`${who?.name ?? 'Someone'} is asking for a seat`);
  });

  useVoltkitEvent('claimChanged', (e) => {
    const held = claimsRef.current[e.key]?.identity;
    claimsRef.current = applyClaim(claimsRef.current, e);
    setClaims(claimsRef.current);
    if (e.state === 'blocked' || e.reason === 'unblocked') {
      const next = new Set(lockedRef.current);
      if (e.state === 'blocked') next.add(e.key);
      else next.delete(e.key);
      lockedRef.current = next;
      setLocked(next);
    }
    // Someone gave up their seat: back to the audience, which only the host can do for them.
    if (isHost && e.state === 'free' && e.reason === 'released' && held && roleOf(held) === 'cohost') {
      client?.promote(held, 'viewer').catch(() => {});
    }
  });

  useVoltkitEvent('roomMetadataChanged', ({ metadata }) => {
    const meta = metadata as { layout?: RoomLayout; seatMode?: SeatMode } | undefined;
    if (meta?.layout) setLayout(meta.layout);
    if (meta?.seatMode) {
      seatModeRef.current = meta.seatMode;
      setSeatMode(meta.seatMode);
    }
  });

  const whoIs = (identity: string) => (identity === room.host.id ? 'The host' : 'A moderator');

  useVoltkitEvent('chatMuted', ({ identity, muted, by }) => {
    if (identity === me.id) {
      setIMutedInChat(muted);
      toast(muted ? `${whoIs(by)} muted you in this chat` : 'You can chat again');
    }
    setChatMuted((prev) => {
      const next = new Set(prev);
      if (muted) next.add(identity);
      else next.delete(identity);
      return next;
    });
  });

  useVoltkitEvent('forceMuted', ({ by, kind, paused }) => {
    const what = kind === 'audio' ? 'microphone' : kind === 'video' ? 'camera' : 'camera and microphone';
    toast(paused ? `${whoIs(by)} switched off your ${what}` : `You can switch your ${what} back on`);
  });

  useVoltkitEvent('message', (m) => {
    if (m.type === 'invite' && m.to === me.id) {
      const slot = (m.metadata as { slot?: string } | undefined)?.slot;
      setInvitedTo(slot ?? 'any');
    }
  });

  const members = useMemo<Member[]>(
    () =>
      participants.map((p) => {
        const d = (p.metadata ?? {}) as Display;
        const isRoomHost = p.identity === room.host.id;
        return {
          identity: p.identity,
          name: d.name ?? (isRoomHost ? room.host.name : 'Guest'),
          avatar: d.avatar ?? (isRoomHost ? room.host.avatar : undefined),
          frame: d.frame ?? (isRoomHost ? room.host.frame : 'none'),
          role: p.role,
          handRaised: p.handRaised,
          wantedSeat: p.handMetadata?.slot as string | undefined,
          micLocked: p.muted,
          camLocked: Boolean(p.videoBlocked),
          seat: seatOf(claims, p.identity),
        };
      }),
    [participants, claims, room.host],
  );

  const memberById = useMemo(() => new Map(members.map((m) => [m.identity, m])), [members]);
  const videoById = useMemo(() => new Map(videoTracks.map((t) => [t.identity, t])), [videoTracks]);
  const audioById = useMemo(() => new Map(audioTracks.map((t) => [t.identity, t])), [audioTracks]);
  const hands = useMemo(() => members.filter((m) => m.handRaised && m.role === 'viewer'), [members]);
  const mySeat = seatOf(claims, me.id);
  const myHand = memberById.get(me.id)?.handRaised ?? false;

  const micIsOn = useCallback(
    (identity: string) => {
      if (identity === me.id) return local.publishing && local.micEnabled;
      const track = audioById.get(identity);
      return Boolean(track && !track.paused);
    },
    [audioById, local.micEnabled, local.publishing, me.id],
  );

  const actions = useMemo(
    () => ({
      async toggleMic() {
        if (!localRef.current.publishing) {
          wantOnAir.current = true;
          return goOnAir();
        }
        await run(() => localRef.current.setMicEnabled(!localRef.current.micEnabled));
      },
      toggleCam: () => run(() => localRef.current.setCamEnabled(!localRef.current.camEnabled)),
      flipCamera: () => run(() => localRef.current.switchCamera()),

      async requestSeat(slot?: string) {
        if (!(await askConsent(room.type))) return;
        await run(() => client!.raiseHand({ requestRole: 'cohost', slot }));
      },
      cancelRequest: () => run(() => client!.lowerHand()),
      async leaveSeat() {
        wantOnAir.current = false;
        await run(async () => {
          await localRef.current.unpublish();
          if (mySeat) await client!.release(mySeat);
        });
      },

      acceptHand: (identity: string, wanted?: string) => seatGuest(identity, wanted),
      declineHand: (identity: string) => run(() => client!.lowerHand(identity)),

      inviteToSeat(identity: string, slot?: string) {
        const seat = slot ?? firstFreeSeat(seats, claimsRef.current, lockedRef.current);
        if (!seat) return void toast('All seats are taken');
        // Remembered here, so only someone actually invited skips the queue.
        invites.current.set(identity, seat);
        void run(() => client!.sendMessage('', { type: 'invite', to: identity, metadata: { slot: seat } }), 'Invitation sent');
      },
      async acceptInvite() {
        const slot = invitedTo === 'any' ? undefined : (invitedTo ?? undefined);
        setInvitedTo(null);
        if (!(await askConsent(room.type))) return;
        await run(() => client!.raiseHand({ requestRole: 'cohost', slot, invited: true }));
      },
      declineInvite: () => setInvitedTo(null),

      removeFromSeat: (identity: string) =>
        run(async () => {
          const seat = seatOf(claimsRef.current, identity);
          if (seat) await client!.release(seat);
          await client!.promote(identity, 'viewer');
        }, 'Moved to the audience'),

      lockSeat: (key: string) => run(() => client!.blockSlot(key)),
      unlockSeat: (key: string) => run(() => client!.unblockSlot(key)),

      forceMic: (identity: string, off: boolean) => run(() => client!.forceMute(identity, 'audio', off), off ? 'Microphone off' : 'Released'),
      forceCam: (identity: string, off: boolean) => run(() => client!.forceMute(identity, 'video', off), off ? 'Camera off' : 'Released'),
      muteAll: () =>
        run(async () => {
          const onStage = participantsRef.current.filter((p) => p.role === 'cohost' && !p.muted);
          await Promise.all(onStage.map((p) => client!.forceMute(p.identity, 'audio', true)));
        }, 'Everyone on stage is muted'),

      setChatMute: (identity: string, muted: boolean) =>
        run(() => client!.muteChat(identity, muted), muted ? 'Muted in chat' : 'Can chat again'),

      makeModerator: (identity: string) => run(() => client!.promote(identity, 'moderator'), 'Now a moderator'),
      removeModerator: (identity: string) => run(() => client!.promote(identity, 'viewer'), 'No longer a moderator'),

      removeFromRoom: (identity: string) =>
        run(async () => {
          // Kick stops the tokens minted so far. The ban stops the backend minting another, so it goes first.
          await api.banFromRoom(room.id, identity);
          await client!.kick(identity, 'Removed from the room');
        }, 'Removed from the room'),

      setRoomLayout: (next: RoomLayout) => run(() => client!.setRoomMetadata({ layout: next })),
      setRoomSeatMode: (next: SeatMode) => run(() => client!.setRoomMetadata({ seatMode: next })),

      endRoom: () => run(() => api.endRoom(room.id)),
    }),
    [askConsent, client, goOnAir, invitedTo, mySeat, room.id, room.type, run, seatGuest, seats],
  );

  return {
    room,
    me,
    state,
    client,
    local,
    myRole,
    isHost,
    seats,
    claims,
    locked,
    layout,
    seatMode,
    chatMuted,
    invitedTo,
    iMutedInChat,
    members,
    memberById,
    videoById,
    hands,
    mySeat,
    myHand,
    micIsOn,
    actions,
  };
}
