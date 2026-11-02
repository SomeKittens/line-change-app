import type { GameState } from '../src/model/types';

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
