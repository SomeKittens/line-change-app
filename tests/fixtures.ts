import { newGame, startGame } from '../src/model/rotation';
import type { GameState } from '../src/model/types';

export const NINE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

export function started(ids: string[], wall = 0): GameState {
  const names = Object.fromEntries(ids.map((id) => [id, id.toUpperCase()]));
  return startGame(newGame({ id: 'g', date: '2026-11-01', goalieId: null, queue: ids, out: [], names }), wall);
}

export function makeGame(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'g1',
    date: '2026-11-01T10:00:00.000Z',
    goalieId: null,
    names: {},
    period: 1,
    elapsedMs: 0,
    runningSince: 1000,
    lastChangeWall: null,
    history: [],
    onIce: [],
    queue: [],
    out: [],
    shifts: [],
    arrivals: {},
    lastChangeAt: 0,
    ...overrides,
  };
}

export function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}
