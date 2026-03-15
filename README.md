# Universe Splitter 2.0

A futuristic, framework-free reinterpretation of `Universe Splitter` built as a static web app. It is designed to feel like a dramatic decision console first, then open into a point-and-click adventure layer after your first resolved branch.

It now also includes a `Current Universe Statistical Estimator` that uses confirmed branch history to build:

- a frequentist estimate
- a Bayesian estimate
- a weighted synthesis of both

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

- On first launch, it works as a formal tutorial mode layered onto the Bridge.
- While the tutorial is incomplete, it resumes the exact next step, highlights the right control, and keeps the fast route clear.
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

## Current Universe Estimator

The app has two separate ideas on purpose:

- the relay assignment, which is random
- the current-universe estimate, which is an evidence-based interpretation layer over your confirmed behavior

How the estimator works:

- it uses only confirmed branch history, meaning records where you explicitly confirmed what you really did
- it ignores unconfirmed relay-only outcomes
- it treats the confirmed branch as a Bernoulli outcome with two possibilities: `A` or `B`
- it keeps a three-layer surface on `Split`:
  - latest explicit confirmation
  - model guess now
  - broader behavior pattern
- it keeps the deeper frequentist and Bayesian breakdown on `Profile`
- it lets recent confirmed choices matter more once at least five confirmations exist

The estimator does not change the relay result. `Current Universe` is still where the relay assignment and your confirmation live; the prediction card is a separate interpretation surface.

## The Four Main Screens

- `Split`: the main Bridge console where you perform splits and follow the tutorial shell or mission guidance.
- `History`: the archive timeline, branch log, import/export tools, and discovered lore.
- `Profile`: settings, sound controls, mastery, diagnostics, the statistical estimator, achievements, and artifacts.
- `Guide`: the calmer reference surface, plus a place to restart the tutorial route later.

## Fastest Way To Play

1. Stay on `Split`.
2. Type two different actions.
3. Press `Split Universe`.
4. Read the relay assignment.
5. Confirm your real branch if you took the other option.

That is the complete fast path.

## How The App Works

At runtime, the app follows this loop:

1. The browser loads the static shell from `index.html`, the styles from `styles.css`, and the runtime from `script.js`.
2. `script.js` restores local state from browser storage and loads optional content from `content/*.json`.
3. A tutorial-first shell appears on `Split` for first-time users and keeps the main route clear without hiding the rest of the Bridge.
4. The `Split` screen shows two text boxes where you type two real actions.
5. The app validates that both actions are meaningful and different enough to count as separate futures.
6. When you press `Split Universe`, the app runs the relay sequence and maps the returned random bit to branch `A` or `B`.
7. The `Current Universe` panel shows the relay assignment and the place where you confirm what you actually did.
8. Your confirmation becomes the authoritative observation in history.
9. The prediction card interprets confirmed history separately from the relay result, combining long-view synthesis with recent drift when enough confirmations exist.
10. The app updates the archive, diagnostics, achievements, and guidance state.

In short:

- relay assignment answers `what did the random source choose?`
- confirmation answers `what did I actually do?`
- the prediction layers answer `what do I most recently know, what does the model think now, and what does my broader pattern suggest?`

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

Important estimator note:

- the current-universe estimate is derived at render time from confirmed history
- it does not need its own storage schema

Important tutorial note:

- tutorial dismissal is stored locally so the app can stay calm after the first tour
- tutorial control state in the current tab lives in `sessionStorage`
- tutorial state is intentionally not added to export/import payloads

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

Imported archives still restore into a sensible tutorial state: empty profiles reopen the tutorial route, while already-progressed profiles stay out of newcomer mode.

## Accessibility And UX Notes

- sound, flash, shake, and hotspot hints are individually toggleable
- music has its own volume slider
- `prefers-reduced-motion` disables flash and shake by default
- hotspot hints default off on coarse-pointer devices to reduce mobile clutter
- hotspot interactions are buttons, so they remain keyboard accessible
- the app always opens on `Split`
- the start screen now uses a dedicated tutorial shell to guide the first successful split before pushing the optional adventure systems
- optional systems stay visible during tutorial mode, but they are visually softened instead of hidden
- the weighted synthesis card on `Profile` has extra spacing below it so the diagnostics section breathes a little more

## Low-Overwhelm Feature Options

These are good next features because they add clarity or delight without making the interface feel crowded:

