import { gameNow } from './clock';
import { closeShifts, withHistory } from './rotation';
import { ICE_SLOTS, type GameState } from './types';

export function addLate(g: GameState, id: string, name: string, wallNow: number): GameState {
  if (g.onIce.includes(id) || g.queue.includes(id)) return g;
  const now = gameNow(g, wallNow);
  const h = withHistory(g, 'late arrival', wallNow);
  const base = {
    ...h,
    out: g.out.filter((x) => x !== id),
    names: { ...g.names, [id]: name },
    arrivals: { ...g.arrivals, [id]: now },
  };
  const started = g.shifts.length > 0;
  if (started && g.onIce.length < ICE_SLOTS) {
    return { ...base, onIce: [...g.onIce, id], shifts: [...g.shifts, { playerId: id, start: now }] };
  }
  return { ...base, queue: [id, ...g.queue] };
}

export function removeFromGame(g: GameState, id: string, wallNow: number): GameState {
  if (g.out.includes(id)) return g;
  const now = gameNow(g, wallNow);
  const h = withHistory(g, 'remove', wallNow);
  const out = [...g.out, id];
  if (!g.onIce.includes(id)) {
    return { ...h, queue: g.queue.filter((x) => x !== id), out };
  }
  const replacement = g.queue[0];
  const shifts = closeShifts(g.shifts, [id], now);
  return {
    ...h,
    out,
    onIce: [...g.onIce.filter((x) => x !== id), ...(replacement ? [replacement] : [])],
    queue: g.queue.slice(replacement ? 1 : 0),
    shifts: replacement ? [...shifts, { playerId: replacement, start: now }] : shifts,
  };
}

export function swap(g: GameState, iceId: string, benchId: string, wallNow: number): GameState {
  const iceIdx = g.onIce.indexOf(iceId);
  const benchIdx = g.queue.indexOf(benchId);
  if (iceIdx < 0 || benchIdx < 0) return g;
  const now = gameNow(g, wallNow);
  const onIce = [...g.onIce];
  onIce[iceIdx] = benchId;
  const queue = [...g.queue];
  queue[benchIdx] = iceId;
  return {
    ...withHistory(g, 'swap', wallNow),
    onIce,
    queue,
    shifts: [...closeShifts(g.shifts, [iceId], now), { playerId: benchId, start: now }],
  };
}

export function canUndo(g: GameState): boolean {
  return g.history.length > 0;
}

export function undo(g: GameState): GameState {
  const prev = g.history.at(-1);
  if (!prev) return g;
  const { label: _label, at: _at, ...lineup } = prev;
  // Clearing the debounce lets the coach redo a change right after undoing it.
  return { ...g, ...lineup, history: g.history.slice(0, -1), lastChangeWall: null };
}
