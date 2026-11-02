# Line Change App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An offline-first PWA for a youth hockey coach's phone. It manages the roster, sets up each game, and runs a fair rotating queue of line changes with live ice time and a "change at next whistle" buzz.

**Architecture:** All game logic is pure TypeScript in `src/model/`, written as functions of the form `(state, ...args, now) => newState`, with no DOM access and fully unit-tested. A single persisted `Store` object lives in `localStorage` and is saved on every change. Preact screens read and update it. Times inside a game are **game-clock milliseconds**: paused time is excluded and the clock is derived from wall timestamps. Because of that, a reload or killed tab resumes with the correct clocks.

**Tech Stack:** Vite 6, TypeScript (strict), Preact 10, Vitest + @testing-library/preact + jsdom, vite-plugin-pwa (Workbox), SortableJS (drag reorder), GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-01-line-change-app-design.md`

## Global Constraints

- 4 skaters on the ice (`ICE_SLOTS = 4`). Goalie is fixed for the whole game and never enters the rotation.
- Buzz default `buzzAfterSec = 180` (3:00), adjustable in settings. Re-buzz every `rebuzzEverySec = 30` until CHANGE DONE.
- Late arrivals go to the **front** of the queue.
- No confirmation dialogs in the in-game hot path (CHANGE DONE, swap, late add). Never use `alert`/`confirm`/`prompt` anywhere.
- No network at runtime: no CDN assets or fonts. Everything is precached by the service worker.
- Dark, high-contrast theme. Tap targets ≥ 48px. CHANGE DONE button ≥ 72px tall, full width.
- Colors: going out names `#4cd964`, coming off names `#ff6b6b`, bench names `#bbb`, banner `#f5a623` on `#111` text.
- Vite `base: '/line-change-app/'` (GitHub Pages project site).
- Data never leaves the phone except through a user-initiated JSON export.

## Review Focus

1. **Tab killed or page reloaded mid-game** (screen lock, app switch). The game resumes exactly where it was and the clocks are still correct. Tested in Task 6 (`resumes active game after reload`).
2. **CHANGE DONE double-tapped** in a frantic moment. Only one change happens. Tested in Task 3 (`ignores a second change within 3 seconds`).
3. **Skaters drop to 4 or fewer mid-game** (removals). No crash and no rotation. Kids stay on the ice and the screen says so. Tested in Task 4 (`removing down to 3 skaters leaves all on ice, no change planned`).
4. **A removed kid comes back** (e.g. after a bandage). They rejoin like a late arrival and keep the ice time they already had. Tested in Task 4 (`rejoining kid keeps prior ice time and goes to front`).
5. **A roster kid is deleted after playing games.** Season data must still show their name. Players are soft-deleted (`archived: true`) and game records snapshot names. Tested in Task 6 (`archiving a player keeps them in past games`).

---

## File Structure

```
index.html
vite.config.ts                 # Preact, PWA plugin, base path, vitest config
tsconfig.json
.github/workflows/deploy.yml
public/icons/icon-192.png, icon-512.png, icon-maskable-512.png
src/
  main.tsx                     # mount <App/>, register SW
  app.css                      # theme tokens + layout
  model/
    types.ts                   # all shared types + constants
    clock.ts                   # game-clock: gameNow, pause, resume, nextPeriod
    rotation.ts                # startGame, planChange, changeDone, iceTimeMs, benchTimeMs, shiftElapsedMs
    corrections.ts             # addLate, removeFromGame, swap, undo
    balance.ts                 # buildQueue
    buzz.ts                    # buzzState (pure)
  storage/
    store.ts                   # load/save/export/import, player CRUD helpers
  ui/
    App.tsx                    # screen routing + store context
    useStore.ts                # hook: [store, update]
    RosterScreen.tsx
    SetupScreen.tsx
    GameScreen.tsx
    SettingsScreen.tsx
    UpdatePrompt.tsx           # SW "new version" banner
    wakeLock.ts                # useWakeLock()
    useBuzz.ts                 # vibration side effect driven by model/buzz.ts
tests/
  clock.test.ts rotation.test.ts corrections.test.ts balance.test.ts
  buzz.test.ts store.test.ts GameScreen.test.tsx
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `src/app.css`, `.gitignore`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` (vitest run), `npm run dev`, `npm run build`, `npm run typecheck` (`tsc --noEmit`).

