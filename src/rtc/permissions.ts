import type { Role } from '../types';

/**
 * What each role may do to whom, as VoltKit enforces it. The service refuses anything else, so this only
 * decides which buttons to show: a button that always fails is worse than no button.
 *
 * host        all of it, on anyone but themselves
 * moderator   on viewers only: mute in chat, remove. Handles raised hands. Grants nothing.
 * cohost      publishes; no powers over others
 * viewer      watches
 */
export const canPublish = (role: Role) => role === 'host' || role === 'cohost';
export const canModerate = (role: Role) => role === 'host' || role === 'moderator';

export type MemberAction =
  | 'invite-seat'
  | 'remove-seat'
  | 'force-mute-mic'
  | 'release-mic'
  | 'force-mute-cam'
  | 'release-cam'
  | 'mute-chat'
  | 'unmute-chat'
  | 'make-moderator'
  | 'remove-moderator'
  | 'decline-hand'
  | 'remove-from-room';

export interface MemberState {
  role: Role;
  isSelf: boolean;
  seated: boolean;
  handRaised: boolean;
  micLocked: boolean;
  camLocked: boolean;
  chatMuted: boolean;
}

export function memberActions(actor: Role, target: MemberState, roomHasVideo: boolean): MemberAction[] {
  if (target.isSelf || target.role === 'host') return [];

  if (actor === 'host') {
    const out: MemberAction[] = [];
    if (target.role === 'cohost') {
      out.push('remove-seat', target.micLocked ? 'release-mic' : 'force-mute-mic');
      if (roomHasVideo) out.push(target.camLocked ? 'release-cam' : 'force-mute-cam');
    } else if (target.role === 'viewer') {
      out.push('invite-seat');
    }
    if (target.handRaised) out.push('decline-hand');
    out.push(target.chatMuted ? 'unmute-chat' : 'mute-chat');
    if (target.role === 'viewer') out.push('make-moderator');
    if (target.role === 'moderator') out.push('remove-moderator');
    out.push('remove-from-room');
    return out;
  }

  if (actor === 'moderator' && target.role === 'viewer') {
    return [...(target.handRaised ? (['decline-hand'] as const) : []), target.chatMuted ? 'unmute-chat' : 'mute-chat', 'remove-from-room'];
  }
  return [];
}

export type SeatAction = 'take' | 'request' | 'leave' | 'lock' | 'unlock' | 'invite';

export function seatActions(role: Role, seat: { empty: boolean; locked: boolean; mine: boolean }, iAmSeated: boolean): SeatAction[] {
  if (seat.mine) return ['leave'];
  if (role === 'host') {
    if (seat.locked) return ['unlock'];
    return seat.empty ? ['invite', 'lock'] : [];
  }
  if (seat.locked || !seat.empty || iAmSeated) return [];
  return role === 'viewer' ? ['request'] : [];
}
