import { audioColumns, videoLayout, type Rect } from '../layout';

const W = 400;
const H = 500;

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe.each([
  [4, 'grid'],
  [6, 'grid'],
  [9, 'grid'],
  [4, 'stage'],
  [6, 'stage'],
  [9, 'stage'],
] as const)('%i cards in %s layout', (seats, layout) => {
  const rects = videoLayout(seats, layout, W, H);

  it('makes a card for everyone', () => {
    expect(rects).toHaveLength(seats);
  });

  it('keeps every card inside the stage', () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-0.01);
      expect(r.y).toBeGreaterThanOrEqual(-0.01);
      expect(r.x + r.w).toBeLessThanOrEqual(W + 0.01);
      expect(r.y + r.h).toBeLessThanOrEqual(H + 0.01);
      expect(r.w).toBeGreaterThan(40);
      expect(r.h).toBeGreaterThan(40);
    }
  });

  it('overlaps nothing', () => {
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i], rects[j])).toBe(false);
  });
});

describe('layouts', () => {
  it('gives the host the biggest card on stage', () => {
    const [host, ...rest] = videoLayout(6, 'stage', W, H);
    for (const r of rest) expect(host.w * host.h).toBeGreaterThan(r.w * r.h);
  });

  it('gives everyone the same card in a grid', () => {
    const rects = videoLayout(6, 'grid', W, H);
    expect(new Set(rects.map((r) => r.w.toFixed(2))).size).toBe(1);
  });

  it('uses four audio columns for eight seats and five otherwise', () => {
    expect([8, 10, 15].map(audioColumns)).toEqual([4, 5, 5]);
  });
});
