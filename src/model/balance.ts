import { ICE_SLOTS, type Player } from './types';

/** Groups buddies (connected components among present skaters), keeping roster order. */
function buddyUnits(skaters: Player[]): Player[][] {
  const byId = new Map(skaters.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const units: Player[][] = [];
  for (const p of skaters) {
    if (seen.has(p.id)) continue;
    const members = new Set<string>([p.id]);
    const stack = [p];
    while (stack.length) {
      const cur = stack.pop()!;
      const links = [...cur.buddies, ...skaters.filter((o) => o.buddies.includes(cur.id)).map((o) => o.id)];
      for (const id of links) {
        const other = byId.get(id);
        if (other && !members.has(id)) {
          members.add(id);
          stack.push(other);
        }
      }
    }
    members.forEach((id) => seen.add(id));
    const unit = skaters.filter((s) => members.has(s.id));
    for (let i = 0; i < unit.length; i += ICE_SLOTS) units.push(unit.slice(i, i + ICE_SLOTS));
  }
  return units;
}

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

/**
 * Starting queue for a game: buddies stay adjacent, kids sharing a tag are spread out.
 * Deterministic: local search over unit order, starting from larger units first, then roster order.
 */
export function buildQueue(skaters: Player[]): string[] {
  let units = buddyUnits(skaters)
    .map((u, i) => ({ u, i }))
    .sort((a, b) => b.u.length - a.u.length || a.i - b.i)
    .map(({ u }) => u);
  let best = cost(units.flat());
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < units.length; i++) {
      for (let j = 0; j < units.length; j++) {
        if (i === j) continue;
        // Move unit i to position j (covers swaps of different-sized units).
        const next = [...units];
        const [moved] = next.splice(i, 1);
        next.splice(j, 0, moved);
        const c = cost(next.flat());
        if (c < best - 1e-9) {
          units = next;
          best = c;
          improved = true;
        }
      }
    }
  }
  return units.flat().map((p) => p.id);
}
