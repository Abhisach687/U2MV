# Universe Splitter 2.0

A futuristic, framework-free reinterpretation of `Universe Splitter` built as a static web app. It is designed to feel like a dramatic decision console first, then open into a point-and-click adventure layer after your first resolved branch.

## User Story: How To Navigate The App

You arrive at the Bridge.

The app always opens on `Split`, and sound starts `off` by default. This is intentional. The first visit is supposed to feel calm and readable instead of noisy.

What you should notice first:

- `Split` is the main page and the main action.
- `Sound: Off` is optional. Turn it on only if you want music and button audio.
- The two text boxes are the only inputs you need for your first answer.
- `Split Universe` is the main button.
- `Current Universe` is where the relay assignment appears and where you confirm your real branch if needed.
- `History`, `Profile`, and `Guide` stay visible from the start so you can see the full shape of the app, but they matter more right after the first split.

## First Minute: Step By Step

1. Open the app and stay on `Split`.
2. Ignore the glowing hotspots for your very first run unless you want extra atmosphere.
3. If you want audio, tap `Sound: Off` to turn it on.
4. In `In one universe, I will now`, type one action you could actually do next.
5. In `In the other universe, I will now`, type a different action.
6. Press `Split Universe`.
7. Watch the relay sequence finish.
8. Read `Current Universe` to see the relay assignment.
9. If you actually did the other action in real life, use the confirmation buttons in `Current Universe` to correct the archive.
10. Open `History` to review the branch tree and branch log.
11. Open `Profile` to see settings, achievements, mastery, and progression.
12. Use `Guide` if you want the longer explanation, and use `Guide Me` if you want the app to point at the next important control.

## What `Guide Me` Does

`Guide Me` is the in-app coach.

- Before your first full tour is complete, it highlights the exact next control you should use.
- After the basic tour is complete, it shifts into mission guidance and points you toward the next meaningful quest or exploration step.
- On mobile and desktop, it is meant to remove guessing rather than replace free exploration.

## What Is Required vs Optional

Required for the core loop:

- enter two different actions
- press `Split Universe`
- read `Current Universe`

Optional, game-like layers:

- glowing hotspot instruments
- ritual preparation
- lore fragments
- artifacts
- achievements
- guided missions

These optional systems deepen the atmosphere and progression, but they do not change the fairness of the branch result.

## The Four Main Screens

- `Split`: the main Bridge console where you perform splits and follow the walkthrough.
- `History`: the archive timeline, branch log, import/export tools, and discovered lore.
- `Profile`: settings, sound controls, mastery, achievements, and artifacts.
- `Guide`: the slower explanation of how the system works and what to do next.

## Fastest Way To Play

1. Stay on `Split`.
2. Type two different actions.
3. Press `Split Universe`.
4. Read the relay assignment.
5. Confirm your real branch if you took the other option.

That is the complete fast path.

## Run

This is a static app. Serve the folder with any local static server so the `content/*.json` files can be fetched normally.

Example:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Live And Stub Modes

- Default mode uses the live quantum endpoint at `https://api.freeuniversesplitter.com`.
- Stub mode is useful for demos and offline UI work:

```text
http://localhost:8000/?source=stub
```

Stub mode preserves the ritual flow but resolves the branch locally.

## Audio

- The app boots with sound off by default.
- The quick button in the header shows the current state as `Sound: Off` or `Sound: On`.
- Music uses the bundled track at `assets/sounds/music/main_loop.mp3`.
- Button sounds and music run on separate audio paths so interface feedback stays audible.
- The music loop is smoothed in the runtime instead of relying only on the browser's basic media-element looping.
- If the music track cannot be played, the app falls back to the procedural ambient bed.
- `Music Volume` controls the app mix only. Your phone or PC volume still controls final loudness.
- Credits are listed in [`assets/sounds/CREDITS.md`](./assets/sounds/CREDITS.md).

## Content JSON

The game layer is externalized under [`content/`](./content):

- [`content/hotspots.json`](./content/hotspots.json)
- [`content/missions.json`](./content/missions.json)
- [`content/achievements.json`](./content/achievements.json)
- [`content/lore.json`](./content/lore.json)

If these files cannot be fetched, the app falls back to embedded copies in [`script.js`](./script.js).

## Storage Model

Persistent state uses `localStorage` under the key `universe-splitter-v2-local`.

Stored there:

- split history
- profile XP and level progress
- visited screens
- discovered hotspots and lore
- artifacts
- completed missions
- achievements
- settings
- diagnostics metadata
- music volume preference

Ephemeral tab state uses `sessionStorage` under the key `universe-splitter-v2-session`.

Stored there:

- active hotspot
- hotspots inspected in the current ritual
- whether the optional ritual is ready
- in-progress split run state
- walkthrough guidance state
- temporary guide highlight target

## Export / Import JSON

The `History` screen can export the persistent profile as JSON and import it again later.

Schema shape:

```json
{
  "version": 2,
  "exportedAt": "2026-03-14T00:00:00.000Z",
  "profile": {},
  "history": [],
  "settings": {},
  "diagnostics": {},
  "achievements": {},
  "artifacts": [],
  "loreFlags": [],
  "missions": []
}
```

Imports restore persistent state only. Session walkthrough state is intentionally not imported.

## Accessibility And UX Notes

- sound, flash, shake, and hotspot hints are individually toggleable
- music has its own volume slider
- `prefers-reduced-motion` disables flash and shake by default
- hotspot hints default off on coarse-pointer devices to reduce mobile clutter
- hotspot interactions are buttons, so they remain keyboard accessible
- the app always opens on `Split`
- the start screen guides the player toward the first successful split before pushing the optional adventure systems

## Privacy

User-entered choices stay local to the browser. The app does not send decision text to the quantum endpoint; it only fetches a raw random value and maps that to branch `A` or `B` locally.

## License

- Project code: [`GPL-2.0-only`](./LICENSE)
- Bundled third-party audio remains under its original permissive licenses as documented in [`assets/sounds/CREDITS.md`](./assets/sounds/CREDITS.md)

## Files

- [`index.html`](./index.html): app shell and screen layout
- [`styles.css`](./styles.css): futuristic HUD styling, motion, walkthrough, and responsive layout
- [`script.js`](./script.js): runtime, split flow, walkthrough guidance, audio, storage, and missions
