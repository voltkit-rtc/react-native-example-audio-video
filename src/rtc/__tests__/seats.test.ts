import { allSeats, applyClaim, firstFreeSeat, pickSeat, seatOf, type Claims } from '../seats';

const none = new Set<string>();

describe('seats', () => {
  it('numbers from one', () => {
    expect(allSeats(3)).toEqual(['seat-1', 'seat-2', 'seat-3']);
  });

  it('counts an away seat as taken: its holder may come back', () => {
    const claims: Claims = { 'seat-1': { identity: 'a', state: 'away' } };
    expect(firstFreeSeat(2, claims, none)).toBe('seat-2');
    expect(seatOf(claims, 'a')).toBe('seat-1');
  });

  it('skips locked seats and runs out', () => {
    const claims: Claims = { 'seat-1': { identity: 'a', state: 'held' } };
    expect(firstFreeSeat(3, claims, new Set(['seat-2']))).toBe('seat-3');
    expect(firstFreeSeat(1, claims, none)).toBeNull();
  });

  it('gives the seat asked for when it is free, else the next one', () => {
    const claims: Claims = { 'seat-2': { identity: 'a', state: 'held' } };
    expect(pickSeat('seat-3', 4, claims, none)).toBe('seat-3');
    expect(pickSeat('seat-2', 4, claims, none)).toBe('seat-1');
    expect(pickSeat(undefined, 4, claims, none)).toBe('seat-1');
  });

  it('ignores a seat that does not exist in this room', () => {
    expect(pickSeat('seat-99', 2, {}, none)).toBe('seat-1');
    expect(pickSeat({ evil: true }, 2, {}, none)).toBe('seat-1');
  });

  it('follows the service through held, away and free', () => {
    let claims: Claims = {};
    claims = applyClaim(claims, { key: 'seat-1', identity: 'a', state: 'held' });
    expect(claims['seat-1']).toEqual({ identity: 'a', state: 'held' });
    claims = applyClaim(claims, { key: 'seat-1', identity: 'a', state: 'away' });
    expect(claims['seat-1'].state).toBe('away');
    claims = applyClaim(claims, { key: 'seat-1', identity: null, state: 'free' });
    expect(claims['seat-1']).toBeUndefined();
  });

  it('does not change the object it was given', () => {
    const claims: Claims = {};
    applyClaim(claims, { key: 'seat-1', identity: 'a', state: 'held' });
    expect(claims).toEqual({});
  });
});
