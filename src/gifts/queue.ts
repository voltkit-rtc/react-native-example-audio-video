import type { Frame } from '../types';

export type StageItem =
  | {
      kind: 'gift';
      id: string;
      url: string;
      icon: string;
      fromName: string;
      toName: string;
      giftName: string;
      count: number;
      tier: 'basic' | 'premium' | 'royal';
    }
  | { kind: 'entrance'; id: string; url: string; name: string; frame: Frame };

const LIMIT = 24;

/**
 * Waiting gifts, in order. In a busy room the line can outgrow anyone's patience: past the limit the
 * cheapest waiting item goes first, so a royal gift is not dropped to make way for a rose.
 */
export class GiftQueue {
  private items: StageItem[] = [];

  get size() {
    return this.items.length;
  }

  push(item: StageItem) {
    if (this.items.some((i) => i.id === item.id)) return;
    this.items.push(item);
    while (this.items.length > LIMIT) this.items.splice(this.cheapestIndex(), 1);
  }

  next(): StageItem | null {
    return this.items.shift() ?? null;
  }

  clear() {
    this.items = [];
  }

  private cheapestIndex() {
    const rank = (i: StageItem) => (i.kind === 'entrance' ? 0 : i.tier === 'basic' ? 1 : i.tier === 'premium' ? 2 : 3);
    let best = 0;
    for (let i = 1; i < this.items.length; i++) if (rank(this.items[i]) < rank(this.items[best])) best = i;
    return best;
  }
}
