import { GiftQueue, type StageItem } from '../queue';

const gift = (id: string, tier: 'basic' | 'premium' | 'royal' = 'basic'): StageItem => ({
  kind: 'gift',
  id,
  url: 'u',
  icon: 'rose',
  fromName: 'a',
  toName: 'b',
  giftName: 'g',
  count: 1,
  tier,
});
const entrance = (id: string): StageItem => ({ kind: 'entrance', id, url: 'u', name: 'n', frame: 'lion' });

describe('gift queue', () => {
  it('plays in order', () => {
    const q = new GiftQueue();
    q.push(gift('1'));
    q.push(gift('2'));
    expect(q.next()?.id).toBe('1');
    expect(q.next()?.id).toBe('2');
    expect(q.next()).toBeNull();
  });

  it('ignores a message delivered twice', () => {
    const q = new GiftQueue();
    q.push(gift('1'));
    q.push(gift('1'));
    expect(q.size).toBe(1);
  });

  it('stays bounded in a busy room', () => {
    const q = new GiftQueue();
    for (let i = 0; i < 200; i++) q.push(gift(String(i)));
    expect(q.size).toBe(24);
  });

  it('drops entrances, then the cheapest gifts, before a royal one', () => {
    const q = new GiftQueue();
    q.push(gift('royal', 'royal'));
    q.push(entrance('e'));
    for (let i = 0; i < 24; i++) q.push(gift(`b${i}`));
    const ids: string[] = [];
    for (let item = q.next(); item; item = q.next()) ids.push(item.id);
    expect(ids).toContain('royal');
    expect(ids).not.toContain('e');
  });

  it('empties when asked', () => {
    const q = new GiftQueue();
    q.push(gift('1'));
    q.clear();
    expect(q.next()).toBeNull();
  });
});
