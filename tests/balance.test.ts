import { describe, expect, test } from 'vitest';
import { buildQueue } from '../src/model/balance';
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

  test('buddies are adjacent', () => {
    const ps = players(9, (p) => {
      if (p.id === 'p3') p.buddies = ['p7'];
      if (p.id === 'p7') p.buddies = ['p3'];
    });
    const q = buildQueue(ps);
    expect(Math.abs(q.indexOf('p3') - q.indexOf('p7'))).toBe(1);
  });

  test('absent buddy is ignored', () => {
    const ps = players(5, (p) => { if (p.id === 'p3') p.buddies = ['nobody']; });
    expect(buildQueue(ps)).toContain('p3');
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
