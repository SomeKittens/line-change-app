import { describe, expect, test } from 'vitest';
import { addLate, canUndo, removeFromGame, swap, undo } from '../src/model/corrections';
import { changeDone, iceTimeMs, planChange } from '../src/model/rotation';
import { NINE, started } from './fixtures';

describe('corrections', () => {
  test('late kid goes to front of queue', () => {
    const g = addLate(started(NINE), 'j', 'Jay', 60000);
    expect(g.queue[0]).toBe('j');
    expect(g.names.j).toBe('Jay');
    expect(planChange(g, 180000).goingOut).toContain('j');
  });

  test('late kid fills an empty ice slot', () => {
    const g = addLate(started(['a', 'b', 'c']), 'j', 'Jay', 60000);
    expect(g.onIce).toEqual(['a', 'b', 'c', 'j']);
    expect(iceTimeMs(g, 'j', 120000)).toBe(60000);
  });

  test('removing an on-ice kid pulls next from queue', () => {
    const g = removeFromGame(started(NINE), 'b', 60000);
    expect(g.onIce).toContain('e');
    expect(g.onIce).not.toContain('b');
    expect(g.out).toContain('b');
    expect(g.queue).not.toContain('e');
    expect(iceTimeMs(g, 'b', 999999)).toBe(60000);
  });

  test('removing a bench kid takes them out of the queue', () => {
    const g = removeFromGame(started(NINE), 'g', 60000);
    expect(g.queue).toEqual(['e', 'f', 'h', 'i']);
    expect(g.out).toEqual(['g']);
  });

  test('removing down to 3 skaters leaves all on ice, no change planned', () => {
    const g = removeFromGame(started(['a', 'b', 'c', 'd']), 'c', 60000);
    expect(g.onIce.length).toBe(3);
    expect(planChange(g, 180000).goingOut).toEqual([]);
  });

  test('rejoining kid keeps prior ice time and goes to front', () => {
    let g = removeFromGame(started(NINE), 'b', 60000);
    g = addLate(g, 'b', 'B', 120000);
    expect(g.queue[0]).toBe('b');
    expect(iceTimeMs(g, 'b', 120000)).toBe(60000);
    expect(g.out).not.toContain('b');
  });

  test('swap exchanges ice and bench kid', () => {
    const before = started(NINE);
    const gIndex = before.queue.indexOf('g');
    const g = swap(before, 'a', 'g', 60000);
    expect(g.onIce[0]).toBe('g');
    expect(g.queue[gIndex]).toBe('a');
    expect(g.shifts.find((s) => s.playerId === 'a')!.end).toBe(60000);
    expect(iceTimeMs(g, 'g', 120000)).toBe(60000);
  });

  test('undo reverts last change but not the clock', () => {
    const g = undo(changeDone(started(NINE), 180000));
    expect(g.onIce).toEqual(['a', 'b', 'c', 'd']);
    expect(iceTimeMs(g, 'a', 200000)).toBe(200000);
  });

  test('undo reverts a removal', () => {
    const g = undo(removeFromGame(started(NINE), 'b', 60000));
    expect(g.onIce).toEqual(['a', 'b', 'c', 'd']);
    expect(g.out).toEqual([]);
  });

  test('undo with empty history is a no-op', () => {
    const g = started(NINE);
    expect(canUndo(g)).toBe(false);
    expect(undo(g)).toBe(g);
  });

  test('undo clears the change debounce so the coach can redo immediately', () => {
    const g = undo(changeDone(started(NINE), 180000));
    expect(changeDone(g, 181000).onIce).toEqual(['e', 'f', 'g', 'h']);
  });

  test('history entries record what they undo and when', () => {
    const g = swap(changeDone(started(NINE), 180000), 'e', 'i', 200000);
    expect(g.history.map((h) => [h.label, h.at])).toEqual([['change', 180000], ['swap', 200000]]);
  });
});

