import { describe, expect, test } from 'vitest';
import { pause, resume } from '../src/model/clock';
import { benchTimeMs, changeDone, iceTimeMs, planChange } from '../src/model/rotation';
import { NINE, started } from './fixtures';


describe('rotation', () => {
  test('start puts first four on ice', () => {
    const g = started(NINE);
    expect(g.onIce).toEqual(['a', 'b', 'c', 'd']);
    expect(g.queue).toEqual(['e', 'f', 'g', 'h', 'i']);
  });

  test('planChange with 9 skaters', () => {
    const p = planChange(started(NINE), 180000);
    expect(p.goingOut).toEqual(['e', 'f', 'g', 'h']);
    expect(p.comingOff).toEqual(['a', 'b', 'c', 'd']);
    expect(p.staying).toEqual(['i']);
  });

  test('changeDone rotates queue', () => {
    const g = changeDone(started(NINE), 180000);
    expect(g.onIce).toEqual(['e', 'f', 'g', 'h']);
    expect(g.queue).toEqual(['i', 'a', 'b', 'c', 'd']);
  });

  test('ice time accumulates', () => {
    const g = changeDone(started(NINE), 180000);
    expect(iceTimeMs(g, 'a', 300000)).toBe(180000);
    expect(iceTimeMs(g, 'e', 300000)).toBe(120000);
  });

  test('bench time since last shift', () => {
    const g = changeDone(started(NINE), 180000);
    expect(benchTimeMs(g, 'a', 300000)).toBe(120000);
  });

  test('short bench with 6 skaters', () => {
    const g0 = started(['a', 'b', 'c', 'd', 'e', 'f']);
    const p = planChange(g0, 180000);
    expect(p.goingOut).toEqual(['e', 'f']);
    expect(p.comingOff).toEqual(['a', 'b']);
    expect(changeDone(g0, 180000).onIce).toEqual(['c', 'd', 'e', 'f']);
  });

  test('ignores a second change within 3 seconds', () => {
    const once = changeDone(started(NINE), 180000);
    const twice = changeDone(once, 181500);
    expect(twice).toEqual(once);
    const later = changeDone(once, 184000);
    expect(later.onIce).toEqual(['i', 'a', 'b', 'c']);
  });

  test('paused time is not ice time', () => {
    const g = resume(pause(started(NINE), 60000), 600000);
    expect(iceTimeMs(g, 'a', 660000)).toBe(120000);
  });

  test.each([5, 6, 7, 8])('fairness with %i skaters', (n) => {
    const ids = NINE.slice(0, n);
    let g = started(ids);
    for (let c = 1; c <= 15; c++) g = changeDone(g, c * 180000);
    const totals = ids.map((id) => iceTimeMs(g, id, 15 * 180000));
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(180000);
  });

  test('fairness over a game', () => {
    let g = started(NINE);
    for (let n = 1; n <= 12; n++) g = changeDone(g, n * 180000);
    const totals = NINE.map((id) => iceTimeMs(g, id, 12 * 180000));
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(180000);
  });

  describe('double shifts on the bench with 9 skaters', () => {
    /** Kids still on the bench after a change who were also on it before: they sit a second shift. */
    function play(shiftMs: (i: number) => number, changes: number) {
      let g = started(NINE);
      let wall = 0;
      const doubles: Record<string, number> = Object.fromEntries(NINE.map((id) => [id, 0]));
      const spreads: number[] = [];
      for (let i = 0; i < changes; i++) {
        wall += shiftMs(i);
        const before = [...g.queue];
        g = changeDone(g, wall);
        g.queue.filter((id) => before.includes(id)).forEach((id) => doubles[id]++);
        const ice = NINE.map((id) => iceTimeMs(g, id, wall));
        spreads.push(Math.max(...ice) - Math.min(...ice));
      }
      return { doubles, spreads };
    }
    const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

    test('even shifts: everyone sits a double shift equally often, in rotation', () => {
      const { doubles } = play(() => 90000, 27);
      expect(new Set(Object.values(doubles))).toEqual(new Set([3]));
    });

    test('uneven shifts: the ice-time gap stays bounded and does not drift', () => {
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      const early: number[] = [];
      const late: number[] = [];
      for (let seed = 1; seed <= 50; seed++) {
        const r = rng(seed);
        const { spreads } = play(() => 60000 + r() * 90000, 80);
        // Typically about one shift apart; a long run of unlucky shift lengths can stretch it toward 2–2.5 long shifts.
        // (Re-sorting the whole bench by ice was tried: barely better on average, worse worst case, and causes triple sits.)
        expect(Math.max(...spreads)).toBeLessThanOrEqual(360000);
        early.push(mean(spreads.slice(10, 30)));
        late.push(mean(spreads.slice(60)));
      }
      expect(mean(late)).toBeLessThanOrEqual(mean(early) + 20000);
    });
  });
});