- `Confidence meter`: a single short label such as `Low confidence`, `Moderate confidence`, or `High confidence` next to the current-universe estimate.
- `Why this guess?`: a small expandable note that explains the estimate in one or two sentences using the current sample size and branch balance.
- `Recent trend`: a tiny last-5-confirmations strip that shows whether your latest real choices are drifting toward `A` or `B`.
- `Estimator toggle`: a simple show/hide control for the advanced diagnostics math so casual users can keep the `Profile` screen lighter.
- `Milestone copy`: short moments like `First confirmed branch` or `Pattern emerging` that appear only when the history reaches meaningful thresholds.
- `Compare modes`: a lightweight line that says whether the frequentist and Bayesian estimates currently agree or disagree.

Recommended next pick if you want the biggest value for the least UI weight:

- `Confidence meter`

Current roadmap order:

1. tutorial-first guidance
2. flow clarity across Split, Result, Guide, and Profile
3. lightweight polish features such as micro-milestones

## Privacy

User-entered choices stay local to the browser. The app does not send decision text to the quantum endpoint; it only fetches a raw random value and maps that to branch `A` or `B` locally.

## Logic By Learning Level

### Kindergarten

You give the app two things you could do.
The app picks one.
Then you tell it what really happened.
After it remembers enough real choices, it makes a smart guess about which kind of universe you are in now.

### Primary School

The app is like a notebook and a chooser.

- it remembers your choices
- it asks you for two different actions
- it gets a random result
- it lets you correct the result so the notebook matches real life
- it uses the notebook of confirmed choices to make a probability guess

### Secondary School

The app is made from three main parts:

- `index.html` builds the page
- `styles.css` makes it look like a sci-fi terminal
- `script.js` runs the logic

The JavaScript keeps state in memory and in browser storage. Rendering functions read that state and update the screen. The statistical estimator filters history down to confirmed branches and then calculates probabilities from those confirmed counts.

### High School

The estimator uses probability.

- Each confirmed choice is treated as either `A` or `B`.
- The frequentist estimate looks at how often `A` has happened so far.
- The Bayesian estimate starts with a fair prior and updates it with each confirmed observation.
- The app then blends both estimates to produce one final verdict.

This means the app does not confuse:

- a random relay outcome
- your actual confirmed action
- the model's best current guess

### Undergraduate

From a software perspective, this is a static single-page app with imperative rendering and centralized state.

Key ideas:

- hydrate state from `localStorage` and `sessionStorage`
- validate decisions before running the split sequence
- separate assigned branch from observed branch
- recompute UI from state after every meaningful action
- keep the estimator derived-only so there is no extra persistence model to maintain

From a statistics perspective:

- confirmed observations form a Bernoulli sample
- the frequentist branch uses an empirical PMF plus a Wilson interval
- the Bayesian branch uses a `Beta(1,1)` prior and a Beta posterior
- the final estimate is a weighted synthesis, not a pure posterior

### PhD

The app maintains a clean epistemic separation between stochastic assignment and observed behavioral realization.

Formally:

- let the confirmed branch indicator be a Bernoulli random variable
- estimate the latent parameter `p = P(A)` from confirmed user behavior
- derive a frequentist point estimate and Wilson score interval
- derive a conjugate Beta posterior with closed-form mean and variance
- visualize posterior density over `[0,1]`
- synthesize frequentist and Bayesian views by inverse-uncertainty weighting

The UX architecture mirrors the inferential separation:

- the relay panel reports assignment
- confirmation records observed reality
- the estimator interprets confirmed history without rewriting or replacing the relay result

## License

- Project code: [`GPL-2.0-only`](./LICENSE)
- Bundled third-party audio remains under its original permissive licenses as documented in [`assets/sounds/CREDITS.md`](./assets/sounds/CREDITS.md)

## Files

- [`.gitignore`](./.gitignore): ignores the local-only `temp/` workspace.
- [`index.html`](./index.html): app shell and screen layout
- [`styles.css`](./styles.css): futuristic HUD styling, motion, walkthrough, and responsive layout
- [`script.js`](./script.js): runtime, split flow, walkthrough guidance, audio, storage, missions, and the statistical estimator

## Local Temp Workspace

A local-only `temp/` folder is available for scratch notes and experiments.

- it is ignored by git
- it is meant for local documentation and work-in-progress material
- this workspace includes a local `temp/README.md` that explains the code, the user story, how the app works, and the logic at multiple learning levels
- it can also hold local planning notes for future low-overwhelm feature ideas
