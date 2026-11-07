import { useEffect, useRef, useState } from 'preact/hooks';
import type { Player, Store } from '../model/types';
import { archivePlayer, newId, upsertPlayer } from '../storage/store';
import { useStore } from './useStore';

/** Saves a player and keeps buddy links symmetric across the roster. */
function savePlayer(s: Store, p: Player): Store {
  let next = upsertPlayer(s, p);
  for (const other of next.players) {
    if (other.id === p.id) continue;
    const linked = p.buddies.includes(other.id);
    const has = other.buddies.includes(p.id);
    if (linked !== has) {
      next = upsertPlayer(next, {
        ...other,
        buddies: linked ? [...other.buddies, p.id] : other.buddies.filter((b) => b !== p.id),
      });
    }
  }
  return next;
}

function PlayerForm({ initial, onDone }: { initial: Player; onDone: () => void }) {
  const [store, update] = useStore();
  const [p, setP] = useState(initial);
  const [newTag, setNewTag] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isNew = !store.players.some((o) => o.id === p.id);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isNew) nameRef.current?.focus();
  }, []);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const addTag = () => {
    const t = newTag.trim();
    if (!t) return;
    if (!store.tags.includes(t)) update((s) => ({ ...s, tags: [...s.tags, t] }));
    setP({ ...p, tags: p.tags.includes(t) ? p.tags : [...p.tags, t] });
    setNewTag('');
  };

  return (
    <div class="card form">
      <label>
        Name
        <input value={p.name} ref={nameRef} onInput={(e) => setP({ ...p, name: e.currentTarget.value })} />
      </label>
      <label>
        Jersey # (optional)
        <input inputMode="numeric" value={p.number ?? ''} onInput={(e) => setP({ ...p, number: e.currentTarget.value || undefined })} />
      </label>
      <div class="label">Strengths</div>
      <div class="chips">
        {store.tags.map((t) => (
          <button key={t} class={`chip ${p.tags.includes(t) ? 'on' : ''}`} onClick={() => setP({ ...p, tags: toggle(p.tags, t) })}>
            {t}
          </button>
        ))}
      </div>
      <div class="row">
        <input placeholder="New tag" value={newTag} onInput={(e) => setNewTag(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} />
        <button class="btn" onClick={addTag}>Add tag</button>
      </div>
      <div class="row">
        <button
          class="btn primary"
          disabled={!p.name.trim()}
          onClick={() => {
            update((s) => savePlayer(s, { ...p, name: p.name.trim() }));
            onDone();
          }}
        >
          Save
        </button>
        <button class="btn" onClick={onDone}>Cancel</button>
        {!isNew && (
          <button
            class="btn danger"
            onClick={() => {
              if (!confirmRemove) return setConfirmRemove(true);
              update((s) => archivePlayer(s, p.id));
              onDone();
            }}
          >
            {confirmRemove ? 'Tap again to remove' : 'Remove from roster'}
          </button>
        )}
      </div>
    </div>
  );
}

export function RosterScreen() {
  const [store] = useStore();
  const [editing, setEditing] = useState<Player | null>(null);
  const players = store.players.filter((p) => !p.archived);

  return (
    <section>
      <h1>Roster</h1>
      {players.length === 0 && !editing && <p class="muted">No players yet. Add your team below.</p>}
      <ul class="list">
        {players.map((p) =>
          editing?.id === p.id ? (
            <li key={p.id}><PlayerForm initial={p} onDone={() => setEditing(null)} /></li>
          ) : (
            <li key={p.id}>
              <button class="player-row" onClick={() => setEditing(p)}>
                <span class="pname">
                  {p.number && <span class="num">#{p.number}</span>} {p.name}
                </span>
                <span class="chips small">
                  {p.tags.map((t) => <span key={t} class="chip on">{t}</span>)}
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
      {editing && !store.players.some((p) => p.id === editing.id) ? (
        <PlayerForm initial={editing} onDone={() => setEditing(null)} />
      ) : (
        <button class="btn primary wide" onClick={() => setEditing({ id: newId(), name: '', tags: [], buddies: [] })}>
          + Add player
        </button>
      )}
    </section>
  );
}
