import { RpcError, isTerminalError } from '@voltkit-rtc/client';
import type { ClosedReason } from '@voltkit-rtc/react-native';

export const CLOSED_TEXT: Record<ClosedReason, string> = {
  left: 'You left the room.',
  kicked: 'You were removed from this room.',
  'room-closed': 'This room has ended.',
  replaced: 'You joined this room from another device.',
  'gave-up': 'The connection was lost.',
};

export function joinProblem(err: Error): { text: string; canRetry: boolean } {
  const code = err instanceof RpcError ? err.code : '';
  switch (code) {
    case 'bad-token':
    case 'no-token':
      return { text: 'Your session expired. Join again.', canRetry: true };
    case 'room-ended':
    case 'no-room':
      return { text: 'This room has ended.', canRetry: false };
    case 'kicked':
      return { text: 'You were removed from this room.', canRetry: false };
    case 'quota-exhausted':
    case 'daily-limit-reached':
    case 'monthly-limit-reached':
    case 'tenant-suspended':
    case 'billing-unavailable':
      return { text: 'Live rooms are unavailable right now.', canRetry: false };
    case 'participant-quota':
    case 'no-capacity':
      return { text: 'This room is full right now. Try again in a moment.', canRetry: true };
    default:
      return { text: 'Could not connect. Check your connection and try again.', canRetry: !isTerminalError(code) };
  }
}

/** Words for a failed action in a room. Never shows the service's raw message. */
export function actionProblem(err: unknown): string {
  const code = err instanceof RpcError ? err.code : '';
  switch (code) {
    case 'forbidden':
      return 'You do not have permission to do that.';
    case 'no-participant':
      return 'That person has left.';
    case 'slot-taken':
      return 'Someone just took that seat.';
    case 'slot-blocked':
      return 'That seat is locked.';
    case 'slot-occupied':
      return 'Someone is sitting there.';
    case 'chat-muted':
      return 'You have been muted in this chat.';
    case 'rate-limited':
      return 'Slow down a little.';
    case 'force-muted':
      return 'The host has this switched off.';
    case 'stage-full':
      return 'The stage is full.';
    case 'not-connected':
      return 'Reconnecting. Try again in a moment.';
    default:
      return err instanceof Error && !(err instanceof RpcError) ? err.message : 'That did not work. Try again.';
  }
}

export function mediaProblem(err: unknown): { text: string; openSettings: boolean } {
  if (err instanceof RpcError && err.code === 'media-unavailable') {
    const data = err.data as { permission?: string; status?: string } | undefined;
    if (data?.status === 'blocked') return { text: `Allow the ${data.permission} in Settings to go on air.`, openSettings: true };
    if (data?.permission) return { text: `The ${data.permission} is needed to go on air.`, openSettings: false };
    return { text: 'The camera or microphone could not start. Another app may be using it.', openSettings: false };
  }
  return { text: 'Could not start the camera and microphone.', openSettings: false };
}
