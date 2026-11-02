# Line Change App: Design

Date: 2026-11-01

## Intent

A youth hockey coach needs a phone app for the bench that makes whistle line changes fast and fair.

Right now the bench is chaotic. The coach is watching play, writing notes on a clipboard, keeping kids hydrated, and fending off kids asking to go back out. A change works like this: at a ref whistle, the coach calls the names of the kids going out, yells "CHANGE", then yells the names of the kids on the ice, because they weren't listening the first time. That burns game time. Kids also get mixed up and the coach doesn't notice until it's too late, so some kids get extra ice time and others sit on the bench through no fault of their own.

**Success:** at the end of a game, every kid who showed up got roughly equal ice time and the coach didn't have to work it out. At a whistle, the coach glances at the phone and calls the names once.

## Context

- Team of 10 kids. Each game one kid plays goalie (chosen at game time, **same goalie the whole game**, confirmed by the coach), so up to 9 skaters. Attendance is rarely complete.
- League plays **4 skaters on the ice**.
- Changes happen **only on a ref whistle**, never on the fly.
- Attendance isn't known until right before the game. Kids arrive late and join mid-game.
- Coach's phone: **Android, Pixel 10 Pro, Chrome**.
- Rinks often have **no signal**, so the app must work fully offline.

## Goals

1. **Roster management:** add, edit, and remove kids, with free-form strength tags and buddy links.
2. **Pre-game setup:** mark who is here, pick the goalie, mark anyone here but not skating, and build a balanced queue.
3. **In-game change screen:** at any moment, clearly show who goes out next, who comes off, and who stays on the bench (or on the ice).
4. **Ice-time tracking** per kid, live.
5. **Buzz** (vibration plus a visual banner) when it's time to change at the next whistle.
6. **Late arrivals** added mid-game with one tap, placed at the front of the queue.
7. **Keep game data** across the season (ice time per kid per game), so stats and graphs can be added later.
8. **Works offline** and installs to the home screen as a PWA.

## Non-goals

- Notes on plays or things to work on. The coach uses a clipboard.
- Hydration tracking.
- Fixed lines. The model is a rotating queue.
- Accounts, a backend, or syncing between devices.
- Stats/graphs UI in v1. The data is kept so this can be added later.
- iOS support beyond "probably works" (iOS web apps can't vibrate).

## Anti-goals (failure even if it "works")

- Too slow or fiddly to use at a whistle: small tap targets, needing to scroll to see who's going out, confirmation dialogs in the hot path.
- Ice time that is quietly wrong, so the app becomes unfair in a way the coach can't see.
- Needing signal at the rink.
- Losing the roster or season data.

## Decided by the coach

### Rotation model
- **Rotating queue**, not fixed lines. Whoever has waited longest goes out next.
- The queue is **balanced once, at game start**, then rotates as is.
- With 9 skaters and 4 spots, groups drift by one kid each cycle. That's accepted: equal time matters more than perfect groups.
- **Late arrivals go to the front of the queue.** They are in the next group going out.

### Tags and balance
- Tags are **free-form strengths**, not a single skill rating. Examples from the coach: strong skaters/players, fast-but-tiny kids who get underestimated, kids still working on things, one kid who doesn't really understand hockey yet.
- **Buddies:** some kids play well together. The coach wants them **next to each other in the queue** so they tend to share shifts.
- At game start the app spreads each tag evenly through the queue, keeps buddies adjacent, and shows the result so the coach can **drag to reorder** before starting.

### In-game screen (layout chosen from mockups)
- Top: period label and current shift timer.
- Banner: **"CHANGE AT NEXT WHISTLE"** appears when the buzz fires and stays until the change is done.
- **Going out:** large names in **green**, each with how long they've sat.
- **Coming off:** large names in **red**, each with their total ice time.
- **Stays on bench:** smaller grey names, with the first marked "next up".
- A huge **CHANGE DONE** button. Tapping it moves the queue and switches whose clocks are running. No confirmation dialog.
- The screen stays awake during a game (Wake Lock API).

Mockup reference: `.superpowers/brainstorm/12159-1793571631/content/game-screen-v2.html`.

### Buzz
- Target shifts are **3 to 5 minutes**. The buzz fires when the current shift reaches **3:00** by default, adjustable in settings. It means "change at the next whistle", not "change now".
- On fire: vibrate (`navigator.vibrate`) plus the banner. My call: vibrate again every 30s until CHANGE DONE, so a missed buzz doesn't go unnoticed.

### Corrections (coach confirmed these are needed)
- **Undo last change.**
- **Swap**: replace a kid on the ice with a kid on the bench, for when the wrong kid goes out or a kid gets hurt.
- **Remove from game / mark not skating** mid-game, for injury or a kid who leaves. A kid removed while on the ice is replaced from the front of the queue.
- **Pause** the clocks between periods and during long stoppages, and **resume**.

### Data
- Roster and every game (attendance, goalie, shifts with start and end times) are **kept on the phone** across the season.

## Builder's calls (made by me, not the coach; open to change)

- **Platform:** static PWA, with a service worker caching all assets and data in IndexedDB (or localStorage, since the data is small). No backend.
- **Rotation mechanics:**
  - On CHANGE DONE, the number going out is `min(4, bench size)`. The kids coming off are the on-ice kids whose current shift started earliest; ties go to more total ice time. This also covers short benches. For example, with 6 skaters, 2 go out, 2 come off, and 2 stay on the ice.
  - Kids coming off go to the back of the queue in the order they were on the ice.
  - If fewer than 4 skaters are available, all of them are on the ice and nothing rotates.
- **Ice time:** wall-clock time while the game clock is running (not paused). The app doesn't track the real game clock, so stoppages count. It's the same for every kid, so fairness holds.
- **Periods:** a simple period label the coach advances (Pause → "Start period 2"). No fixed number of periods.
- **Jersey number:** optional field on each kid.
- **Backup:** export and import all data as a JSON file from settings, so the data isn't lost if the phone or browser storage is cleared.
- **Visuals:** dark, high-contrast theme, readable at arm's length on a bench. Large tap targets.
- **Hosting (coach confirmed):** GitHub Pages under the coach's own account, with a public repo. Roster data never leaves the phone. The service worker has to pick up new deploys reliably, for example with a "new version available, tap to reload" prompt shown only outside a running game.

## Left to the builder

- Framework and tooling. Keep it light and buildable to static files.
- The exact balancing algorithm, within the rules above.
- Visual design details beyond the decided layout.
- How the season data is stored, as long as per-kid, per-game ice time can be recovered later.
