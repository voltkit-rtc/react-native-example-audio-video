/**
 * Seats are VoltKit slots: named places one person holds at a time, kept by the service.
 * These are pure functions over the claims, with no SDK calls, so they are easy to test and to reuse.
 * Guide: docs/rooms-roles-seats.md
 */
export interface SeatClaim {
  identity: string;
  state: 'held' | 'away';
}

export type Claims = Record<string, SeatClaim>;

export const seatKey = (n: number) => `seat-${n}`;
export const seatNumber = (key: string) => Number(key.replace('seat-', ''));
export const allSeats = (count: number) => Array.from({ length: count }, (_, i) => seatKey(i + 1));

/** The seat someone holds. Away counts: their connection dropped and the service keeps it for them. */
export function seatOf(claims: Claims, identity: string): string | null {
  for (const [key, claim] of Object.entries(claims)) if (claim.identity === identity) return key;
  return null;
}

export function firstFreeSeat(count: number, claims: Claims, locked: ReadonlySet<string>): string | null {
  return allSeats(count).find((key) => !claims[key] && !locked.has(key)) ?? null;
}

/** The seat to give someone: the one they asked for if it is still free, else the next free one. */
export function pickSeat(wanted: unknown, count: number, claims: Claims, locked: ReadonlySet<string>): string | null {
  if (typeof wanted === 'string' && allSeats(count).includes(wanted) && !claims[wanted] && !locked.has(wanted)) return wanted;
  return firstFreeSeat(count, claims, locked);
}

export interface ClaimEvent {
  key: string;
  identity: string | null;
  state: 'held' | 'away' | 'free' | 'blocked';
}

export function applyClaim(claims: Claims, e: ClaimEvent): Claims {
  const next = { ...claims };
  if ((e.state === 'held' || e.state === 'away') && e.identity) next[e.key] = { identity: e.identity, state: e.state };
  else delete next[e.key];
  return next;
}