- [ ] **Step 1:** `git init`. Create `.gitignore` with `node_modules`, `dist`, `.superpowers/`.
- [ ] **Step 2:** `npm init -y`, then `npm i preact sortablejs` and `npm i -D vite @preact/preset-vite typescript vitest jsdom @testing-library/preact vite-plugin-pwa @types/sortablejs`.
- [ ] **Step 3:** Write `vite.config.ts` with `base: '/line-change-app/'`, the `preact()` plugin, and a `test: { environment: 'jsdom' }` block. Leave the PWA plugin out for now (Task 12). Use a strict `tsconfig.json` with `jsxImportSource: "preact"`. `App.tsx` renders `<h1>Line Changes</h1>`. `app.css` defines the dark theme tokens on `:root`.
- [ ] **Step 4:** Write `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)`. Run `npm test`. Expected: 1 passed. Run `npm run build`. Expected: `dist/` produced with no errors.
- [ ] **Step 5:** Commit (include `docs/`).

```bash
git add -A && git commit -m "chore: scaffold Vite + Preact + Vitest project"
```

---

### Task 2: Types and game clock

**Files:**
- Create: `src/model/types.ts`, `src/model/clock.ts`
- Test: `tests/clock.test.ts`

**Interfaces — Produces (`types.ts`):**

```ts
export const ICE_SLOTS = 4;
export const CHANGE_DEBOUNCE_MS = 3000;
export const UNDO_LIMIT = 20;

export interface Player { id: string; name: string; number?: string; tags: string[]; buddies: string[]; archived?: boolean }
export interface Settings { buzzAfterSec: number; rebuzzEverySec: number }   // defaults 180, 30
export interface Shift { playerId: string; start: number; end?: number }     // game-clock ms

export interface Lineup { onIce: string[]; queue: string[]; out: string[]; shifts: Shift[]; arrivals: Record<string, number>; lastChangeAt: number }

export interface GameState extends Lineup {
  id: string;
  date: string;                       // ISO, wall clock
  goalieId: string | null;
  names: Record<string, string>;      // snapshot of every participant's name
  period: number;                     // starts at 1
  elapsedMs: number;                  // game-clock ms accumulated before runningSince
  runningSince: number | null;        // wall ms (Date.now()) when last resumed; null = paused
  lastChangeWall: number | null;      // wall ms of last CHANGE DONE, for debounce
  history: Lineup[];                  // undo stack, newest last, max UNDO_LIMIT
  endedAt?: string;
}

export interface Store { version: 1; players: Player[]; tags: string[]; settings: Settings; games: GameState[]; activeGameId: string | null }
```

`onIce` is ordered by current shift start, earliest first. `queue` front is index 0 (next to go out). `out` holds present-but-not-skating or removed kids. `arrivals[id]` is the game-clock ms when that kid became available.

**Interfaces — Produces (`clock.ts`):**
- `gameNow(g: GameState, wallNow: number): number`, which is `elapsedMs + (runningSince ? wallNow - runningSince : 0)`.
- `pause(g, wallNow): GameState`, `resume(g, wallNow): GameState`, `nextPeriod(g, wallNow): GameState` (pauses if running, increments `period`). All return new objects and are idempotent (pausing a paused game returns it unchanged).

