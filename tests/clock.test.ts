import { describe, expect, test } from 'vitest';
import { gameNow, nextPeriod, pause, resume } from '../src/model/clock';
import { makeGame } from './fixtures';

describe('game clock', () => {
  const g = makeGame({ elapsedMs: 0, runningSince: 1000 });

  test('gameNow counts running time', () => {
    expect(gameNow(g, 61000)).toBe(60000);
  });

  test('pause freezes the clock', () => {
    const p = pause(g, 61000);
    expect(gameNow(p, 999999)).toBe(60000);
    expect(p.runningSince).toBeNull();
  });

  test('resume continues from paused value', () => {
    const p = pause(g, 61000);
    expect(gameNow(resume(p, 100000), 130000)).toBe(90000);
  });

  test('pause twice is a no-op', () => {
    const p = pause(g, 61000);
    expect(pause(p, 70000)).toEqual(p);
  });

  test('nextPeriod pauses and increments', () => {
    const n = nextPeriod(g, 61000);
    expect(n.period).toBe(2);
    expect(n.runningSince).toBeNull();
  });
});
