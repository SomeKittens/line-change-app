export const ICE_SLOTS = 4;
export const CHANGE_DEBOUNCE_MS = 3000;
export const UNDO_LIMIT = 20;

export interface Player {
  id: string;
  name: string;
  number?: string;
  tags: string[];
  buddies: string[];
  archived?: boolean;
}

export interface Settings {
  buzzAfterSec: number;
  rebuzzEverySec: number;
}

/** Times are game-clock ms (paused time excluded). */
export interface Shift {
  playerId: string;
  start: number;
  end?: number;
}

export interface Lineup {
  /** Ordered by current shift start, earliest first. */
  onIce: string[];
  /** Index 0 is next to go out. */
  queue: string[];
  /** Present but not skating, or removed from the game. */
  out: string[];
  shifts: Shift[];
  /** Game-clock ms when each kid became available. */
  arrivals: Record<string, number>;
  lastChangeAt: number;
}

export interface GameState extends Lineup {
  id: string;
  date: string;
  goalieId: string | null;
  names: Record<string, string>;
  period: number;
  elapsedMs: number;
  /** Wall ms when last resumed; null means paused. */
  runningSince: number | null;
  lastChangeWall: number | null;
  history: Lineup[];
  endedAt?: string;
}

export interface Store {
  version: 1;
  players: Player[];
  tags: string[];
  settings: Settings;
  games: GameState[];
  activeGameId: string | null;
}
