import { gameNow, pause } from '../model/clock';
import { closeShifts } from '../model/rotation';
import type { GameState, Player, Store } from '../model/types';

export const STORAGE_KEY = 'line-change-app:v1';

export function defaultStore(): Store {
  return {
    version: 1,
    players: [],
    tags: ['strong', 'fast', 'still learning', 'new to hockey'],
    settings: { buzzAfterSec: 180, rebuzzEverySec: 30 },
    games: [],
    activeGameId: null,
  };
}

function isStore(x: unknown): x is Store {
  const s = x as Store;
  return !!s && s.version === 1 && Array.isArray(s.players) && Array.isArray(s.games);
}

export function loadStore(storage: Storage = localStorage): Store {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return defaultStore();
  try {
    const parsed = JSON.parse(raw);
    if (isStore(parsed)) return { ...defaultStore(), ...parsed };
  } catch {
    // fall through
  }
  storage.setItem(`line-change-app:corrupt-${Date.now()}`, raw);
  return defaultStore();
}

export function saveStore(s: Store, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function exportJson(s: Store): string {
  return JSON.stringify(s, null, 2);
}

export function importJson(text: string): Store {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Not a Line Change backup');
  }
  if (!isStore(parsed)) throw new Error('Not a Line Change backup');
  return { ...defaultStore(), ...parsed };
}

export function upsertPlayer(s: Store, p: Player): Store {
  const exists = s.players.some((x) => x.id === p.id);
  return { ...s, players: exists ? s.players.map((x) => (x.id === p.id ? p : x)) : [...s.players, p] };
}

export function archivePlayer(s: Store, id: string): Store {
  return {
    ...s,
    players: s.players.map((p) =>
      p.id === id ? { ...p, archived: true, buddies: [] } : { ...p, buddies: p.buddies.filter((b) => b !== id) },
    ),
  };
}

export function activeGame(s: Store): GameState | null {
  return s.games.find((g) => g.id === s.activeGameId) ?? null;
}

export function putGame(s: Store, g: GameState): Store {
  const exists = s.games.some((x) => x.id === g.id);
  return { ...s, games: exists ? s.games.map((x) => (x.id === g.id ? g : x)) : [...s.games, g] };
}

/**
 * Ends the active game: freezes the clock, closes open shifts, and drops undo history to keep storage small.
 * With atLastChange, the game ends at the last change instead of now, for a game left running after the final whistle.
 */
export function finishGame(s: Store, wallNow: number, opts: { atLastChange?: boolean } = {}): Store {
  const g = activeGame(s);
  if (!g) return s;
  const paused = pause(g, wallNow);
  const end = opts.atLastChange ? Math.min(g.lastChangeAt, paused.elapsedMs) : paused.elapsedMs;
  const done: GameState = {
    ...paused,
    elapsedMs: end,
    shifts: closeShifts(g.shifts, g.onIce, end),
    history: [],
    endedAt: new Date(wallNow).toISOString(),
  };
  return { ...putGame(s, done), activeGameId: null };
}

export function newId(): string {
  return crypto.randomUUID();
}