- [ ] **Step 1: Write failing tests** in `tests/clock.test.ts`, using a `makeGame()` fixture with `elapsedMs: 0, runningSince: 1000`:
  - `gameNow counts running time`: `gameNow(g, 61000) === 60000`.
  - `pause freezes the clock`: `p = pause(g, 61000)` gives `gameNow(p, 999999) === 60000` and `p.runningSince === null`.
  - `resume continues from paused value`: `gameNow(resume(p, 100000), 130000) === 90000`.
  - `pause twice is a no-op`: `pause(p, 70000)` toEqual `p`.
  - `nextPeriod pauses and increments`: `n = nextPeriod(g, 61000)` gives `n.period === 2` and `n.runningSince === null`.
- [ ] **Step 2:** Run `npx vitest run tests/clock.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `types.ts` and `clock.ts`.
- [ ] **Step 4:** Run again. Expected: 5 passed.
- [ ] **Step 5:** Commit: `feat(model): game types and pausable game clock`.

---

### Task 3: Rotation (start, plan, change, time totals)

**Files:**
- Create: `src/model/rotation.ts`
- Test: `tests/rotation.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `gameNow` from `clock.ts`.
- Produces:
  - `newGame(opts: { id: string; date: string; goalieId: string | null; queue: string[]; out: string[]; names: Record<string,string> }): GameState`: paused, `period: 1`, nothing on the ice yet.
  - `startGame(g, wallNow): GameState`: moves `queue.slice(0, ICE_SLOTS)` onto the ice, opens their shifts at the current game time, and resumes the clock. Only valid while `onIce` is empty.
  - `planChange(g, wallNow): { goingOut: string[]; comingOff: string[]; staying: string[] }`. `k = min(ICE_SLOTS, queue.length, onIce.length)`. `goingOut = queue.slice(0,k)`. `comingOff` is the first `k` of `onIce`, sorted by open shift start ascending, then by `iceTimeMs` descending, with remaining ties kept in `onIce` order (stable sort). `staying` is the rest of the queue (bench kids not going out).
  - `changeDone(g, wallNow): GameState`. If `lastChangeWall !== null && wallNow - lastChangeWall < CHANGE_DEBOUNCE_MS`, return `g` unchanged. Otherwise push the current `Lineup` to `history` (trim to `UNDO_LIMIT`), close the `comingOff` shifts, open the `goingOut` shifts, set `onIce = remainingOnIce.concat(goingOut)` and `queue = queue.slice(k).concat(comingOff)`, and set `lastChangeAt = gameNow` and `lastChangeWall = wallNow`. If `k === 0`, it's a no-op.
  - `iceTimeMs(g, id, wallNow): number`: sum of shifts, with an open shift running to `gameNow`.
  - `benchTimeMs(g, id, wallNow): number`: `gameNow` minus the latest of (that kid's last shift end, `arrivals[id]`).
  - `shiftElapsedMs(g, wallNow): number`: `gameNow - lastChangeAt`.

- [ ] **Step 1: Write failing tests.** Use a fixture of 9 skaters `a`–`i`, with `startGame` at wall 0.
  - `start puts first four on ice`: `onIce` toEqual `['a','b','c','d']` and `queue` toEqual `['e','f','g','h','i']`.
  - `planChange with 9 skaters`: at wall 180000, `goingOut` is `['e','f','g','h']`, `comingOff` is `['a','b','c','d']`, and `staying` is `['i']`.
  - `changeDone rotates queue`: after the change at 180000, `onIce` is `['e','f','g','h']` and `queue` is `['i','a','b','c','d']`.
  - `ice time accumulates`: `iceTimeMs(g,'a',300000) === 180000` and `iceTimeMs(g,'e',300000) === 120000`.
  - `bench time since last shift`: `benchTimeMs(g,'a',300000) === 120000`.
  - `short bench with 6 skaters`: start `['a'..'f']` and change at 180000. `goingOut` is `['e','f']`, `comingOff` is `['a','b']`, and then `onIce` is `['c','d','e','f']`.
  - `ignores a second change within 3 seconds`: changes at 180000 and 181500 give the same state as one change. A change at 184000 proceeds.
  - `paused time is not ice time`: pause at 60000, resume at 600000, check at 660000. Expected `iceTimeMs(g,'a',660000) === 120000`.
  - `fairness over a game`: 9 skaters, 12 changes every 180000 ms. Max minus min `iceTimeMs` over all kids is ≤ 180000.
- [ ] **Step 2:** Run `npx vitest run tests/rotation.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `rotation.ts`.
- [ ] **Step 4:** Run. Expected: 9 passed.
- [ ] **Step 5:** Commit: `feat(model): rotating queue with ice/bench time`.

---

### Task 4: Corrections (late add, remove, swap, undo)

**Files:**
- Create: `src/model/corrections.ts`
- Test: `tests/corrections.test.ts`

**Interfaces:**
- Consumes: `rotation.ts` (`iceTimeMs`), `clock.ts`, `types.ts`.
- Produces. Every function except `undo` pushes the current `Lineup` onto `history` first:
  - `addLate(g, id: string, name: string, wallNow): GameState`. Sets `arrivals[id] = gameNow` and `names[id] = name`. If `onIce.length < ICE_SLOTS` (and the game has started), the kid goes straight onto the ice with an open shift. Otherwise `queue.unshift(id)`. Also removes `id` from `out`, which is how a removed kid rejoins.
  - `removeFromGame(g, id, wallNow): GameState`. If the kid is on the ice, closes their shift and replaces them with `queue[0]` (if any), whose new shift opens now and is appended to `onIce`. Removes the kid from `queue` and adds them to `out`.
  - `swap(g, iceId, benchId, wallNow): GameState`. Closes `iceId`'s shift and opens `benchId`'s, placing `benchId` at `iceId`'s index in `onIce`. `iceId` takes `benchId`'s former index in `queue`.
  - `undo(g): GameState`. Pops `history` and restores those `Lineup` fields. The clock fields are untouched. With empty history, returns `g`.
  - `canUndo(g): boolean`.

- [ ] **Step 1: Write failing tests.**
  - `late kid goes to front of queue`: 9 skaters running. `addLate(g,'j','Jay',60000)` gives `queue[0] === 'j'`, and the next `planChange` includes `'j'` in `goingOut`.
  - `late kid fills an empty ice slot`: game started with 3 skaters. `addLate` puts the kid straight onto the ice.
  - `removing an on-ice kid pulls next from queue`: remove `'b'` at 60000. `onIce` contains `'e'` and not `'b'`, `out` contains `'b'`, and `iceTimeMs(g,'b',999999) === 60000`.
  - `removing down to 3 skaters leaves all on ice, no change planned`: 4 skaters, remove one. `onIce.length === 3` and `planChange` gives `goingOut: []`.
  - `rejoining kid keeps prior ice time and goes to front`: remove `'b'` at 60000, then `addLate(g,'b','B',120000)`. Expected `queue[0] === 'b'`, `iceTimeMs(g,'b',120000) === 60000`, and `'b'` not in `out`.
  - `swap exchanges ice and bench kid`: `swap(g,'a','g',60000)` gives `onIce[0] === 'g'`, `'a'` at the queue index where `'g'` was, and `a`'s shift closed at 60000.
  - `undo reverts last change but not the clock`: `changeDone` at 180000, then `undo`. `onIce` is back to `['a','b','c','d']` and `iceTimeMs(g,'a',200000) === 200000` (shift continues).
  - `undo with empty history is a no-op`.
- [ ] **Step 2:** Run `npx vitest run tests/corrections.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `corrections.ts`.
- [ ] **Step 4:** Run. Expected: 8 passed. Also run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat(model): late add, remove, swap, undo`.

---

### Task 5: Balanced starting queue

**Files:**
- Create: `src/model/balance.ts`
- Test: `tests/balance.test.ts`

**Interfaces:**
- Consumes: `Player`, `ICE_SLOTS`.
- Produces: `buildQueue(skaters: Player[]): string[]`. Input is present, skating players in roster order (goalie already excluded). Output is ids in queue order. The result is deterministic.

**Algorithm** (the tests don't pin this down, so implement it this way):
1. **Units:** take connected components of `buddies` links, restricted to the skaters present. Within a unit, keep roster order. A unit's tags are the multiset of its members' tags. If a unit has more than `ICE_SLOTS` members, split it into chunks of `ICE_SLOTS`.
2. **Ordering:** place units greedily. At each step, choose the unplaced unit with the lowest penalty. The penalty is: for each tag on the candidate, count how often that tag appears in the last `ICE_SLOTS - 1` placed ids, plus the wrap-around window over the first ids. Break ties by larger unit first (place buddy groups early, while there's room), then by roster order.
3. Flatten into ids.

- [ ] **Step 1: Write failing tests.**
  - `returns every skater exactly once`: 9 players in, output is a permutation of their ids.
  - `spreads a tag`: 8 players, `p1` and `p2` tagged `strong` and adjacent in roster order. In the output, their indices differ by ≥ 2 (both circularly, mod 8).
  - `three strong kids are evenly spaced`: 9 players with 3 tagged `strong`. Every pair of `strong` kids is at circular distance ≥ 3, and no window of 4 consecutive ids (circular) has more than 2 `strong`. Spacing them all ≥ 4 apart is impossible with 9 kids.
  - `buddies are adjacent`: `p3.buddies = ['p7']`, `p7.buddies = ['p3']`. Their output indices differ by exactly 1.
  - `absent buddy is ignored`: `p3` buddies with a player not in the input. No crash, and `p3` is present.
  - `deterministic`: same input twice gives the same output.
- [ ] **Step 2:** Run `npx vitest run tests/balance.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `balance.ts`.
- [ ] **Step 4:** Run. Expected: 6 passed.
- [ ] **Step 5:** Commit: `feat(model): balanced starting queue from tags and buddies`.

---

### Task 6: Persistent store

**Files:**
- Create: `src/storage/store.ts`
- Test: `tests/store.test.ts`

**Interfaces:**
- Consumes: `types.ts`.
- Produces:
  - `STORAGE_KEY = 'line-change-app:v1'`.
  - `defaultStore(): Store`: empty roster, `tags: ['strong','fast','still learning','new to hockey']`, settings `{ buzzAfterSec: 180, rebuzzEverySec: 30 }`.
  - `loadStore(storage: Storage = localStorage): Store`. Missing or corrupt JSON returns `defaultStore()`. If the data is corrupt, the raw string is also copied to `line-change-app:corrupt-<Date.now()>` so nothing is lost.
  - `saveStore(s: Store, storage = localStorage): void`.
  - `exportJson(s: Store): string` (pretty JSON) and `importJson(text: string): Store`. Import throws `Error('Not a Line Change backup')` if `version !== 1` or `players` isn't an array.
  - `upsertPlayer(s, p: Player): Store`. `archivePlayer(s, id): Store` sets `archived: true` and removes `id` from other players' `buddies`.
  - `activeGame(s): GameState | null`. `putGame(s, g): Store` replaces by id or appends.
  - `newId(): string` (`crypto.randomUUID()`).

- [ ] **Step 1: Write failing tests**, using an in-memory `Storage` fake built on a `Map`.
  - `loads defaults when empty`.
  - `round-trips through storage`.
  - `corrupt JSON falls back to defaults and keeps a copy`: storage holds `'{bad'`. Loading returns defaults and a key starting `line-change-app:corrupt-` holds `'{bad'`.
  - `resumes active game after reload`: put a running game with `runningSince: 1000`, save, and load into a new object. `gameNow(loaded, 61000) === 60000` and `onIce` is equal.
  - `export/import round-trip` and `import rejects foreign JSON` (`'{"foo":1}'` throws `'Not a Line Change backup'`).
  - `archiving a player keeps them in past games`: a finished game has `names.x === 'Xavi'`. After `archivePlayer(s,'x')`, the game still has `names.x === 'Xavi'`, the player has `archived === true`, and other players no longer list `'x'` in `buddies`.
- [ ] **Step 2:** Run `npx vitest run tests/store.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `store.ts`.
- [ ] **Step 4:** Run. Expected: 7 passed.
- [ ] **Step 5:** Commit: `feat(storage): localStorage store with backup/import`.

---

### Task 7: Buzz logic, vibration and wake lock

**Files:**
- Create: `src/model/buzz.ts`, `src/ui/useBuzz.ts`, `src/ui/wakeLock.ts`
- Test: `tests/buzz.test.ts`

**Interfaces:**
- Produces:
  - `buzzState(shiftElapsedMs: number, s: Settings): { due: boolean; pulseIndex: number }`. `due` is `elapsed >= buzzAfterSec*1000`. `pulseIndex` is `-1` when not due, otherwise `floor((elapsed - buzzAfterSec*1000) / (rebuzzEverySec*1000))`. Each new `pulseIndex` means a new vibration.
  - `VIBRATE_PATTERN = [400, 200, 400]`.
  - `useBuzz(g: GameState | null, settings: Settings, enabled: boolean): { due: boolean }`. It ticks every 1s with `setInterval`, and only while the clock is running and `planChange` has a non-empty `goingOut`. When `pulseIndex` increases past the last value seen, it calls `navigator.vibrate?.(VIBRATE_PATTERN)`. The last value resets when `lastChangeAt` changes.
  - `useWakeLock(active: boolean): void`. Requests `navigator.wakeLock.request('screen')` while active. It re-requests on `visibilitychange` back to visible, releases on cleanup, and ignores errors silently (unsupported devices).

- [ ] **Step 1: Write failing tests** for `buzzState` with `{buzzAfterSec:180, rebuzzEverySec:30}`:
  - `179999` gives `{due:false,pulseIndex:-1}`. `180000` gives `{due:true,pulseIndex:0}`. `209999` gives pulse 0. `210000` gives pulse 1.
- [ ] **Step 2:** Run `npx vitest run tests/buzz.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement all three files.
- [ ] **Step 4:** Run. Expected: pass. `npm run typecheck` is clean.
- [ ] **Step 5:** Commit: `feat: buzz timing, vibration and screen wake lock`.

---

### Task 8: App shell and roster screen

**Files:**
- Create: `src/ui/useStore.ts`, `src/ui/RosterScreen.tsx`
- Modify: `src/ui/App.tsx`, `src/app.css`

**Interfaces:**
- Consumes: `store.ts`.
- Produces:
  - `StoreContext` and `useStore(): [Store, (fn: (s: Store) => Store) => void]`. `update` applies `fn`, calls `saveStore`, and re-renders.
  - `App` routes between `type Screen = 'roster' | 'setup' | 'game' | 'settings'`, held in component state. If `activeGame(store)` exists at load, it opens `'game'` (resume after reload). Otherwise it opens `'setup'` when the roster is non-empty, else `'roster'`. A bottom nav has Roster / Game / Settings.

**Roster screen behavior:**
- Lists non-archived players with name, `#number`, and tag chips.
- "Add player" opens an inline form with name (required), number (optional), tag toggles from `store.tags` plus "new tag" text input (adds to `store.tags`), and buddy toggles listing the other players. Buddy links are symmetric: saving updates both players.
- The delete action is "Remove from roster" and calls `archivePlayer`. It uses a two-tap inline confirm (the button text changes to "Tap again to remove"), never `confirm()`.

- [ ] **Step 1:** Implement. Run `npm run dev`, open it at a 412×915 viewport (Pixel size), add 3 players with tags and one buddy pair, reload, and check they persist and the buddy pair shows on both players.
- [ ] **Step 2:** `npm test && npm run typecheck`. Expected: all green.
- [ ] **Step 3:** Commit: `feat(ui): roster management`.

---

### Task 9: Game setup screen

**Files:**
- Create: `src/ui/SetupScreen.tsx`

**Interfaces:**
- Consumes: `buildQueue`, `newGame`, `startGame`, `putGame`, `newId`.

**Behavior** (spec order):
1. Every non-archived player gets a large toggle for **Here**, all off by default.
2. A **Goalie** picker lists only present kids. It's a single choice and can be left as none.
3. Present non-goalie kids have a **Not skating** toggle.
4. **Build queue** calls `buildQueue(skating)` and shows the order as a list. Ids 1–4 are labeled "Starting". The list is drag-reorderable with SortableJS (`handle` = a ≥48px grip). "Rebuild" re-runs the balance.
5. **Start game** calls `newGame({ queue, out: notSkating, goalieId, names, ... })` and then `startGame(g, Date.now())`. It stores the game with `activeGameId` and navigates to `'game'`. The button is disabled with fewer than 1 skater.

- [ ] **Step 1:** Implement. Manual check at 412×915: mark 9 here, pick a goalie, build the queue, drag one kid, and start. The game screen opens (a stub is fine until Task 10).
- [ ] **Step 2:** `npm test && npm run typecheck`. Commit: `feat(ui): pre-game attendance, goalie and queue builder`.

---

### Task 10: In-game screen

**Files:**
- Create: `src/ui/GameScreen.tsx`
- Test: `tests/GameScreen.test.tsx`

**Interfaces:**
- Consumes: `planChange`, `changeDone`, `iceTimeMs`, `benchTimeMs`, `shiftElapsedMs`, `addLate`, `removeFromGame`, `swap`, `undo`, `canUndo`, `pause`, `resume`, `nextPeriod`, `useBuzz`, `useWakeLock`.

**Layout** (from the approved mockup `game-screen-v2.html`):
- **Top bar:** `Period N` · shift timer `m:ss` (`shiftElapsedMs`) · Pause/Resume button.
- **Banner:** when `useBuzz(...).due`, show a full-width `CHANGE AT NEXT WHISTLE` (bg `#f5a623`).
- **GOING OUT:** names in `#4cd964`, ≥24px bold, with `bench m:ss` on the right.
- **COMING OFF:** names in `#ff6b6b`, ≥24px bold, with `ice m:ss` total on the right.
- **STAYS ON BENCH:** `#bbb`, 16px. The first one gets a "(next up)" suffix.
- If `goingOut` is empty, replace both groups with an **ON ICE** list and the note "Not enough skaters to change".
- **CHANGE DONE:** full width, ≥72px, green. It calls `changeDone(g, Date.now())`. It's disabled while paused or with nothing to change.
- **Under the button:** a row of secondary actions, each ≥48px. **Undo** (disabled when `!canUndo`), **Late arrival** (sheet listing non-archived roster kids not in the game or in `out`), **Swap / Remove** (sheet: tap an on-ice kid, then tap a bench kid to swap, or tap "Remove from game"), **Next period**, **End game** (two-tap inline confirm; sets `endedAt`, clears `activeGameId`, navigates to `'setup'`).
- **Re-render:** every 1s via a ticking `now` state while the clock is running.
- **Hooks:** `useWakeLock(true)` while mounted. Buzz is enabled while running.

- [ ] **Step 1: Write failing tests** with @testing-library/preact. Render `GameScreen` with a fixture store (9 skaters started, `vi.setSystemTime` 180000 ms later).
  - `shows going out in green and coming off in red`: the elements with text `e`'s name and `a`'s name have computed/inline color `#4cd964` / `#ff6b6b` respectively (assert via `data-role="going-out"` / `"coming-off"` containers).
  - `shows banner when buzz due`: `CHANGE AT NEXT WHISTLE` is visible at 180000 and absent at 100000.
  - `CHANGE DONE rotates`: after the click, the going-out group contains `i`, `a`, `b`, `c`.
  - `undo restores`: click CHANGE DONE, then Undo. The going-out group shows `e`–`h` again.
- [ ] **Step 2:** Run `npx vitest run tests/GameScreen.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: 4 passed. `npm test && npm run typecheck` is all green.
- [ ] **Step 5:** Manual check at 412×915. Everything from the GOING OUT header through the CHANGE DONE button fits without scrolling with 9 skaters.
- [ ] **Step 6:** Commit: `feat(ui): in-game change screen`.

---

### Task 11: Settings screen

**Files:**
- Create: `src/ui/SettingsScreen.tsx`

**Behavior:**
- **Buzz after:** a number stepper in 15s steps, range 60–600s, displayed as `m:ss`. Default 3:00.
- **Re-buzz every:** a stepper in 10s steps, range 10–120s.
- **Test buzz:** a button that calls `navigator.vibrate(VIBRATE_PATTERN)`.
- **Export backup:** downloads `line-change-backup-YYYY-MM-DD.json` via Blob + `<a download>`.
- **Import backup:** `<input type=file accept=application/json>` → `importJson`. On error, show the message inline. On success, replace the store (two-tap confirm: "Tap again to replace all data").
- **Past games:** count only (e.g. "7 games saved"). There's no stats UI (non-goal).

- [ ] **Step 1:** Implement. Manual check: change buzz to 2:00, then reload. It persists. Export, edit the roster, import, and the roster is restored.
- [ ] **Step 2:** `npm test && npm run typecheck`. Commit: `feat(ui): settings, test buzz, backup/restore`.

---

### Task 12: PWA, offline, and GitHub Pages deploy

**Files:**
- Modify: `vite.config.ts`, `src/main.tsx`
- Create: `src/ui/UpdatePrompt.tsx`, `public/icons/*`, `.github/workflows/deploy.yml`

**Interfaces:**
- **PWA plugin:** `VitePWA({ registerType: 'prompt', manifest: { name: 'Line Changes', short_name: 'Lines', display: 'standalone', orientation: 'portrait', background_color: '#111111', theme_color: '#111111', start_url: '/line-change-app/', scope: '/line-change-app/', icons: [...] }, workbox: { globPatterns: ['**/*.{js,css,html,png,svg,ico}'] } })`.
- **`UpdatePrompt`:** uses `useRegisterSW` from `virtual:pwa-register/preact`. When `needRefresh` is set and `activeGameId === null`, it shows a bottom bar "New version available. Tap to update" that calls `updateServiceWorker(true)`. During a game it shows nothing.
- **Icons:** generate simple PNGs (a puck/whistle glyph on `#111`) with a small Node script, or hand-draw an SVG and rasterize it with `npx @vite-pwa/assets-generator`.
- **`deploy.yml`:** on push to `main`, run `npm ci && npm test && npm run build`, then `actions/upload-pages-artifact@v3` (path `dist`) and `actions/deploy-pages@v4`, with permissions `pages: write, id-token: write`.

- [ ] **Step 1:** Implement the config, prompt, and icons. Run `npm run build && npx vite preview`. In Chrome DevTools → Application, the manifest is valid and the SW is activated. Set Network to **Offline** and reload. The app loads and roster data is intact.
- [ ] **Step 2:** `npm test && npm run typecheck`. Commit: `feat: installable offline PWA + Pages deploy workflow`.
- [ ] **Step 3: Ask the coach before doing anything public.** Confirm, then run `gh repo create line-change-app --public --source . --push`. Enable Pages with source "GitHub Actions" (`gh api -X POST repos/{owner}/line-change-app/pages -f build_type=workflow`).
- [ ] **Step 4:** Watch the run with `gh run watch`. Expected: success. Open `https://<owner>.github.io/line-change-app/`. It loads. Give the coach the URL and tell them how to install it: open it in Chrome on the Pixel, use ⋮ → **Add to Home screen**, then open it once while online so it's cached for the rink.
