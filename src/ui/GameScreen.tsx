import { useEffect, useState } from 'preact/hooks';
import { gameNow, nextPeriod, pause, resume } from '../model/clock';
import { addLate, canUndo, removeFromGame, swap, undo } from '../model/corrections';
import { benchTimeMs, changeDone, iceTimeMs, planChange, shiftElapsedMs } from '../model/rotation';
import type { GameState } from '../model/types';
import { activeGame, finishGame, putGame } from '../storage/store';
import { useBuzz } from './useBuzz';
import { useStore } from './useStore';
import { useWakeLock } from './wakeLock';

export function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type Sheet = null | 'late' | 'fix';

export function GameScreen() {
  const [store, update] = useStore();
  const g = activeGame(store)!;
  const [now, setNow] = useState(Date.now());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useWakeLock(true);
  const { due } = useBuzz(g, store.settings, now);

  const act = (fn: (g: GameState, wall: number) => GameState) => {
    const wall = Date.now();
    setNow(wall);
    update((s) => {
      const cur = activeGame(s);
      return cur ? putGame(s, fn(cur, wall)) : s;
    });
  };
  const closeSheet = () => {
    setSheet(null);
    setPicked(null);
  };

  const running = g.runningSince !== null;
  const plan = planChange(g, now);
  const name = (id: string) => g.names[id] ?? '?';
  const canChange = plan.goingOut.length > 0;
  const lateCandidates = store.players.filter((p) => !p.archived && p.id !== g.goalieId && !g.onIce.includes(p.id) && !g.queue.includes(p.id));

  const Row = ({ id, detail }: { id: string; detail: string }) => (
    <div class="gname">
      <span data-testid="name">{name(id)}</span>
      <small>{detail}</small>
    </div>
  );

  return (
    <section class="game">
      <div class="topbar">
        <span>Period {g.period}</span>
        <span>
          Shift <b data-testid="shift-timer">{fmt(shiftElapsedMs(g, now))}</b>
        </span>
        <button class={`btn ${running ? '' : 'primary'}`} onClick={() => act((x, w) => (running ? pause(x, w) : resume(x, w)))}>
          {running ? 'Pause' : 'Resume'}
        </button>
      </div>

      {!running && <div class="paused">Clock paused · ice time not counting</div>}
      {due && <div class="banner">CHANGE AT NEXT WHISTLE</div>}

      {canChange ? (
        <>
          <div class="group going-out" data-testid="going-out">
            <div class="glabel">Going out</div>
            {plan.goingOut.map((id) => <Row key={id} id={id} detail={`bench ${fmt(benchTimeMs(g, id, now))}`} />)}
          </div>
          <div class="group coming-off" data-testid="coming-off">
            <div class="glabel">Coming off</div>
            {plan.comingOff.map((id) => <Row key={id} id={id} detail={`ice ${fmt(iceTimeMs(g, id, now))}`} />)}
          </div>
          {plan.staying.length > 0 && (
            <div class="group staying" data-testid="staying">
              <div class="glabel">Stays on bench</div>
              {plan.staying.map((id, i) => (
                <div key={id} class="gname small-name">
                  <span data-testid="name">{name(id)}</span>
                  {i === 0 && <small>next up</small>}
                </div>
              ))}
            </div>
          )}
          {g.onIce.length > plan.comingOff.length && (
            <div class="group staying">
              <div class="glabel">Stays on ice</div>
              {g.onIce.filter((id) => !plan.comingOff.includes(id)).map((id) => (
                <div key={id} class="gname small-name"><span>{name(id)}</span></div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div class="group">
          <div class="glabel">On ice</div>
          {g.onIce.map((id) => <Row key={id} id={id} detail={`ice ${fmt(iceTimeMs(g, id, now))}`} />)}
          <p class="muted">Not enough skaters to change.</p>
        </div>
      )}

      <button class="change" disabled={!running || !canChange} onClick={() => act(changeDone)}>
        CHANGE DONE
      </button>

      <div class="actions">
        <button class="btn" disabled={!canUndo(g)} onClick={() => act((x) => undo(x))}>Undo</button>
        <button class={`btn ${sheet === 'late' ? 'primary' : ''}`} onClick={() => (sheet === 'late' ? closeSheet() : (closeSheet(), setSheet('late')))}>
          Late arrival
        </button>
        <button class={`btn ${sheet === 'fix' ? 'primary' : ''}`} onClick={() => (sheet === 'fix' ? closeSheet() : (closeSheet(), setSheet('fix')))}>
          Swap / Remove
        </button>
      </div>

      {sheet === 'late' && (
        <div class="card sheet">
          <div class="glabel">Who just arrived? They go out next.</div>
          {lateCandidates.length === 0 && <p class="muted">Everyone on the roster is already in the game.</p>}
          <div class="chips big">
            {lateCandidates.map((p) => (
              <button key={p.id} class="chip" onClick={() => { act((x, w) => addLate(x, p.id, p.name, w)); closeSheet(); }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {sheet === 'fix' && (
        <div class="card sheet">
          <div class="glabel">{picked ? `${name(picked)}: swap with a bench kid, or remove` : 'Tap a kid on the ice (or on the bench to remove)'}</div>
          <div class="label">On ice</div>
          <div class="chips big">
            {g.onIce.map((id) => (
              <button key={id} class={`chip ${picked === id ? 'on' : ''}`} onClick={() => setPicked(picked === id ? null : id)}>{name(id)}</button>
            ))}
          </div>
          <div class="label">Bench</div>
          <div class="chips big">
            {g.queue.map((id) => (
              <button
                key={id}
                class={`chip ${picked === id ? 'on' : ''}`}
                onClick={() => {
                  if (picked && g.onIce.includes(picked)) {
                    act((x, w) => swap(x, picked, id, w));
                    closeSheet();
                  } else setPicked(picked === id ? null : id);
                }}
              >
                {name(id)}
              </button>
            ))}
          </div>
          {picked && (
            <button class="btn danger wide" onClick={() => { act((x, w) => removeFromGame(x, picked, w)); closeSheet(); }}>
              Remove {name(picked)} from game
            </button>
          )}
          {g.out.length > 0 && <p class="muted small">Out: {g.out.map(name).join(', ')}. Use Late arrival to bring someone back.</p>}
        </div>
      )}

      <div class="actions">
        <button class="btn" onClick={() => act(nextPeriod)}>Next period</button>
        <button
          class="btn danger"
          onClick={() => {
            if (!confirmEnd) {
              setConfirmEnd(true);
              setTimeout(() => setConfirmEnd(false), 4000);
              return;
            }
            update((s) => finishGame(s, Date.now()));
          }}
        >
          {confirmEnd ? 'Tap again to end' : 'End game'}
        </button>
      </div>

      <details class="totals">
        <summary>Ice time so far</summary>
        <ol>
          {[...g.onIce, ...g.queue, ...g.out]
            .map((id) => ({ id, ms: iceTimeMs(g, id, now) }))
            .sort((a, b) => a.ms - b.ms)
            .map(({ id, ms }) => (
              <li key={id}>
                <span>{name(id)}{g.out.includes(id) ? ' (out)' : ''}</span>
                <span>{fmt(ms)}</span>
              </li>
            ))}
        </ol>
        <p class="muted small">Game clock {fmt(gameNow(g, now))}</p>
      </details>
    </section>
  );
}
