import { gameNow, resume } from './clock';
import { CHANGE_DEBOUNCE_MS, ICE_SLOTS, UNDO_LIMIT, type GameState, type Lineup, type Shift } from './types';

export interface ChangePlan {
  goingOut: string[];
  comingOff: string[];
  staying: string[];
}

export function newGame(opts: {
  id: string;
  date: string;
  goalieId: string | null;
  queue: string[];
  out: string[];
  names: Record<string, string>;
}): GameState {
  return {
    ...opts,
    onIce: [],
    shifts: [],
    arrivals: Object.fromEntries(opts.queue.map((id) => [id, 0])),
    lastChangeAt: 0,
    period: 1,
    elapsedMs: 0,
    runningSince: null,
    lastChangeWall: null,
    history: [],
  };
}

export function startGame(g: GameState, wallNow: number): GameState {
  if (g.onIce.length > 0) return g;
  const running = resume(g, wallNow);
  const now = gameNow(running, wallNow);
  const goingOut = g.queue.slice(0, ICE_SLOTS);
  return {
    ...running,
    onIce: goingOut,
    queue: g.queue.slice(goingOut.length),
    shifts: [...g.shifts, ...goingOut.map((playerId) => ({ playerId, start: now }))],
    lastChangeAt: now,
  };
}

/** Copy of the parts of a game that undo restores. */
export function snapshot(g: GameState): Lineup {
  const { onIce, queue, out, shifts, arrivals, lastChangeAt } = g;
  return { onIce, queue, out, shifts, arrivals, lastChangeAt };
}

export function withHistory(g: GameState): GameState {
  return { ...g, history: [...g.history, snapshot(g)].slice(-UNDO_LIMIT) };
}

export function openShiftStart(g: GameState, id: string): number {
  return g.shifts.find((s) => s.playerId === id && s.end === undefined)?.start ?? Infinity;
}

export function closeShifts(shifts: Shift[], ids: string[], now: number): Shift[] {
  return shifts.map((s) => (s.end === undefined && ids.includes(s.playerId) ? { ...s, end: now } : s));
}

export function planChange(g: GameState, wallNow: number): ChangePlan {
  const k = Math.min(ICE_SLOTS, g.queue.length, g.onIce.length);
  const comingOff = [...g.onIce]
    .sort((x, y) => openShiftStart(g, x) - openShiftStart(g, y) || iceTimeMs(g, y, wallNow) - iceTimeMs(g, x, wallNow))
    .slice(0, k);
  return { goingOut: g.queue.slice(0, k), comingOff, staying: g.queue.slice(k) };
}

export function changeDone(g: GameState, wallNow: number): GameState {
  if (g.lastChangeWall !== null && wallNow - g.lastChangeWall < CHANGE_DEBOUNCE_MS) return g;
  const { goingOut, comingOff } = planChange(g, wallNow);
  if (goingOut.length === 0) return g;
  const now = gameNow(g, wallNow);
  const h = withHistory(g);
  // Returning kids rejoin the queue least-ice-time first, so nobody drifts to the back every cycle.
  const returning = [...comingOff].sort((x, y) => iceTimeMs(g, x, wallNow) - iceTimeMs(g, y, wallNow));
  return {
    ...h,
    onIce: [...g.onIce.filter((id) => !comingOff.includes(id)), ...goingOut],
    queue: [...g.queue.slice(goingOut.length), ...returning],
    shifts: [...closeShifts(g.shifts, comingOff, now), ...goingOut.map((playerId) => ({ playerId, start: now }))],
    lastChangeAt: now,
    lastChangeWall: wallNow,
  };
}

export function iceTimeMs(g: GameState, id: string, wallNow: number): number {
  const now = gameNow(g, wallNow);
  return g.shifts.filter((s) => s.playerId === id).reduce((sum, s) => sum + (s.end ?? now) - s.start, 0);
}

export function benchTimeMs(g: GameState, id: string, wallNow: number): number {
  const lastEnd = Math.max(
    g.arrivals[id] ?? 0,
    ...g.shifts.filter((s) => s.playerId === id && s.end !== undefined).map((s) => s.end!),
  );
  return gameNow(g, wallNow) - lastEnd;
}

export function shiftElapsedMs(g: GameState, wallNow: number): number {
  return gameNow(g, wallNow) - g.lastChangeAt;
}
