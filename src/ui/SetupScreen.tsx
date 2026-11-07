import Sortable from 'sortablejs';
import { useEffect, useRef, useState } from 'preact/hooks';
import { buildQueue, priorIceMs } from '../model/balance';
import { newGame, startGame } from '../model/rotation';
import { ICE_SLOTS } from '../model/types';
import { newId, putGame } from '../storage/store';
import { useStore } from './useStore';

export function SetupScreen() {
  const [store, update] = useStore();
  const roster = store.players.filter((p) => !p.archived);
  const [here, setHere] = useState<string[]>([]);
  const [goalieId, setGoalieId] = useState<string>('');
  const [notSkating, setNotSkating] = useState<string[]>([]);
  const [queue, setQueue] = useState<string[] | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const present = roster.filter((p) => here.includes(p.id));
  const skaters = present.filter((p) => p.id !== goalieId && !notSkating.includes(p.id));
  const nameOf = (id: string) => roster.find((p) => p.id === id)?.name ?? '?';
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const build = () => buildQueue(skaters, priorIceMs(store.games, skaters.map((p) => p.id)));

  // Any attendance change invalidates a built queue.
  useEffect(() => setQueue(null), [here.join(), goalieId, notSkating.join()]);

  useEffect(() => {
    if (!listRef.current || !queue) return;
    const sortable = Sortable.create(listRef.current, {
      handle: '.grip',
      animation: 150,
      // Pointer-driven dragging behaves the same for touch and mouse; native HTML5 DnD is flaky on Android.
      forceFallback: true,
      onEnd: (e) => {
        const { oldIndex, newIndex, item, from } = e;
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        // Put the DOM back where Preact expects it, then reorder through state.
        from.removeChild(item);
        from.insertBefore(item, from.children[oldIndex] ?? null);
        setQueue((q) => {
          if (!q) return q;
          const next = [...q];
          const [moved] = next.splice(oldIndex, 1);
          next.splice(newIndex, 0, moved);
          return next;
        });
      },
    });
    return () => sortable.destroy();
  }, [queue !== null]);

  const start = () => {
    if (!queue) return;
    const names = Object.fromEntries(present.map((p) => [p.id, p.name]));
    const g = startGame(
      newGame({
        id: newId(),
        date: new Date().toISOString(),
        goalieId: goalieId || null,
        queue,
        out: notSkating.filter((id) => here.includes(id) && id !== goalieId),
        names,
      }),
      Date.now(),
    );
    update((s) => ({ ...putGame(s, g), activeGameId: g.id }));
  };

  if (roster.length === 0) {
    return (
      <section>
        <h1>New game</h1>
        <p class="muted">Add your players on the Roster tab first.</p>
      </section>
    );
  }

  return (
    <section>
      <h1>New game</h1>

      <div class="label">1. Who's here?</div>
      <div class="chips big" data-testid="attendance">
        {roster.map((p) => (
          <button key={p.id} class={`chip ${here.includes(p.id) ? 'on' : ''}`} onClick={() => setHere(toggle(here, p.id))}>
            {p.name}
          </button>
        ))}
      </div>

      <label class="label" for="goalie">2. Goalie</label>
      <select id="goalie" class="select" value={goalieId} onChange={(e) => setGoalieId(e.currentTarget.value)}>
        <option value="">No goalie from roster</option>
        {present.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {present.length > 0 && (
        <>
          <div class="label">3. Here but not skating?</div>
          <div class="chips" data-testid="not-skating">
            {present.filter((p) => p.id !== goalieId).map((p) => (
              <button key={p.id} class={`chip ${notSkating.includes(p.id) ? 'off' : ''}`} onClick={() => setNotSkating(toggle(notSkating, p.id))}>
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}

      <div class="label">4. Queue ({skaters.length} skaters)</div>
      {!queue ? (
        <button class="btn primary wide" disabled={skaters.length === 0} onClick={() => setQueue(build())}>
          Build queue
        </button>
      ) : (
        <>
          <p class="muted small">Drag ≡ to reorder. Top {Math.min(ICE_SLOTS, queue.length)} start on the ice.</p>
          <ol class="queue" ref={listRef}>
            {queue.map((id, i) => (
              <li key={id} class={i < ICE_SLOTS ? 'starting' : ''}>
                <span class="grip" aria-label="Drag to reorder">≡</span>
                <span class="qname">{nameOf(id)}</span>
                <span class="chips small">
                  {roster.find((p) => p.id === id)?.tags.map((t) => <span key={t} class="chip on">{t}</span>)}
                </span>
                {i < ICE_SLOTS && <span class="tag-start">Starting</span>}
              </li>
            ))}
          </ol>
          <div class="row">
            <button class="btn" onClick={() => setQueue(build())}>Rebuild</button>
            <button class="btn go" style={{ flex: 1 }} onClick={start}>Start game</button>
          </div>
        </>
      )}
    </section>
  );
}
