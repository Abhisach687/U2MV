# Universe Splitter 2.0

A futuristic, point-and-click reinterpretation of `Universe Splitter` built as a framework-free static web app. It works best as a binary decision ritual first: you enter two different actions, trigger the split, and let the app tell you which branch this universe selected.

## What You See First

When the app opens, the most important area is the `Split Console` on the Bridge screen.

- The `Sound On` button starts the ambient soundtrack after your first tap or click.
- The `Split Console` is where you enter your two possible actions.
- The glowing hotspot instruments are optional exploration. They add lore and progression, but they do not change the result.
- The `Latest Result` panel shows the branch chosen for the current universe after each split.

## How To Play

1. Open the app and stay on the `Split` screen.
2. If you want music and sound effects, press `Sound On` once.
3. In the first text box, enter one action you could do now.
4. In the second text box, enter a different action you could do instead.
5. Make sure the two actions are genuinely different. The app blocks blank, identical, or nearly identical choices.
6. Press `Split Universe`.
7. Watch the machine-status sequence move through the split ritual.
8. Read `Latest Result` to see which action this universe selected.
9. If you want to compare previous outcomes, open `History`.
10. If you want settings, achievements, music volume, or progression, open `Profile`.

Quick tips:

- If you want the fastest experience, ignore the hotspots and just enter two actions and split.
- Hotspots, missions, and lore are optional. They are there for atmosphere and game-like progression, not for fairness or outcome control.
- The `Music Volume` slider controls the app's music level, but your phone or PC volume still controls the final speaker loudness.
- `Export JSON` saves your profile and branch history so you can restore them later with `Import JSON`.

## Experience

- `Bridge`: the main split console, staged machine ritual, guided mission banner, and optional hotspot interactions.
- `Archive`: branching timeline, branch log, JSON export/import, and discovered lore fragments.
- `Diagnostics`: mastery level, split statistics, achievements, artifacts, and accessibility controls.
- `Field Manual`: onboarding guidance, storage model, and the latest recovered lore notes.

The point-and-click layer is intentionally optional. You can inspect the scene for lore, artifacts, and mission progress without slowing down the core decision flow.

## UI Direction

- Superman-inspired cobalt blue anchors the interface.
- Hot pink and baby pink are used as tertiary highlight colors so the UI keeps energy without losing hierarchy.
- Yellow is reserved for the primary action path and positive emphasis because it complements the blue base and keeps the split action easy to find.
- The bridge layout prioritizes the split workflow first and treats scene exploration as optional.

## Run

This is a static app. Serve the folder with any local static server so the `content/*.json` files can be fetched normally.

Examples:

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

Stub mode preserves the full ritual flow but resolves the branch locally.

## Audio

- The app uses downloaded CC0 Kenney interface sounds for UI taps, relay activation, sweep, success, failure, and mute toggle feedback.
- The default ambient soundtrack now uses the bundled loop `assets/sounds/music/main_loop.mp3`.
- The older `busy_cyberworld.ogg` track is no longer the default runtime music.
- Music and button sounds use separate internal audio buses so UI feedback stays audible while the soundtrack is playing.
- If the music file cannot be played, the app falls back automatically to the procedural ambient bed.
- The `Music Volume` slider defaults to `100%` for the app mix, but the actual speaker loudness still depends on your device or system volume.
- Credits are listed in [`assets/sounds/CREDITS.md`](./assets/sounds/CREDITS.md).
- A quick sound on/off button is available in the main HUD, and the Diagnostics panel keeps the persistent toggle as well.

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
- briefing dismissal state for the current tab

## Export / Import JSON

The Archive view can export the persistent profile as JSON and import it again later.

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

Imports restore persistent state only. Session ritual state is intentionally not imported.

## Accessibility And UX Notes

- sound, flash, shake, and hotspot hints are individually toggleable
- music has its own persistent volume slider
- `prefers-reduced-motion` disables flash and shake by default
- hotspot hints default off on coarse-pointer devices to reduce mobile clutter
- hotspot interactions are buttons, so they remain keyboard accessible
- the core split action is always visible and never hidden behind the game layer
- the bridge screen puts the choice form ahead of the optional discovery panel
- the hotspot readout is docked below the scene instead of floating over controls
- validation is inline and failure states preserve the in-universe machine tone

## Privacy

User-entered choices stay local to the browser. The app does not send decision text to the quantum endpoint; it only fetches a raw random value and maps that to branch `A` or `B` locally.

## License

- Project code: [`GPL-2.0-only`](./LICENSE)
- Bundled third-party audio remains under its original permissive licenses as documented in [`assets/sounds/CREDITS.md`](./assets/sounds/CREDITS.md)

## Files

- [`index.html`](./index.html): app shell and all screens
- [`styles.css`](./styles.css): futuristic HUD styling, motion, and responsive layout
- [`script.js`](./script.js): runtime, split flow, point-and-click layer, storage, JSON import/export
