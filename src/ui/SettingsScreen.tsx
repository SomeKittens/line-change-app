import { useState } from 'preact/hooks';
import { VIBRATE_PATTERN } from '../model/buzz';
import type { Settings, Store } from '../model/types';
import { exportJson, importJson } from '../storage/store';
import { fmt } from './GameScreen';
import { useStore } from './useStore';

function Stepper(props: { label: string; noun: string; testId: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void }) {
  const { value, step, min, max, onChange } = props;
  return (
    <div class="stepper">
      <span>{props.label}</span>
      <div class="row">
        <button class="btn" aria-label={`${props.noun} sooner`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <b data-testid={props.testId}>{fmt(value * 1000)}</b>
        <button class="btn" aria-label={`${props.noun} later`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>+</button>
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const [store, update] = useStore();
  const [pending, setPending] = useState<Store | null>(null);
  const [error, setError] = useState('');
  const set = (patch: Partial<Settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJson(store)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `line-change-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    setError('');
    setPending(null);
    if (!file) return;
    try {
      setPending(importJson(await file.text()));
    } catch (err) {
      setError((err as Error).message);
    }
    input.value = '';
  };

  const finished = store.games.filter((g) => g.endedAt).length;

  return (
    <section>
      <h1>Settings</h1>

      <div class="label">Change buzz</div>
      <div class="card">
        <Stepper label="Buzz after" noun="Buzz" testId="buzz-after" value={store.settings.buzzAfterSec} step={15} min={60} max={600} onChange={(v) => set({ buzzAfterSec: v })} />
        <Stepper label="Re-buzz every" noun="Re-buzz" testId="rebuzz-every" value={store.settings.rebuzzEverySec} step={10} min={10} max={120} onChange={(v) => set({ rebuzzEverySec: v })} />
        <button class="btn wide" onClick={() => navigator.vibrate?.(VIBRATE_PATTERN)}>Test buzz</button>
      </div>

      <div class="label">Backup</div>
      <div class="card">
        <p class="muted small" style={{ marginTop: 0 }}>
          Everything lives on this phone only. Save a backup now and then so a cleared browser doesn't wipe your season.
        </p>
        <button class="btn primary wide" onClick={download}>Export backup</button>
        <label class="btn wide file">
          Import backup
          <input type="file" accept="application/json,.json" aria-label="Import backup" onChange={onFile} />
        </label>
        {error && <p class="error">{error}</p>}
        {pending && (
          <button class="btn danger wide" onClick={() => { update(() => pending); setPending(null); }}>
            Tap to replace all data ({pending.players.filter((p) => !p.archived).length} players, {pending.games.length} games)
          </button>
        )}
      </div>

      <p class="muted small">{finished} {finished === 1 ? 'game' : 'games'} saved.</p>
    </section>
  );
}
