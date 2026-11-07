import type { GameState, Player } from './types';

/** Sum over pairs sharing tags of shared/d², with d the circular queue distance. Lower is more spread out. */
function cost(order: Player[]): number {
  const n = order.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const shared = order[i].tags.filter((t) => order[j].tags.includes(t)).length;
      if (!shared) continue;
      const d = Math.min(j - i, n - (j - i));
      total += shared / (d * d);
    }
  }
  return total;
}

/** Pairs where a kid with more prior ice time is ahead of one with less. Lower means less-ice kids go earlier. */
function inversions(order: Player[], ice: (p: Player) => number): number {
  let total = 0;
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) if (ice(order[i]) > ice(order[j])) total++;
  }
  return total;
}

/** Orders that keep the same tag spread: every rotation, forwards and reversed (the cost is circular). */
function rotations(order: Player[]): Player[][] {
  const out: Player[][] = [];
  for (const base of [order, [...order].reverse()]) {
    for (let k = 0; k < base.length; k++) out.push([...base.slice(k), ...base.slice(0, k)]);
  }
  return out;
}

/**
 * Average ice time per game for each kid, from finished games they skated in.
 * Kids with no finished games get the average of the others, so they land mid-pack.
 */
export function priorIceMs(games: GameState[], ids: string[]): Record<string, number> {
  const sum: Record<string, number> = {};
  const count: Record<string, number> = {};
  for (const g of games) {
    if (!g.endedAt) continue;
    const perGame: Record<string, number> = {};
    for (const s of g.shifts) perGame[s.playerId] = (perGame[s.playerId] ?? 0) + (s.end ?? s.start) - s.start;
    for (const [id, ms] of Object.entries(perGame)) {
      sum[id] = (sum[id] ?? 0) + ms;
      count[id] = (count[id] ?? 0) + 1;
    }
  }
  const known = ids.filter((id) => count[id]).map((id) => sum[id] / count[id]);
  const fallback = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0;
  return Object.fromEntries(ids.map((id) => [id, count[id] ? sum[id] / count[id] : fallback]));
}

/**
 * Starting queue for a game: kids sharing a tag are spread out, so each line gets a mix.
 * Ties go to whoever has less prior ice time (they go out first), then roster order.
 * Deterministic local search.
 */
export function buildQueue(skaters: Player[], priorIce: Record<string, number> = {}): string[] {
  const ice = (p: Player) => priorIce[p.id] ?? 0;
  const better = (a: Player[], b: Player[]) => {
    const d = cost(a) - cost(b);
    return d < -1e-9 || (Math.abs(d) <= 1e-9 && inversions(a, ice) < inversions(b, ice));
  };
  let order = [...skaters].sort((a, b) => ice(a) - ice(b));
  let improved = true;
  while (improved) {
    improved = false;
    const candidates: Player[][] = rotations(order);
    for (let i = 0; i < order.length; i++) {
      for (let j = 0; j < order.length; j++) {
        if (i === j) continue;
        const next = [...order];
        const [moved] = next.splice(i, 1);
        next.splice(j, 0, moved);
        candidates.push(next);
      }
    }
    for (const next of candidates) {
      if (better(next, order)) {
        order = next;
        improved = true;
      }
    }
  }
  return order.map((p) => p.id);
}
