# Line Changes

A phone app for running fair, fast line changes from a youth hockey bench.

**Use it:** https://rkoutnik.com/line-change-app/

At a whistle, glance at the phone: kids going out are in big green letters, kids coming off in big red. Call the names once, tap **CHANGE DONE**, and the app keeps the rotation fair and tracks everyone's ice time.

## Features

- **Roster:** names, optional jersey numbers, free-form strength tags ("strong", "fast", "still learning", or your own), and "plays well with" buddy links.
- **Game setup:** mark who showed up, pick the goalie, mark anyone here but not skating. The app builds a starting queue that spreads each strength out and keeps buddies together. Drag to adjust.
- **Rotating queue:** 4 skaters on the ice; whoever has waited longest goes out next. Works with any number of skaters. With a short bench, the kids who have been on longest come off.
- **Buzz:** vibrates at 3:00 (adjustable) to mean "change at the next whistle", and again every 30 seconds until you tap CHANGE DONE.
- **Bench-proof corrections:** late arrivals go to the front of the queue. You can swap a kid, remove an injured kid, undo the last action (labeled with what it undoes), pause between periods, and end a forgotten game at the last change.
- **Offline:** installs to the home screen and works with no signal. All data stays on the phone. Export a backup from Settings.

## Install on your phone

1. Open the link above in Chrome on Android.
2. Tap ⋮ → **Add to Home screen**.
3. Open it once while you have signal so it's cached for the rink.

Vibration needs Android. iPhones can run the app but web apps can't vibrate there.

## Development

Built with Vite, Preact, and TypeScript, as a PWA via `vite-plugin-pwa`. Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:5173/line-change-app/
npm test           # Vitest unit + UI tests
npm run typecheck
npm run build      # static output in dist/
```

The rotation, clock, and balancing logic lives in `src/model/` as pure functions with unit tests. Screens are in `src/ui/`, and persistence (localStorage plus JSON backup) is in `src/storage/`.

Every push to `main` is tested, built, and deployed to GitHub Pages by `.github/workflows/deploy.yml`.

The design notes and implementation plan are in `docs/superpowers/`.

## License

[MIT](LICENSE)
