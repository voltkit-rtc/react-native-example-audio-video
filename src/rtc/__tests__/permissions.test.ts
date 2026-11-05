import { canModerate, canPublish, memberActions, seatActions, type MemberState } from '../permissions';

const member = (over: Partial<MemberState> = {}): MemberState => ({
  role: 'viewer',
  isSelf: false,
  seated: false,
  handRaised: false,
  micLocked: false,
  camLocked: false,
  chatMuted: false,
  ...over,
});

describe('who may do what', () => {
  it('matches VoltKit: hosts and co-hosts publish, hosts and moderators moderate', () => {
    expect(['host', 'cohost', 'moderator', 'viewer'].map((r) => canPublish(r as never))).toEqual([true, true, false, false]);
    expect(['host', 'cohost', 'moderator', 'viewer'].map((r) => canModerate(r as never))).toEqual([true, false, true, false]);
  });

  it('gives nobody any action on the host, or on themselves', () => {
    for (const actor of ['host', 'moderator', 'cohost', 'viewer'] as const) {
      expect(memberActions(actor, member({ role: 'host' }), true)).toEqual([]);
      expect(memberActions(actor, member({ isSelf: true }), true)).toEqual([]);
    }
  });

  it('gives co-hosts and viewers no power over anyone', () => {
    for (const actor of ['cohost', 'viewer'] as const) {
      expect(memberActions(actor, member(), true)).toEqual([]);
      expect(memberActions(actor, member({ role: 'cohost' }), true)).toEqual([]);
    }
  });

  it('gives a host the full set on a co-host', () => {
    expect(memberActions('host', member({ role: 'cohost', seated: true }), true)).toEqual([
      'remove-seat',
      'force-mute-mic',
      'force-mute-cam',
      'mute-chat',
      'remove-from-room',
    ]);
  });

  it('offers release once something is locked', () => {
    const actions = memberActions('host', member({ role: 'cohost', micLocked: true, camLocked: true, chatMuted: true }), true);
    expect(actions).toEqual(expect.arrayContaining(['release-mic', 'release-cam', 'unmute-chat']));
    expect(actions).not.toContain('force-mute-mic');
  });

  it('offers no camera controls in an audio room', () => {
    const actions = memberActions('host', member({ role: 'cohost' }), false);
    expect(actions).not.toContain('force-mute-cam');
    expect(actions).not.toContain('release-cam');
  });

  it('lets a host raise a viewer to moderator, and take it back', () => {
    expect(memberActions('host', member(), true)).toContain('make-moderator');
    expect(memberActions('host', member({ role: 'moderator' }), true)).toContain('remove-moderator');
  });

  it('keeps moderators to viewers, and away from roles and seats', () => {
    const actions = memberActions('moderator', member({ handRaised: true }), true);
    expect(actions).toEqual(['decline-hand', 'mute-chat', 'remove-from-room']);
    expect(memberActions('moderator', member({ role: 'cohost' }), true)).toEqual([]);
    expect(memberActions('moderator', member({ role: 'moderator' }), true)).toEqual([]);
  });
});

describe('seats', () => {
  const seat = (over = {}) => ({ empty: true, locked: false, mine: false, ...over });

  it('lets a viewer ask for an empty seat only', () => {
    expect(seatActions('viewer', seat(), false)).toEqual(['request']);
    expect(seatActions('viewer', seat({ empty: false }), false)).toEqual([]);
    expect(seatActions('viewer', seat({ locked: true }), false)).toEqual([]);
  });

  it('lets you leave your own seat', () => {
    expect(seatActions('cohost', seat({ empty: false, mine: true }), true)).toEqual(['leave']);
  });

  it('lets a host lock and unlock', () => {
    expect(seatActions('host', seat(), false)).toEqual(['invite', 'lock']);
    expect(seatActions('host', seat({ locked: true }), false)).toEqual(['unlock']);
  });

  it('gives a moderator no seat powers, since they cannot publish', () => {
    expect(seatActions('moderator', seat(), false)).toEqual([]);
  });

  it('does not offer a second seat to someone already seated', () => {
    expect(seatActions('cohost', seat(), true)).toEqual([]);
  });
});
