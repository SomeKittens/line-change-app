import { describe, expect, test } from 'vitest';
import { buildQueue, priorIceMs } from '../src/model/balance';
import { makeGame } from './fixtures';
import type { Player } from '../src/model/types';

function players(n: number, edit: (p: Player, i: number) => void = () => {}): Player[] {
  return Array.from({ length: n }, (_, i) => {
    const p: Player = { id: `p${i + 1}`, name: `P${i + 1}`, tags: [], buddies: [] };
    edit(p, i);
    return p;
  });
}

const circDist = (i: number, j: number, n: number) => Math.min(Math.abs(i - j), n - Math.abs(i - j));

describe('buildQueue', () => {
  test('returns every skater exactly once', () => {
    const ps = players(9);
    expect([...buildQueue(ps)].sort()).toEqual(ps.map((p) => p.id).sort());
  });

  test('spreads a tag', () => {
    const ps = players(8, (p, i) => { if (i < 2) p.tags = ['strong']; });
    const q = buildQueue(ps);
    expect(circDist(q.indexOf('p1'), q.indexOf('p2'), 8)).toBeGreaterThanOrEqual(2);
  });

  test('three strong kids are evenly spaced', () => {
    const ps = players(9, (p, i) => { if (i < 3) p.tags = ['strong']; });
    const q = buildQueue(ps);
    const idx = ['p1', 'p2', 'p3'].map((id) => q.indexOf(id));
    for (const a of idx) for (const b of idx) if (a !== b) expect(circDist(a, b, 9)).toBeGreaterThanOrEqual(3);
    for (let s = 0; s < 9; s++) {
      const window = [0, 1, 2, 3].map((k) => q[(s + k) % 9]);
      expect(window.filter((id) => ['p1', 'p2', 'p3'].includes(id)).length).toBeLessThanOrEqual(2);
    }
  });

  test('ignores buddy links', () => {
    const ps = players(9, (p) => {
      if (p.id === 'p1') { p.buddies = ['p2']; p.tags = ['strong']; }
      if (p.id === 'p2') { p.buddies = ['p1']; p.tags = ['strong']; }
    });
    const q = buildQueue(ps);
    expect(circDist(q.indexOf('p1'), q.indexOf('p2'), 9)).toBeGreaterThanOrEqual(2);
  });

  test('without tags, less prior ice time goes first', () => {
    const ps = players(5);
    const ice = { p1: 500, p2: 100, p3: 400, p4: 200, p5: 300 };
    expect(buildQueue(ps, ice)).toEqual(['p2', 'p4', 'p5', 'p3', 'p1']);
  });

  test('ice time breaks ties but does not override tag spread', () => {
    // p1 and p2 are both strong and have the least ice; they cannot both start next to each other.
    const ps = players(8, (p, i) => { if (i < 2) p.tags = ['strong']; });
    const ice = Object.fromEntries(ps.map((p, i) => [p.id, i * 100]));
    const q = buildQueue(ps, ice);
    expect(q[0]).toBe('p1');
    expect(circDist(q.indexOf('p1'), q.indexOf('p2'), 8)).toBe(4);
  });

  test('equal ice time keeps roster order', () => {
    expect(buildQueue(players(4), { p1: 7, p2: 7, p3: 7, p4: 7 })).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  test('deterministic', () => {
    const ps = players(9, (p, i) => { p.tags = i % 3 === 0 ? ['strong'] : i % 3 === 1 ? ['fast'] : ['learning']; });
    expect(buildQueue(ps)).toEqual(buildQueue(ps));
  });

  test('mixed tags each spread out', () => {
    const ps = players(9, (p, i) => { p.tags = i < 3 ? ['strong'] : i < 6 ? ['fast'] : ['learning']; });
    const q = buildQueue(ps);
    for (const tag of ['strong', 'fast', 'learning']) {
      const idx = ps.filter((p) => p.tags.includes(tag)).map((p) => q.indexOf(p.id));
      for (const a of idx) for (const b of idx) if (a !== b) expect(circDist(a, b, 9)).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('priorIceMs', () => {
  const game = (ended: boolean, shifts: [string, number, number][]) =>
    makeGame({ endedAt: ended ? '2026-11-01T11:00:00.000Z' : undefined, shifts: shifts.map(([playerId, start, end]) => ({ playerId, start, end })) });

  test('averages per finished game the kid skated in', () => {
    const games = [
      game(true, [['a', 0, 100], ['a', 200, 300], ['b', 0, 50]]),
      game(true, [['a', 0, 400]]),
      game(false, [['b', 0, 9999]]),
    ];
    expect(priorIceMs(games, ['a', 'b'])).toEqual({ a: 300, b: 50 });
  });

  test('kids with no history get the average of the others', () => {
    const games = [game(true, [['a', 0, 100], ['b', 0, 300]])];
    expect(priorIceMs(games, ['a', 'b', 'new'])).toEqual({ a: 100, b: 300, new: 200 });
  });

  test('no history at all is zero for everyone', () => {
    expect(priorIceMs([], ['a', 'b'])).toEqual({ a: 0, b: 0 });
  });
});
