import type { GameState } from './types';

export function gameNow(g: GameState, wallNow: number): number {
  return g.elapsedMs + (g.runningSince !== null ? wallNow - g.runningSince : 0);
}

export function pause(g: GameState, wallNow: number): GameState {
  if (g.runningSince === null) return g;
  return { ...g, elapsedMs: gameNow(g, wallNow), runningSince: null };
}

export function resume(g: GameState, wallNow: number): GameState {
  if (g.runningSince !== null) return g;
  return { ...g, runningSince: wallNow };
}

export function nextPeriod(g: GameState, wallNow: number): GameState {
  return { ...pause(g, wallNow), period: g.period + 1 };
}
