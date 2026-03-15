(function () {
  "use strict";

  const APP_VERSION = 2;
  const LOCAL_STORAGE_KEY = "universe-splitter-v2-local";
  const SESSION_STORAGE_KEY = "universe-splitter-v2-session";
  const API_BASE = "https://api.freeuniversesplitter.com";
  const QUERY_TIMEOUT_MS = 2400;
  const STATUS_TIMEOUT_MS = 1400;
  const LOCAL_SAVE_DELAY_MS = 140;
  const SESSION_SAVE_DELAY_MS = 80;
  const ESTIMATOR_PRIOR_ALPHA = 1;
  const ESTIMATOR_PRIOR_BETA = 1;
  const ESTIMATOR_CONFIDENCE_Z = 1.96;
  const ESTIMATOR_DENSITY_SAMPLES = 64;
  const ESTIMATOR_TIE_EPSILON = 0.001;
  const ESTIMATOR_RECENT_WINDOW = 5;
  const ESTIMATOR_BASELINE_WEIGHT = 0.65;
  const ESTIMATOR_RECENT_WEIGHT = 0.35;
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
  const params = new URLSearchParams(window.location.search);

  const STAGES = [
    { key: "valid", label: "Input valid", hold: 120 },
    { key: "internet", label: "Internet contacted", hold: 150 },
    { key: "geneva", label: "Geneva online", hold: 130 },
    { key: "ready", label: "Device ready", hold: 120 },
    { key: "photon", label: "Photon emitted", hold: 220 },
    { key: "event", label: "Quantum event", hold: 140 },
  ];

  const STAGE_INDEX = STAGES.reduce((map, stage, index) => {
    map[stage.key] = index;
    return map;
  }, {});

  const ARTIFACT_CATALOG = {
    "prism-shard": {
      id: "prism-shard",
      title: "Prism Shard",
      icon: "PS",
      description: "A luminous crystal splinter that makes success flashes feel cleaner and brighter.",
      unlockText: "Inspect the Relay Prism.",
    },
    "phase-coil": {
      id: "phase-coil",
      title: "Phase Coil",
      icon: "PC",
      description: "A hum-stable coil recovered from the phase dial housing.",
      unlockText: "Inspect the Phase Dial.",
    },
    "signal-atlas": {
      id: "signal-atlas",
      title: "Signal Atlas",
      icon: "SA",
      description: "A folded star-map overlay that deepens the sense of hidden routes through the Archive.",
      unlockText: "Inspect the Signal Map.",
    },
    "drawer-key": {
      id: "drawer-key",
      title: "Archive Key",
      icon: "AK",
      description: "A slim access key that marks you as someone trusted to open older records.",
      unlockText: "Inspect the Archive Drawer.",
    },
    "coherence-lens": {
      id: "coherence-lens",
      title: "Coherence Lens",
      icon: "CL",
      description: "A lens awarded by the Archivist for completing the first guided mission.",
      unlockText: "Complete First Contact.",
    },
    "cartographer-seal": {
      id: "cartographer-seal",
      title: "Cartographer Seal",
      icon: "CS",
      description: "A quiet emblem of mastery used by operators who map branches without losing wonder.",
      unlockText: "Complete Quiet Parallax.",
    },
  };

  const AUDIO_LIBRARY = {
    ui: {
      src: "assets/sounds/kenney/Audio/click_005.ogg",
      volume: 0.33,
    },
    activate: {
      src: "assets/sounds/kenney/Audio/select_004.ogg",
      volume: 0.34,
    },
    sweep: {
      src: "assets/sounds/kenney/Audio/glass_005.ogg",
      volume: 0.28,
    },
    success: {
      src: "assets/sounds/kenney/Audio/confirmation_002.ogg",
      volume: 0.38,
    },
    error: {
      src: "assets/sounds/kenney/Audio/back_002.ogg",
      volume: 0.24,
    },
    toggle: {
      src: "assets/sounds/kenney/Audio/toggle_004.ogg",
      volume: 0.3,
    },
  };

  const MUSIC_TRACK = {
    src: "assets/sounds/music/main_loop.mp3",
    silenceThreshold: 0.0035,
    analysisWindowMs: 60,
    trimPaddingMs: 40,
    minLoopSeconds: 18,
  };

  const WALKTHROUGH_STEPS = [
    {
      id: "option-a",
      title: "Write your first action",
      label: "Type one real action into the first text box.",
      screen: "bridge",
      target: "optionA",
      complete: () => Boolean(elements.optionA.value.trim()) || state.local.history.length > 0,
      guideCopy: "Start here. Put one concrete action you could do next into the first text box.",
    },
    {
      id: "option-b",
      title: "Write your second action",
      label: "Type a different action into the second text box.",
      screen: "bridge",
      target: "optionB",
      complete: () => Boolean(elements.optionB.value.trim()) || state.local.history.length > 0,
      guideCopy: "Now add a second action. Make it meaningfully different from the first one.",
    },
    {
      id: "split",
      title: "Trigger the split",
      label: "Press Split Universe to let the relay choose one branch.",
      screen: "bridge",
      target: "splitButton",
      complete: () => state.local.history.length > 0,
      guideCopy: "Both actions are in place. Press Split Universe to resolve the branch.",
    },
    {
      id: "result",
      title: "Read the answer",
      label: "Read Current Universe, then confirm which action you actually took.",
      screen: "bridge",
      target: "resultPanel",
      complete: () => Boolean(state.session.walkthroughResultSeen),
      guideCopy: "This panel shows the relay assignment. If you took the other action in real life, confirm it here so the archive matches reality.",
    },
    {
      id: "history",
      title: "Open History",
      label: "Visit History to see the branch tree and log.",
      screen: "bridge",
      target: "navArchiveButton",
      complete: () => state.local.history.length > 0 && state.local.profile.visitedScreens.includes("archive"),
      guideCopy: "Open History next. That is where the branch tree and branch log live.",
    },
    {
      id: "profile",
      title: "Open Profile",
      label: "Visit Profile for settings, mastery, and achievements.",
      screen: "bridge",
      target: "navDiagnosticsButton",
      complete: () => state.local.history.length > 0 && state.local.profile.visitedScreens.includes("diagnostics"),
      guideCopy: "Open Profile next. It contains settings, mastery, achievements, and sound controls.",
    },
    {
      id: "explore",
      title: "Begin the deeper layer",
      label: "Inspect a glowing hotspot or open the mission briefing.",
      screen: "bridge",
      target: "relay-prism",
      complete: () =>
        state.local.profile.metrics.hotspotInspections > 0 ||
        state.local.profile.completedMissions.length > 0 ||
        state.local.profile.discoveredHotspots.length > 0,
      guideCopy:
        "Now the adventure layer begins. Click a glowing hotspot like the Relay Prism, or open Mission Briefing for a guided quest.",
    },
  ];

  const FALLBACK_CONTENT = {
    hotspots: [
      {
        id: "relay-prism",
        label: "Relay Prism",
        shortLabel: "RP",
        x: 73,
        y: 24,
        title: "Relay Prism",
        description:
          "The prism bends relay light into spectral echoes. Branches that should be silent leave a faint cyan afterimage here.",
        meta: "Inspecting this lens often reveals the first secret the Bridge is willing to share.",
        loreId: "relay-prism-note",
        artifactId: "prism-shard",
        xp: 22,
      },
      {
        id: "phase-dial",
        label: "Phase Dial",
        shortLabel: "PD",
        x: 29,
        y: 28,
        title: "Phase Dial",
        description:
          "The dial does not choose outcomes. It only tunes how gracefully the operator crosses the threshold into uncertainty.",
        meta: "Useful for optional ritual preparation.",
        loreId: "phase-dial-note",
        artifactId: "phase-coil",
        xp: 22,
      },
      {
        id: "signal-map",
        label: "Signal Map",
        shortLabel: "SM",
        x: 56,
        y: 16,
        title: "Signal Map",
        description:
          "This starfield map tracks old branch routes. Several vectors end in sectors with no registered universe at all.",
        meta: "A favorite instrument for cartographers and completionists.",
        loreId: "signal-map-note",
        artifactId: "signal-atlas",
        xp: 24,
      },
      {
        id: "archive-drawer",
        label: "Archive Drawer",
        shortLabel: "AD",
        x: 22,
        y: 68,
        title: "Archive Drawer",
        description:
          "The drawer is almost empty, but the felt lining remembers the shape of things that are no longer here.",
        meta: "Archive surfaces tend to react after this drawer is inspected.",
        loreId: "archive-drawer-note",
        artifactId: "drawer-key",
        xp: 22,
      },
      {
        id: "waveform-scope",
        label: "Waveform Scope",
        shortLabel: "WS",
        x: 52,
        y: 70,
        title: "Waveform Scope",
        description:
          "The scope renders hesitation as a shimmer before the split. Some operators come here before entering any choice text at all.",
        meta: "Good for lore discovery and atmosphere.",
        loreId: "waveform-scope-note",
        artifactId: "",
        xp: 20,
      },
      {
        id: "lamp-bank",
        label: "Lamp Bank",
        shortLabel: "LB",
        x: 82,
        y: 58,
        title: "Lamp Bank",
        description:
          "The lamps pulse in advance of the main stage list, as if another machine deeper in the relay knows what is about to happen.",
        meta: "One of the easiest hotspots to inspect during the first mission.",
        loreId: "lamp-bank-note",
        artifactId: "",
        xp: 20,
      },
    ],
    missions: [
      {
        id: "first-contact",
        title: "First Contact",
        summary:
          "Learn the Bridge by inspecting an instrument, preparing an optional ritual, completing a split, and reviewing the Archive and Diagnostics surfaces.",
        rewardXp: 160,
        rewardArtifactId: "coherence-lens",
        steps: [
          { type: "inspectCount", target: 1, label: "Inspect any Bridge instrument." },
          { type: "ritualCount", target: 1, label: "Complete one optional ritual." },
          { type: "splitCount", target: 1, label: "Perform your first split." },
          { type: "screenVisit", screen: "archive", label: "Open the Archive." },
          { type: "screenVisit", screen: "diagnostics", label: "Review Diagnostics." },
        ],
      },
      {
        id: "branch-cartographer",
        title: "Branch Cartographer",
        summary:
          "Move beyond the tutorial layer by inspecting more of the Bridge, discovering lore, and building a small branch history worth studying.",
        rewardXp: 190,
        rewardArtifactId: "drawer-key",
        steps: [
          { type: "uniqueHotspotCount", target: 4, label: "Inspect four distinct instruments." },
          { type: "splitCount", target: 3, label: "Record three successful splits." },
          { type: "loreCount", target: 4, label: "Discover four lore fragments." },
        ],
      },
      {
        id: "quiet-parallax",
        title: "Quiet Parallax",
        summary:
          "Stabilize the relay through ritual, collect several artifacts, balance your branches, and archive the profile as portable JSON.",
        rewardXp: 220,
        rewardArtifactId: "cartographer-seal",
        steps: [
          { type: "ritualCount", target: 2, label: "Complete two optional rituals." },
          { type: "artifactCount", target: 3, label: "Unlock three artifacts." },
          { type: "branchBalance", label: "Resolve both A and B branches at least once." },
          { type: "exportCount", target: 1, label: "Export your profile as JSON." },
        ],
      },
    ],
    achievements: [
      {
        id: "first-gaze",
        title: "First Gaze",
        description: "Inspect your first Bridge instrument.",
        icon: "FG",
        type: "inspectCount",
        target: 1,
        rewardXp: 22,
      },
      {
        id: "first-branch",
        title: "First Branch",
        description: "Complete your first successful split.",
        icon: "FB",
        type: "splitCount",
        target: 1,
        rewardXp: 30,
      },
      {
        id: "ritual-hand",
        title: "Ritual Hand",
        description: "Complete an optional ritual before a split.",
        icon: "RH",
        type: "ritualCount",
        target: 1,
        rewardXp: 28,
      },
      {
        id: "balanced-signal",
        title: "Balanced Signal",
        description: "Receive both A and B outcomes across your history.",
        icon: "BS",
        type: "branchBalance",
        rewardXp: 34,
      },
      {
        id: "curiosity-loop",
        title: "Curiosity Loop",
        description: "Discover four lore fragments.",
        icon: "CL",
        type: "loreCount",
        target: 4,
        rewardXp: 42,
      },
      {
        id: "memory-keeper",
        title: "Memory Keeper",
        description: "Export your profile as portable JSON.",
        icon: "MK",
        type: "exportCount",
        target: 1,
        rewardXp: 24,
      },
    ],
    lore: [
      {
        id: "relay-prism-note",
        title: "Prism Note",
        body:
          "The relay prism produces a ghost image only when the operator truly means both options. Indecision without sincerity leaves the glass dark.",
        source: "Recovered from the Relay Prism",
      },
      {
        id: "phase-dial-note",
        title: "Phase Note",
        body:
          "The dial once had numbered positions. Every mark after three was polished away, as if higher settings had been deliberately forgotten.",
        source: "Recovered from the Phase Dial",
      },
      {
        id: "signal-map-note",
        title: "Signal Map Note",
        body:
          "The signal map lists routes through impossible coordinates. Several are tagged with operator initials that never appear in the public archive.",
        source: "Recovered from the Signal Map",
      },
      {
        id: "archive-drawer-note",
        title: "Drawer Note",
        body:
          "Inside the drawer lining is a pressure mark exactly the size of a missing seal. The Archivist appears to reward replacements over explanations.",
        source: "Recovered from the Archive Drawer",
      },
      {
        id: "waveform-scope-note",
        title: "Waveform Note",
        body:
          "The scope measures anticipation rather than outcome. The relay seems more interested in the moment before choice than in choice itself.",
        source: "Recovered from the Waveform Scope",
      },
      {
        id: "lamp-bank-note",
        title: "Lamp Bank Note",
        body:
          "The smallest lamp always glows first, but it is not wired into the visible stage list. Something hidden decides the order before the console does.",
        source: "Recovered from the Lamp Bank",
      },
      {
        id: "first-bifurcation-note",
        title: "First Bifurcation",
        body:
          "After the first split, the relay stops treating you like a visitor. The Bridge begins to record your presence as part of its own history.",
        source: "Unlocked by your first split",
      },
      {
        id: "balanced-signal-note",
        title: "Balanced Signal",
        body:
          "When both branches have been inhabited, the relay tone changes. It becomes less like an oracle and more like a witness.",
        source: "Unlocked by balancing branch outcomes",
      },
    ],
  };

  let audioEngine = null;
  let currentRun = null;
  let modalEscapeHandler = null;
  let localPersistTimer = null;
  let sessionPersistTimer = null;

  const state = {
    content: FALLBACK_CONTENT,
    local: createDefaultLocalState(),
    session: createDefaultSessionState(),
    splitInProgress: false,
  };

  const elements = {
    appShell: document.getElementById("appShell"),
    flashOverlay: document.getElementById("flashOverlay"),
    liveLamp: document.getElementById("liveLamp"),
    liveStatusText: document.getElementById("liveStatusText"),
    connectionReadout: document.getElementById("connectionReadout"),
    soundQuickToggle: document.getElementById("soundQuickToggle"),
    navHint: document.getElementById("sceneNavHint"),
    navBridgeButton: document.getElementById("navBridgeButton"),
    navArchiveButton: document.getElementById("navArchiveButton"),
    navDiagnosticsButton: document.getElementById("navDiagnosticsButton"),
    navManualButton: document.getElementById("navManualButton"),
    profileLevel: document.getElementById("profileLevel"),
    profileTitle: document.getElementById("profileTitle"),
    navButtons: Array.from(document.querySelectorAll("[data-screen-target]")),
    panels: Array.from(document.querySelectorAll("[data-screen-panel]")),
    bridgeMissionBanner: document.querySelector(".bridge-mission-banner"),
    missionEyebrow: document.getElementById("missionEyebrow"),
    hotspotLayer: document.getElementById("hotspotLayer"),
    hotspotTitle: document.getElementById("hotspotTitle"),
    hotspotBody: document.getElementById("hotspotBody"),
    hotspotMeta: document.getElementById("hotspotMeta"),
    missionTitle: document.getElementById("missionTitle"),
    missionSummary: document.getElementById("missionSummary"),
    missionSteps: document.getElementById("missionSteps"),
    manualMissionSteps: document.getElementById("manualMissionSteps"),
    briefingButton: document.getElementById("briefingButton"),
    continueMissionButton: document.getElementById("continueMissionButton"),
    openManualButton: document.getElementById("openManualButton"),
    goArchiveButton: document.getElementById("goArchiveButton"),
    ritualBanner: document.getElementById("ritualBanner"),
    ritualTrail: document.getElementById("ritualTrail"),
    walkthroughCard: document.getElementById("walkthroughCard"),
    walkthroughEyebrow: document.getElementById("walkthroughEyebrow"),
    walkthroughTitle: document.getElementById("walkthroughTitle"),
    walkthroughStatus: document.getElementById("walkthroughStatus"),
    walkthroughLead: document.getElementById("walkthroughLead"),
    tutorialProgress: document.getElementById("tutorialProgress"),
    walkthroughFootnote: document.getElementById("walkthroughFootnote"),
    tutorialPrimaryButton: document.getElementById("tutorialPrimaryButton"),
    tutorialSecondaryButton: document.getElementById("tutorialSecondaryButton"),
    splitHelper: document.getElementById("splitHelper"),
    choicePrediction: document.getElementById("choicePrediction"),
    choicePredictionBadge: document.getElementById("choicePredictionBadge"),
    choicePredictionConfirmed: document.getElementById("choicePredictionConfirmed"),
    choicePredictionConfirmedMeta: document.getElementById("choicePredictionConfirmedMeta"),
    choicePredictionGuess: document.getElementById("choicePredictionGuess"),
    choicePredictionGuessMeta: document.getElementById("choicePredictionGuessMeta"),
    choicePredictionPattern: document.getElementById("choicePredictionPattern"),
    choicePredictionPatternMeta: document.getElementById("choicePredictionPatternMeta"),
    choicePredictionMeta: document.getElementById("choicePredictionMeta"),
    form: document.getElementById("splitterForm"),
    optionA: document.getElementById("optionA"),
    optionB: document.getElementById("optionB"),
    splitButton: document.getElementById("splitButton"),
    nevermindButton: document.getElementById("nevermindButton"),
    validationMessage: document.getElementById("validationMessage"),
    stageItems: Array.from(document.querySelectorAll(".stage-list__item")),
    diagnosticsConsole: document.getElementById("diagnosticsConsole"),
    resultPrimary: document.getElementById("resultPrimary"),
    resultSecondary: document.getElementById("resultSecondary"),
    resultPanel: document.getElementById("resultPanel"),
    resultConfirm: document.getElementById("resultConfirm"),
    resultConfirmLead: document.getElementById("resultConfirmLead"),
    resultConfirmStatus: document.getElementById("resultConfirmStatus"),
    confirmSelectedButton: document.getElementById("confirmSelectedButton"),
    confirmOtherButton: document.getElementById("confirmOtherButton"),
    shareButton: document.getElementById("shareButton"),
    exportButton: document.getElementById("exportButton"),
    importButton: document.getElementById("importButton"),
    importInput: document.getElementById("importInput"),
    resetButton: document.getElementById("resetButton"),
    soundToggle: document.getElementById("soundToggle"),
    musicVolume: document.getElementById("musicVolume"),
    musicVolumeValue: document.getElementById("musicVolumeValue"),
    flashToggle: document.getElementById("flashToggle"),
    shakeToggle: document.getElementById("shakeToggle"),
    hintToggle: document.getElementById("hintToggle"),
    timelineFrame: document.getElementById("timelineFrame"),
    timelineSvg: document.getElementById("timelineSvg"),
    branchLog: document.getElementById("branchLog"),
    branchLogTemplate: document.getElementById("branchLogTemplate"),
    loreGrid: document.getElementById("loreGrid"),
    splitsCount: document.getElementById("splitsCount"),
    universesCount: document.getElementById("universesCount"),
    ritualCount: document.getElementById("ritualCount"),
    loreCount: document.getElementById("loreCount"),
    biasBarA: document.getElementById("biasBarA"),
    biasBarB: document.getElementById("biasBarB"),
    estimatorGrid: document.getElementById("estimatorGrid"),
    statsNotes: document.getElementById("statsNotes"),
    masteryRing: document.getElementById("masteryRing"),
    masteryRingValue: document.getElementById("masteryRingValue"),
    masteryTitle: document.getElementById("masteryTitle"),
    masterySummary: document.getElementById("masterySummary"),
    masteryProgressBar: document.getElementById("masteryProgressBar"),
    masteryProgressText: document.getElementById("masteryProgressText"),
    achievementGrid: document.getElementById("achievementGrid"),
    artifactGrid: document.getElementById("artifactGrid"),
    manualLoreNotes: document.getElementById("manualLoreNotes"),
    manualRestartTutorialButton: document.getElementById("manualRestartTutorialButton"),
    settingsRestartTutorialButton: document.getElementById("settingsRestartTutorialButton"),
    guideCallout: document.getElementById("guideCallout"),
    guideCalloutEyebrow: document.getElementById("guideCalloutEyebrow"),
    guideCalloutTitle: document.getElementById("guideCalloutTitle"),
    guideCalloutBody: document.getElementById("guideCalloutBody"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modalEyebrow: document.getElementById("modalEyebrow"),
    modalTitle: document.getElementById("modalTitle"),
    modalMessage: document.getElementById("modalMessage"),
    modalActions: document.getElementById("modalActions"),
  };

  const LocalStore = {
    load() {
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    },
    save() {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.local));
    },
    clear() {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    },
  };

  const SessionStore = {
    load() {
      try {
        const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    },
    save() {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state.session));
    },
    clear() {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    },
  };

  class AudioEngine {
    constructor() {
      this.context = null;
      this.players = new Map();
      this.music = {
        failed: false,
        playing: false,
        buffer: null,
        bufferPromise: null,
        sourceNode: null,
        loopStart: 0,
        loopEnd: 0,
      };
      this.musicGain = null;
      this.sfxGain = null;
      this.ambient = {
        started: false,
        timer: null,
        master: null,
        bus: null,
      };
    }

    getContext() {
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          return null;
        }
        this.context = new AudioContextClass();
      }

      if (this.context.state === "suspended") {
        this.context.resume().catch(() => {});
      }

      return this.context;
    }

    ensureBuses() {
      const context = this.getContext();
      if (!context) {
        return null;
      }

      if (!this.musicGain) {
        this.musicGain = context.createGain();
        this.musicGain.gain.value = 0.0001;
        this.musicGain.connect(context.destination);
      }

      if (!this.sfxGain) {
        this.sfxGain = context.createGain();
        this.sfxGain.gain.value = 0.0001;
        this.sfxGain.connect(context.destination);
      }

      return context;
    }

    prime() {
      const context = this.ensureBuses();
      if (!context) {
        return;
      }

      context.resume().catch(() => {});
      Object.entries(AUDIO_LIBRARY).forEach(([key, config]) => {
        if (this.players.has(key)) {
          return;
        }

        const audio = new Audio(config.src);
        audio.preload = "auto";
        try {
          audio.load();
        } catch (error) {}
        this.players.set(key, audio);
      });

      this.preloadMusicBuffer().catch(() => {});
      this.syncAudioState();
    }

    preloadMusicBuffer() {
      const context = this.ensureBuses();
      if (!context) {
        return Promise.resolve(null);
      }

      if (this.music.buffer) {
        return Promise.resolve(this.music.buffer);
      }

      if (this.music.bufferPromise) {
        return this.music.bufferPromise;
      }

      this.music.bufferPromise = fetch(MUSIC_TRACK.src, { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Unable to load music track (${response.status}).`);
          }
          return response.arrayBuffer();
        })
        .then((arrayBuffer) => this.decodeMusicBuffer(context, arrayBuffer))
        .then((buffer) => {
          const loopWindow = this.detectLoopWindow(buffer);
          this.music.buffer = buffer;
          this.music.loopStart = loopWindow.start;
          this.music.loopEnd = loopWindow.end;
          this.music.failed = false;
          return buffer;
        })
        .catch((error) => {
          this.music.failed = true;
          throw error;
        })
        .finally(() => {
          this.music.bufferPromise = null;
        });

      return this.music.bufferPromise;
    }

    decodeMusicBuffer(context, arrayBuffer) {
      return new Promise((resolve, reject) => {
        const audioData = arrayBuffer.slice(0);
        let settled = false;
        const once = (callback) => (value) => {
          if (settled) {
            return;
          }
          settled = true;
          callback(value);
        };

        try {
          const maybePromise = context.decodeAudioData(
            audioData,
            once(resolve),
            once((error) => reject(error || new Error("Unable to decode the music track.")))
          );
          if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise.then(once(resolve)).catch(once(reject));
          }
        } catch (error) {
          reject(error);
        }
      });
    }

    detectLoopWindow(buffer) {
      const sampleRate = buffer.sampleRate;
      const analysisWindow = Math.max(
        1024,
        Math.floor((MUSIC_TRACK.analysisWindowMs / 1000) * sampleRate)
      );
      const trimPadding = (MUSIC_TRACK.trimPaddingMs || 0) / 1000;
      const minimumLoop = MUSIC_TRACK.minLoopSeconds || 18;
      let startSample = 0;
      let endSample = buffer.length;

      while (
        startSample + analysisWindow < endSample &&
        this.isSilentWindow(buffer, startSample, startSample + analysisWindow)
      ) {
        startSample += analysisWindow;
      }

      while (
        endSample - analysisWindow > startSample + analysisWindow &&
        this.isSilentWindow(buffer, endSample - analysisWindow, endSample)
      ) {
        endSample -= analysisWindow;
      }

      let start = startSample / sampleRate;
      let end = endSample / sampleRate;

      if (start > trimPadding) {
        start = Math.max(0, start - trimPadding * 0.5);
      } else {
        start = 0;
      }

      if (buffer.duration - end > trimPadding) {
        end = Math.max(start + 1, end - trimPadding);
      } else {
        end = buffer.duration;
      }

      if (end - start < minimumLoop) {
        return { start: 0, end: buffer.duration };
      }

      return { start, end };
    }

    isSilentWindow(buffer, startSample, endSample) {
      const step = 24;
      const threshold = MUSIC_TRACK.silenceThreshold || 0.0035;

      for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
        const channel = buffer.getChannelData(channelIndex);
        for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex += step) {
          if (Math.abs(channel[sampleIndex]) > threshold) {
            return false;
          }
        }
      }

      return true;
    }

    createMusicSource(buffer) {
      const context = this.ensureBuses();
      if (!context || !this.musicGain) {
        return null;
      }

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = this.music.loopStart || 0;
      source.loopEnd = this.music.loopEnd || buffer.duration;
      source.connect(this.musicGain);
      return source;
    }

    getMusicMixLevel(percent = state.local.settings.musicVolume) {
      return sanitizePercent(percent, 100) / 100;
    }

    getMusicGainValue(percent = state.local.settings.musicVolume) {
      const normalized = this.getMusicMixLevel(percent);
      return Math.max(0.0001, 0.06 + normalized * 0.98);
    }

    updateSfxBus() {
      if (this.sfxGain && this.context) {
        const now = this.context.currentTime;
        this.sfxGain.gain.cancelScheduledValues(now);
        this.sfxGain.gain.linearRampToValueAtTime(
          state.local.settings.muted ? 0.0001 : 0.95,
          now + 0.08
        );
      }
    }

    getAmbientTargetGain(percent = state.local.settings.musicVolume) {
      const normalized = this.getMusicMixLevel(percent);
      return Math.max(0.0001, 0.055 + normalized * 0.1);
    }

    pulse(config) {
      if (state.local.settings.muted) {
        return;
      }

      const context = this.getContext();
      if (!context) {
        return;
      }

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = config.type || "sine";
      oscillator.frequency.value = config.frequency;
      oscillator.detune.value = config.detune || 0;
      gainNode.gain.value = 0.0001;
      oscillator.connect(gainNode);
      gainNode.connect(this.sfxGain || context.destination);
      const now = context.currentTime;
      gainNode.gain.exponentialRampToValueAtTime(config.gain || 0.04, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);
      oscillator.start(now);
      oscillator.stop(now + config.duration + 0.04);
    }

    playSfx(key) {
      if (state.local.settings.muted) {
        return;
      }

      const config = AUDIO_LIBRARY[key];
      if (!config) {
        return;
      }

      this.prime();
      const context = this.ensureBuses();
      if (!context) {
        this.syntheticFallback(key);
        return;
      }

      const base = this.players.get(key);
      const audio = base ? base.cloneNode() : new Audio(config.src);
      try {
        audio.preload = "auto";
        audio.volume = 1;
        audio.currentTime = 0;
        const source = context.createMediaElementSource(audio);
        const gainNode = context.createGain();
        gainNode.gain.value = config.volume;
        source.connect(gainNode);
        gainNode.connect(this.sfxGain || context.destination);

        const cleanup = () => {
          try {
            source.disconnect();
            gainNode.disconnect();
          } catch (error) {}
        };

        audio.addEventListener("ended", cleanup, { once: true });
        audio.addEventListener(
          "error",
          () => {
            cleanup();
            this.syntheticFallback(key);
          },
          { once: true }
        );

        const playAttempt = audio.play();
        if (playAttempt && typeof playAttempt.catch === "function") {
          playAttempt.catch(() => {
            cleanup();
            this.syntheticFallback(key);
          });
        }
      } catch (error) {
        this.syntheticFallback(key);
      }
    }

    play(key) {
      this.playSfx(key);
    }

    syntheticFallback(key) {
      if (key === "success") {
        this.pulse({ frequency: 620, duration: 0.16, type: "triangle", gain: 0.024 });
        this.pulse({ frequency: 820, duration: 0.22, type: "sine", gain: 0.018 });
        return;
      }

      if (key === "error") {
        this.pulse({ frequency: 240, duration: 0.18, type: "triangle", gain: 0.016 });
        this.pulse({ frequency: 180, duration: 0.24, type: "sine", gain: 0.012 });
        return;
      }

      this.pulse({ frequency: 520, duration: 0.1, type: "triangle", gain: 0.018 });
      this.pulse({ frequency: 690, duration: 0.07, type: "sine", gain: 0.014 });
    }

    syncAudioState() {
      this.updateSfxBus();

      if (state.local.settings.muted) {
        this.stopMusic();
        this.stopAmbientFallback();
        return;
      }

      this.startMusic();
    }

    syncAmbient() {
      this.syncAudioState();
    }

    startMusic() {
      this.setMusicVolume(state.local.settings.musicVolume);

      if (this.music.sourceNode) {
        this.music.playing = true;
        this.stopAmbientFallback();
        return;
      }

      this.preloadMusicBuffer()
        .then((buffer) => {
          if (!buffer || state.local.settings.muted || this.music.sourceNode) {
            return;
          }

          const source = this.createMusicSource(buffer);
          if (!source) {
            throw new Error("Unable to create a music source.");
          }

          source.onended = () => {
            if (this.music.sourceNode !== source) {
              return;
            }

            try {
              source.disconnect();
            } catch (error) {}
            this.music.sourceNode = null;
            this.music.playing = false;
          };

          source.start(0, this.music.loopStart || 0);
          this.music.sourceNode = source;
          this.music.playing = true;
          this.music.failed = false;
          this.stopAmbientFallback();
        })
        .catch(() => {
          this.music.failed = true;
          this.music.playing = false;
          if (!state.local.settings.muted) {
            this.startAmbientFallback();
          }
        });
    }

    stopMusic() {
      if (!this.music.sourceNode) {
        this.music.playing = false;
        return;
      }

      const source = this.music.sourceNode;
      this.music.sourceNode = null;
      source.onended = null;
      try {
        source.stop();
      } catch (error) {}
      try {
        source.disconnect();
      } catch (error) {}
      this.music.playing = false;
    }

    setMusicVolume(percent) {
      const safePercent = sanitizePercent(percent, 100);
      if (this.musicGain && this.context) {
        const now = this.context.currentTime;
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.linearRampToValueAtTime(
          state.local.settings.muted ? 0.0001 : this.getMusicGainValue(safePercent),
          now + 0.12
        );
      }

      if (this.ambient.master) {
        this.updateAmbientMix(safePercent);
      }
    }

    updateAmbientMix(percent = state.local.settings.musicVolume) {
      if (this.ambient.master && this.context) {
        const now = this.context.currentTime;
        this.ambient.master.gain.cancelScheduledValues(now);
        this.ambient.master.gain.linearRampToValueAtTime(this.getAmbientTargetGain(percent), now + 0.18);
      }
    }

    startAmbientFallback() {
      if (state.local.settings.muted) {
        return;
      }

      if (this.ambient.started) {
        this.updateAmbientMix(state.local.settings.musicVolume);
        return;
      }

      const context = this.ensureBuses();
      if (!context) {
        return;
      }

      this.ambient.started = true;
      this.ambient.master = context.createGain();
      this.ambient.master.gain.value = 0.0001;
      this.ambient.bus = context.createBiquadFilter();
      this.ambient.bus.type = "lowpass";
      this.ambient.bus.frequency.value = 1650;
      this.ambient.bus.Q.value = 0.4;
      this.ambient.bus.connect(this.ambient.master);
      this.ambient.master.connect(context.destination);

      const now = context.currentTime;
      this.ambient.master.gain.cancelScheduledValues(now);
      this.ambient.master.gain.exponentialRampToValueAtTime(this.getAmbientTargetGain(), now + 1.1);
      this.scheduleAmbientCycle();
    }

    stopAmbientFallback() {
      if (!this.ambient.started) {
        return;
      }

      const context = this.getContext();
      if (this.ambient.timer) {
        window.clearTimeout(this.ambient.timer);
        this.ambient.timer = null;
      }

      if (this.ambient.master && context) {
        const now = context.currentTime;
        this.ambient.master.gain.cancelScheduledValues(now);
        this.ambient.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        window.setTimeout(() => {
          try {
            this.ambient.bus?.disconnect();
            this.ambient.master?.disconnect();
          } catch (error) {}
          this.ambient.bus = null;
          this.ambient.master = null;
        }, 520);
      }

      this.ambient.started = false;
    }

    scheduleAmbientCycle() {
      if (!this.ambient.started || state.local.settings.muted) {
        return;
      }

      const context = this.getContext();
      if (!context || !this.ambient.bus) {
        return;
      }

      const progressions = [
        [164.81, 207.65, 246.94],
        [146.83, 196, 246.94],
        [130.81, 174.61, 220],
        [174.61, 220, 261.63],
      ];
      const chord = progressions[Math.floor(Math.random() * progressions.length)];
      const start = context.currentTime + 0.08;

      chord.forEach((frequency, index) => {
        this.playPad(frequency, start + index * 0.03, 8.4, 0.02);
      });

      this.playDrone(chord[0] / 2, start, 9.1, 0.015);
      this.playPulse(chord[2] * 2, start + 1.2, 0.52, 0.0065);
      this.playPulse(chord[1] * 1.5, start + 4.2, 0.72, 0.0055);
      this.playPulse(chord[0] * 2, start + 6.4, 0.46, 0.005);

      this.ambient.timer = window.setTimeout(() => {
        this.scheduleAmbientCycle();
      }, 4200);
    }

    playPad(frequency, startTime, duration, gainAmount) {
      const context = this.getContext();
      if (!context || !this.ambient.bus) {
        return;
      }

      const oscA = context.createOscillator();
      const oscB = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gainNode = context.createGain();

      oscA.type = "sine";
      oscB.type = "sine";
      oscA.frequency.value = frequency;
      oscB.frequency.value = frequency * 2;
      oscB.detune.value = -4;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(720, startTime);
      filter.frequency.linearRampToValueAtTime(500, startTime + duration);
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.linearRampToValueAtTime(gainAmount, startTime + 1.8);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.ambient.bus);

      oscA.start(startTime);
      oscB.start(startTime);
      oscA.stop(startTime + duration + 0.1);
      oscB.stop(startTime + duration + 0.1);
    }

    playDrone(frequency, startTime, duration, gainAmount) {
      const context = this.getContext();
      if (!context || !this.ambient.bus) {
        return;
      }

      const osc = context.createOscillator();
      const gainNode = context.createGain();
      osc.type = "triangle";
      osc.frequency.value = frequency;
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.linearRampToValueAtTime(gainAmount, startTime + 2.1);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gainNode);
      gainNode.connect(this.ambient.bus);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);
    }

    playPulse(frequency, startTime, duration, gainAmount) {
      const context = this.getContext();
      if (!context || !this.ambient.bus) {
        return;
      }

      const osc = context.createOscillator();
      const gainNode = context.createGain();
      osc.type = "triangle";
      osc.frequency.value = frequency;
      osc.detune.value = 3;
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.linearRampToValueAtTime(gainAmount, startTime + 0.12);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gainNode);
      gainNode.connect(this.ambient.bus);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.08);
    }

    uiTap() {
      this.play("ui");
    }

    activationBeep() {
      this.play("activate");
    }

    ritualSweep() {
      this.play("sweep");
    }

    releaseBurst() {
      this.play("success");
    }

    failTone() {
      this.play("error");
    }

    toggleCue() {
      this.play("toggle");
    }
  }

  const QuantumSource = {
    devStub: params.get("source") === "stub",

    async getStatus() {
      if (this.devStub) {
        return {
          summary: "Development stub engaged. Geneva simulator online.",
          sourceDevice: "geneva",
          transport: "live",
        };
      }

      const response = await fetchWithTimeout(`${API_BASE}/status`, STATUS_TIMEOUT_MS);
      const text = await response.text();
      return {
        summary: normalizeApiText(text) || "Geneva relay acknowledged.",
        sourceDevice: "geneva",
        transport: "live",
      };
    },

    async getBit() {
      if (this.devStub) {
        return {
          bit: Math.random() > 0.5 ? 1 : 0,
          sourceDevice: "geneva",
          transport: "live",
          rawNumber: 1,
        };
      }

      const response = await fetchWithTimeout(`${API_BASE}/rndnum`, QUERY_TIMEOUT_MS);
      const text = await response.text();
      const number = parseQuantumInteger(text);
      if (number === null) {
        const error = new Error("No usable random number returned.");
        error.code = "NO_RANDOM_VALUE";
        throw error;
      }

      return {
        bit: Math.abs(number % 2),
        sourceDevice: "geneva",
        transport: "live",
        rawNumber: number,
      };
    },
  };

  const SplitEngine = {
    async run(optionA, optionB) {
      const validation = validateOptions(optionA, optionB);
      if (!validation.ok) {
        return { ok: false, stage: validation.stage, message: validation.message };
      }

      currentRun = { cancelled: false };
      state.splitInProgress = true;
      state.session.splitRun = {
        active: true,
        currentStage: "valid",
        startedAt: new Date().toISOString(),
      };
      persistSession();
      updateControls();
      setValidationMessage("Input validated. Prepare for bifurcation.", "warning");
      clearStageClasses();
      clearDiagnostics();
      appendDiagnostic("Input chamber sealed.");
      updateLiveStatus("Sequence armed", true);

      try {
        activateStage("valid");
        updateSplitRunStage("valid");
        appendDiagnostic("Input valid.");
        getAudioEngine().activationBeep();
        await waitForStage("valid");
        if (currentRun.cancelled) {
          return buildCancellationFailure();
        }

        if (!navigator.onLine) {
          return {
            ok: false,
            stage: "internet",
            message: "The terminal cannot contact the network. Restore internet access and try again.",
          };
        }

        activateStage("internet");
        updateSplitRunStage("internet");
        appendDiagnostic("Internet contacted.");
        updateLiveStatus("Contacting Geneva relay", true);
        await waitForStage("internet");
        if (currentRun.cancelled) {
          return buildCancellationFailure();
        }

        const statusPromise = QuantumSource.getStatus()
          .then((meta) => {
            state.local.diagnostics.lastApiStatus = meta.summary;
            appendDiagnostic(meta.summary);
            return meta;
          })
          .catch(() => {
            appendDiagnostic("Status relay uncertain. Attempting direct device line.");
            return null;
          });

        activateStage("geneva");
        updateSplitRunStage("geneva");
        appendDiagnostic("Geneva online.");
        updateLiveStatus("Geneva device online", true);
        await waitForStage("geneva");
        if (currentRun.cancelled) {
          return buildCancellationFailure();
        }

        activateStage("ready");
        updateSplitRunStage("ready");
        appendDiagnostic("Device ready.");
        updateLiveStatus("Device ready", true);
        await waitForStage("ready");
        if (currentRun.cancelled) {
          return buildCancellationFailure();
        }

        const quantumPromise = QuantumSource.getBit();

        activateStage("photon");
        updateSplitRunStage("photon");
        appendDiagnostic("Photon emitted.");
        getAudioEngine().ritualSweep();
        updateLiveStatus("Photon emission underway", true);
        await waitForStage("photon");
        if (currentRun.cancelled) {
          return buildCancellationFailure();
        }

        const statusMeta = await statusPromise;
        let quantumResult;
        try {
          quantumResult = await quantumPromise;
        } catch (error) {
          const networkFailure = isLikelyNetworkError(error);
          return {
            ok: false,
            stage: statusMeta ? "photon" : "geneva",
            message: networkFailure
              ? "Contact with Geneva failed before the photon could be registered."
              : "Geneva responded, but no usable quantum event was returned.",
          };
        }

        activateStage("event");
        updateSplitRunStage("event");
        appendDiagnostic("Quantum event.");
        updateLiveStatus("Branch resolved", true);
        triggerEffects();
        getAudioEngine().releaseBurst();
        await waitForStage("event");
        completeAllStages();

        const selectedKey = quantumResult.bit === 0 ? "A" : "B";
        const selectedText = selectedKey === "A" ? optionA.trim() : optionB.trim();
        const rejectedText = selectedKey === "A" ? optionB.trim() : optionA.trim();

        return {
          ok: true,
          record: {
            id: buildRecordId(),
            createdAt: new Date().toISOString(),
            optionA: optionA.trim(),
            optionB: optionB.trim(),
            selectedKey,
            selectedText,
            rejectedText,
            sourceDevice: quantumResult.sourceDevice,
            transport: quantumResult.transport,
            progressLog: STAGES.map((stage) => stage.label),
            ritualPrepared: state.session.ritualReady,
            inspectedHotspots: state.session.inspectedThisSession.slice(),
          },
        };
      } finally {
        state.splitInProgress = false;
        state.session.splitRun = null;
        currentRun = null;
        persistSession();
        updateControls();
      }
    },
  };

  init().catch((error) => {
    console.error(error);
    setValidationMessage("The Bridge encountered an initialization fault.", "danger");
  });

  async function init() {
    state.content = await loadContent();
    hydrateState();
    state.local.diagnostics.contentSource = Object.keys(FALLBACK_CONTENT).some(
      (key) => state.content[key] === FALLBACK_CONTENT[key]
    )
      ? "fallback"
      : "json";
    rememberScreenVisit(state.local.activeScreen);
    evaluateProgress({ silent: true });
    bindEvents();
    render();
    if (!state.local.draft.optionA.trim() && !state.local.draft.optionB.trim() && !state.local.history.length) {
      setValidationMessage("Start with the first text box. Sound is optional; the split is the main path.");
    }
    maybeAutoguideWalkthrough();
  }

  async function loadContent() {
    const files = [
      { key: "hotspots", path: "content/hotspots.json" },
      { key: "missions", path: "content/missions.json" },
      { key: "achievements", path: "content/achievements.json" },
      { key: "lore", path: "content/lore.json" },
    ];
    const results = await Promise.allSettled(files.map((file) => fetchJson(file.path)));
    const content = {};
    let usedFallback = false;

    results.forEach((result, index) => {
      const key = files[index].key;
      if (result.status === "fulfilled" && Array.isArray(result.value)) {
        content[key] = result.value;
      } else {
        content[key] = FALLBACK_CONTENT[key];
        usedFallback = true;
      }
    });

    state.local.diagnostics.contentSource = usedFallback ? "fallback" : "json";
    return content;
  }

  function createDefaultLocalState() {
    return {
      version: APP_VERSION,
      activeScreen: "bridge",
      draft: {
        optionA: "",
        optionB: "",
      },
      settings: {
        muted: true,
        musicVolume: 100,
        flashEnabled: !reducedMotionQuery.matches && !coarsePointerQuery.matches,
        shakeEnabled: !reducedMotionQuery.matches && !coarsePointerQuery.matches,
        hotspotHints: !coarsePointerQuery.matches,
        reducedMotionAware: reducedMotionQuery.matches,
      },
      history: [],
      diagnostics: {
        lastApiStatus: null,
        lastSuccessfulSource: null,
        lastMessage: "Awaiting mutually exclusive instructions.",
        contentSource: "fallback",
      },
      tutorial: {
        dismissed: false,
      },
      profile: {
        xp: 0,
        visitedScreens: ["bridge"],
        discoveredHotspots: [],
        discoveredLore: [],
        artifacts: [],
        completedMissions: [],
        achievements: {},
        metrics: {
          hotspotInspections: 0,
          ritualsCompleted: 0,
          splitsCompleted: 0,
          branchA: 0,
          branchB: 0,
          exports: 0,
          imports: 0,
          shares: 0,
        },
      },
    };
  }

  function createDefaultSessionState() {
    return {
      activeHotspotId: null,
      inspectedThisSession: [],
      ritualReady: false,
      splitRun: null,
      onboardingDismissed: false,
      tutorialActive: true,
      tutorialStepId: "option-a",
      walkthroughActive: true,
      walkthroughStepId: "option-a",
      highlightTarget: null,
      guideSource: "",
      guideTitle: "",
      guideMessage: "",
      guideAutoShown: false,
      walkthroughResultSeen: false,
    };
  }

  function hydrateState() {
    const savedLocal = LocalStore.load();
    const savedSession = SessionStore.load();

    if (savedLocal && typeof savedLocal === "object") {
      state.local.activeScreen = "bridge";
      state.local.draft.optionA = typeof savedLocal.draft?.optionA === "string" ? savedLocal.draft.optionA : "";
      state.local.draft.optionB = typeof savedLocal.draft?.optionB === "string" ? savedLocal.draft.optionB : "";
      state.local.settings = {
        muted:
          typeof savedLocal.settings?.muted === "boolean" ? savedLocal.settings.muted : createDefaultLocalState().settings.muted,
        musicVolume: sanitizePercent(savedLocal.settings?.musicVolume, 100),
        flashEnabled:
          typeof savedLocal.settings?.flashEnabled === "boolean"
            ? savedLocal.settings.flashEnabled
            : !reducedMotionQuery.matches && !coarsePointerQuery.matches,
        shakeEnabled:
          typeof savedLocal.settings?.shakeEnabled === "boolean"
            ? savedLocal.settings.shakeEnabled
            : !reducedMotionQuery.matches && !coarsePointerQuery.matches,
        hotspotHints:
          typeof savedLocal.settings?.hotspotHints === "boolean" ? savedLocal.settings.hotspotHints : true,
        reducedMotionAware: reducedMotionQuery.matches,
      };
      state.local.history = Array.isArray(savedLocal.history) ? savedLocal.history : [];
      state.local.diagnostics = {
        lastApiStatus: savedLocal.diagnostics?.lastApiStatus || null,
        lastSuccessfulSource: savedLocal.diagnostics?.lastSuccessfulSource || null,
        lastMessage: savedLocal.diagnostics?.lastMessage || state.local.diagnostics.lastMessage,
        contentSource: savedLocal.diagnostics?.contentSource || state.local.diagnostics.contentSource,
      };
      state.local.tutorial = {
        dismissed: typeof savedLocal.tutorial?.dismissed === "boolean" ? savedLocal.tutorial.dismissed : false,
      };
      state.local.profile = sanitizeProfile(savedLocal.profile);
    }

    if (savedSession && typeof savedSession === "object") {
      state.session.activeHotspotId =
        typeof savedSession.activeHotspotId === "string" ? savedSession.activeHotspotId : null;
      state.session.inspectedThisSession = sanitizeArray(savedSession.inspectedThisSession);
      state.session.ritualReady = Boolean(savedSession.ritualReady);
      state.session.splitRun = savedSession.splitRun || null;
      state.session.onboardingDismissed = Boolean(savedSession.onboardingDismissed);
      state.session.tutorialActive =
        typeof savedSession.tutorialActive === "boolean"
          ? savedSession.tutorialActive
          : typeof savedSession.walkthroughActive === "boolean"
            ? savedSession.walkthroughActive
            : true;
      state.session.tutorialStepId =
        typeof savedSession.tutorialStepId === "string"
          ? savedSession.tutorialStepId
          : typeof savedSession.walkthroughStepId === "string"
            ? savedSession.walkthroughStepId
            : "option-a";
      state.session.walkthroughActive =
        typeof savedSession.walkthroughActive === "boolean" ? savedSession.walkthroughActive : true;
      state.session.walkthroughStepId =
        typeof savedSession.walkthroughStepId === "string" ? savedSession.walkthroughStepId : "option-a";
      state.session.highlightTarget =
        typeof savedSession.highlightTarget === "string" ? savedSession.highlightTarget : null;
      state.session.guideSource = typeof savedSession.guideSource === "string" ? savedSession.guideSource : "";
      state.session.guideTitle = typeof savedSession.guideTitle === "string" ? savedSession.guideTitle : "";
      state.session.guideMessage = typeof savedSession.guideMessage === "string" ? savedSession.guideMessage : "";
      state.session.guideAutoShown = Boolean(savedSession.guideAutoShown);
      state.session.walkthroughResultSeen = Boolean(savedSession.walkthroughResultSeen);
    }

    if (!savedSession || typeof savedSession !== "object") {
      state.session.walkthroughResultSeen = state.local.history.length > 0;
    }

    if (state.session.splitRun?.active) {
      state.local.diagnostics.lastMessage = "A previous split ritual was interrupted in this tab. Sequence reset.";
      state.session.splitRun = null;
      state.session.inspectedThisSession = [];
      state.session.ritualReady = false;
    }

    state.local.activeScreen = "bridge";
    state.local.settings.muted = true;
    syncBranchMetricsFromHistory();
    elements.optionA.value = state.local.draft.optionA;
    elements.optionB.value = state.local.draft.optionB;
    elements.soundToggle.checked = !state.local.settings.muted;
    elements.musicVolume.value = String(state.local.settings.musicVolume);
    elements.musicVolumeValue.textContent = `${state.local.settings.musicVolume}%`;
    elements.flashToggle.checked = state.local.settings.flashEnabled;
    elements.shakeToggle.checked = state.local.settings.shakeEnabled;
    elements.hintToggle.checked = state.local.settings.hotspotHints;
    persistLocal();
    persistSession();
  }

  function sanitizeProfile(profile) {
    const fallback = createDefaultLocalState().profile;
    if (!profile || typeof profile !== "object") {
      return fallback;
    }

    return {
      xp: Number.isFinite(profile.xp) ? profile.xp : 0,
      visitedScreens: dedupeArray(sanitizeArray(profile.visitedScreens, ["bridge"])),
      discoveredHotspots: dedupeArray(sanitizeArray(profile.discoveredHotspots)),
      discoveredLore: dedupeArray(sanitizeArray(profile.discoveredLore)),
      artifacts: dedupeArray(sanitizeArray(profile.artifacts)),
      completedMissions: dedupeArray(sanitizeArray(profile.completedMissions)),
      achievements: sanitizeObjectMap(profile.achievements),
      metrics: {
        hotspotInspections: toSafeNumber(profile.metrics?.hotspotInspections),
        ritualsCompleted: toSafeNumber(profile.metrics?.ritualsCompleted),
        splitsCompleted: toSafeNumber(profile.metrics?.splitsCompleted),
        branchA: toSafeNumber(profile.metrics?.branchA),
        branchB: toSafeNumber(profile.metrics?.branchB),
        exports: toSafeNumber(profile.metrics?.exports),
        imports: toSafeNumber(profile.metrics?.imports),
        shares: toSafeNumber(profile.metrics?.shares),
      },
    };
  }

  function bindEvents() {
    const primeAudio = () => {
      getAudioEngine().prime();
    };

    document.addEventListener("pointerdown", primeAudio, { once: true, passive: true });
    document.addEventListener("keydown", primeAudio, { once: true });

    elements.navButtons.forEach((button) => {
      button.addEventListener("click", () => {
        getAudioEngine().uiTap();
        setActiveScreen(button.dataset.screenTarget);
      });
    });

    elements.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleSplitRequest();
    });

    elements.optionA.addEventListener("input", handleDraftInput);
    elements.optionB.addEventListener("input", handleDraftInput);
    elements.nevermindButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      handleClearChamber();
    });
    elements.shareButton.addEventListener("click", async () => {
      getAudioEngine().uiTap();
      await handleShare();
    });
    elements.confirmSelectedButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      handleConfirmLatestBranch("selected");
    });
    elements.confirmOtherButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      handleConfirmLatestBranch("other");
    });
    elements.exportButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      handleExport();
    });
    elements.importButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      elements.importInput.click();
    });
    elements.importInput.addEventListener("change", handleImport);
    elements.resetButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      promptReset();
    });
    elements.continueMissionButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      handleContinueMission();
    });
    elements.tutorialPrimaryButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      handleTutorialPrimaryAction();
    });
    elements.tutorialSecondaryButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      handleTutorialSecondaryAction();
    });
    elements.briefingButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      showBriefingModal();
    });
    elements.openManualButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      setActiveScreen("manual");
    });
    elements.manualRestartTutorialButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      restartTutorialMode("manual");
    });
    elements.settingsRestartTutorialButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      restartTutorialMode("settings");
    });
    elements.goArchiveButton.addEventListener("click", () => {
      getAudioEngine().uiTap();
      setActiveScreen("archive");
    });
    elements.soundQuickToggle.addEventListener("click", () => {
      setMuted(!state.local.settings.muted, true);
    });

    elements.soundToggle.addEventListener("change", () => {
      setMuted(!elements.soundToggle.checked, true);
    });
    elements.musicVolume.addEventListener("input", () => {
      state.local.settings.musicVolume = sanitizePercent(elements.musicVolume.value, 100);
      getAudioEngine().setMusicVolume(state.local.settings.musicVolume);
      renderSoundToggle();
      persistLocal();
    });
    elements.flashToggle.addEventListener("change", () => {
      state.local.settings.flashEnabled = elements.flashToggle.checked;
      persistLocal();
    });
    elements.shakeToggle.addEventListener("change", () => {
      state.local.settings.shakeEnabled = elements.shakeToggle.checked;
      persistLocal();
    });
    elements.hintToggle.addEventListener("change", () => {
      state.local.settings.hotspotHints = elements.hintToggle.checked;
      renderHotspots();
      persistLocal();
    });

    reducedMotionQuery.addEventListener("change", (event) => {
      state.local.settings.reducedMotionAware = event.matches;
      if (event.matches) {
        state.local.settings.flashEnabled = false;
        state.local.settings.shakeEnabled = false;
        elements.flashToggle.checked = false;
        elements.shakeToggle.checked = false;
      }
      persistLocal();
    });

    window.addEventListener("resize", () => refreshGuideCallout());
    window.addEventListener("scroll", () => refreshGuideCallout(), { passive: true });
    window.addEventListener("pagehide", flushPersistedState);
  }

  function getWalkthroughState() {
    const optionalSoundComplete = !state.local.settings.muted;
    const stepStates = WALKTHROUGH_STEPS.map((step, index) => ({
      step,
      index,
      complete: Boolean(step.complete()),
      optional: false,
    }));
    const currentStepState = stepStates.find((stepState) => !stepState.complete) || null;
    const available = Boolean(currentStepState);
    const dismissed = Boolean(state.local.tutorial?.dismissed);
    const active = available && state.session.tutorialActive !== false && !dismissed;

    return {
      available,
      active,
      paused: available && !active,
      complete: !available,
      dismissed,
      optionalSoundComplete,
      stepStates,
      currentStepState,
      currentStep: currentStepState ? currentStepState.step : null,
      currentIndex: currentStepState ? currentStepState.index : stepStates.length,
    };
  }

  function openTutorialSummaryCallout() {
    const target = elements.optionA;
    if (!target) {
      return;
    }

    focusGuideTarget(target);
    showGuideCallout(target, {
      source: "tutorial-summary",
      targetKey: "optionA",
      title: "Fast route through the Bridge",
      body: "Type two actions, split once, confirm what you actually did, then use History and Profile when you want the wider picture.",
      eyebrow: "Tutorial",
    });
  }

  function resumeTutorialMode(options = {}) {
    state.local.tutorial.dismissed = false;
    state.session.tutorialActive = true;
    if (options.resetAutoShown) {
      state.session.guideAutoShown = false;
    }
    persistLocal();
    persistSession();
    render();

    if (!options.guide) {
      return;
    }

    const tutorial = getWalkthroughState();
    if (tutorial.currentStep) {
      guideToWalkthroughStep(tutorial.currentStep, Boolean(options.auto));
      return;
    }

    openTutorialSummaryCallout();
  }

  function pauseTutorialMode() {
    state.local.tutorial.dismissed = true;
    state.session.tutorialActive = false;
    hideGuideCallout();
    persistLocal();
    persistSession();
    render();
  }

  function restartTutorialMode(source = "manual") {
    state.local.diagnostics.lastMessage = `Tutorial mode reopened from ${source}.`;
    if (state.local.activeScreen !== "bridge") {
      setActiveScreen("bridge");
    }
    resumeTutorialMode({ guide: true, auto: true, resetAutoShown: true });
  }

  function handleTutorialPrimaryAction() {
    const tutorial = getWalkthroughState();
    if (tutorial.complete) {
      restartTutorialMode("tutorial shell");
      return;
    }

    resumeTutorialMode({ guide: true });
  }

  function handleTutorialSecondaryAction() {
    const tutorial = getWalkthroughState();
    if (tutorial.complete) {
      restartTutorialMode("tutorial shell");
      return;
    }

    pauseTutorialMode();
  }

  function getNavButtonForScreen(screen) {
    switch (screen) {
      case "bridge":
        return elements.navBridgeButton;
      case "archive":
        return elements.navArchiveButton;
      case "diagnostics":
        return elements.navDiagnosticsButton;
      case "manual":
        return elements.navManualButton;
      default:
        return null;
    }
  }

  function resolveGuideTarget(targetKey) {
    if (!targetKey) {
      return null;
    }

    const direct = document.getElementById(targetKey);
    if (direct) {
      return direct;
    }

    return elements.hotspotLayer.querySelector(`[data-hotspot-id="${targetKey}"]`);
  }

  function hideGuideCallout(persist = true) {
    document.querySelectorAll(".guide-focus").forEach((node) => node.classList.remove("guide-focus"));
    elements.guideCallout.classList.add("is-hidden");
    elements.guideCallout.setAttribute("aria-hidden", "true");

    if (persist) {
      state.session.highlightTarget = null;
      state.session.guideSource = "";
      state.session.guideTitle = "";
      state.session.guideMessage = "";
      persistSession();
    }
  }

  function positionGuideCallout(target) {
    if (elements.guideCallout.classList.contains("is-hidden")) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const calloutRect = elements.guideCallout.getBoundingClientRect();
    const gap = 14;
    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - calloutRect.width / 2;

    if (top + calloutRect.height > window.innerHeight - 14) {
      top = Math.max(14, rect.top - calloutRect.height - gap);
    }

    left = Math.min(window.innerWidth - calloutRect.width - 14, Math.max(14, left));

    elements.guideCallout.style.top = `${top}px`;
    elements.guideCallout.style.left = `${left}px`;
  }

  function refreshGuideCallout() {
    if (elements.guideCallout.classList.contains("is-hidden")) {
      return;
    }

    const walkthrough = getWalkthroughState();
    if (
      state.session.guideSource === "walkthrough" &&
      (!walkthrough.active || !walkthrough.currentStep || walkthrough.currentStep.target !== state.session.highlightTarget)
    ) {
      hideGuideCallout();
      return;
    }

    const target = resolveGuideTarget(state.session.highlightTarget);
    if (!target) {
      hideGuideCallout();
      return;
    }

    document.querySelectorAll(".guide-focus").forEach((node) => node.classList.remove("guide-focus"));
    target.classList.add("guide-focus");
    positionGuideCallout(target);
  }

  function showGuideCallout(target, config) {
    if (!target) {
      return;
    }

    document.querySelectorAll(".guide-focus").forEach((node) => node.classList.remove("guide-focus"));
    target.classList.add("guide-focus");

    elements.guideCalloutEyebrow.textContent = config.eyebrow || "Guide Me";
    elements.guideCalloutTitle.textContent = config.title;
    elements.guideCalloutBody.textContent = config.body;
    elements.guideCallout.classList.remove("is-hidden");
    elements.guideCallout.setAttribute("aria-hidden", "false");

    state.session.highlightTarget = config.targetKey;
    state.session.guideSource = config.source || "";
    state.session.guideTitle = config.title;
    state.session.guideMessage = config.body;
    persistSession();

    positionGuideCallout(target);
  }

  function focusGuideTarget(target) {
    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: state.local.settings.reducedMotionAware ? "auto" : "smooth",
      block: "center",
      inline: "center",
    });

    if (typeof target.focus === "function") {
      window.setTimeout(() => {
        try {
          target.focus({ preventScroll: true });
        } catch (error) {
          try {
            target.focus();
          } catch (focusError) {}
        }
      }, 90);
    }
  }

  function renderTutorialProgress(tutorial) {
    elements.tutorialProgress.replaceChildren();

    tutorial.stepStates.forEach((stepState) => {
      const step = document.createElement("span");
      step.className = "tutorial-step";
      step.classList.toggle("is-complete", stepState.complete);
      step.classList.toggle("is-current", tutorial.currentStepState?.step.id === stepState.step.id);
      step.title = stepState.step.title;
      elements.tutorialProgress.appendChild(step);
    });
  }

  function renderNavGuidance(walkthrough) {
    const preSplit = state.local.history.length === 0;
    elements.navButtons.forEach((button) => {
      const isBridge = button.dataset.screenTarget === "bridge";
      button.classList.toggle("is-secondary-before-first", preSplit && !isBridge);
      button.title =
        preSplit && !isBridge
          ? "Visible now, but most useful after your first split."
          : `Open ${button.textContent.trim()}.`;
    });

    elements.navHint.textContent = preSplit
      ? walkthrough.active
        ? "Tutorial mode is guiding the fast split loop. Stay with Split first; the other screens stay visible so the route ahead feels clear."
        : walkthrough.paused
          ? "Tutorial mode is paused. Split stays fastest; use Guide Me or Resume Tutorial if you want the route back."
          : "Stay on Split for your first answer. History, Profile, and Guide are visible now so you can see where the journey goes next."
      : walkthrough.active
        ? "Tutorial mode is still guiding the next stops. Split, confirm, then let Guide Me point you to History, Profile, and the first discovery layer."
        : walkthrough.paused
          ? "Tutorial mode is paused. Split freely, or resume the guided route when you want the exact next stop."
          : "The whole terminal is open now. Split fast when you want an answer, or roam for missions, lore, and progression.";
  }

  function renderWalkthrough(walkthrough) {
    renderTutorialProgress(walkthrough);
    elements.walkthroughCard.dataset.tutorialState = walkthrough.active
      ? "active"
      : walkthrough.paused
        ? "paused"
        : "complete";

    if (walkthrough.active) {
      const firstSplitComplete = state.local.history.length > 0;
      const currentStep = walkthrough.currentStep;
      elements.walkthroughEyebrow.textContent = "Tutorial Mode";
      elements.walkthroughTitle.textContent = currentStep ? currentStep.title : "The first minute is simple.";
      elements.walkthroughStatus.textContent = `Step ${walkthrough.currentIndex + 1} of ${walkthrough.stepStates.length}`;
      elements.walkthroughLead.textContent = currentStep
        ? currentStep.guideCopy
        : firstSplitComplete
          ? "Your first split worked. Stay with the guided route long enough to learn the rest of the terminal."
          : "You only need the two text boxes, Split Universe, and Current Universe to finish the first loop.";
      elements.walkthroughFootnote.textContent = firstSplitComplete
        ? "Guide Me will jump to the exact next control. The rest of the Bridge stays visible, but this shell is leading the route."
        : "Guide Me will jump to the exact next control. Optional systems stay visible, but they are not needed for your first answer.";
      elements.tutorialPrimaryButton.textContent = "Guide Me";
      elements.tutorialPrimaryButton.title = "Jump to the exact next tutorial control.";
      elements.tutorialSecondaryButton.hidden = false;
      elements.tutorialSecondaryButton.textContent = "Skip Tutorial";
      elements.tutorialSecondaryButton.title = "Pause tutorial mode and keep the whole terminal open.";
      elements.splitHelper.textContent = firstSplitComplete
        ? "The fast loop is still simple: split for an answer, confirm what you actually did, then roam through History, Profile, and discovery when you want more."
        : "For the cleanest first run, ignore the glowing instruments and finish one split. Nothing optional can bias the result.";
      return;
    }

    if (walkthrough.paused) {
      elements.walkthroughEyebrow.textContent = "Tutorial Paused";
      elements.walkthroughTitle.textContent = walkthrough.currentStep
        ? walkthrough.currentStep.title
        : "The guided route is ready when you are.";
      elements.walkthroughStatus.textContent = `Paused at step ${walkthrough.currentIndex + 1} of ${walkthrough.stepStates.length}`;
      elements.walkthroughLead.textContent =
        "The whole terminal stays open while tutorial mode is paused. Resume it when you want the next exact step, or keep exploring at your own pace.";
      elements.walkthroughFootnote.textContent =
        "Guide Me and the restart buttons in Guide and Settings can bring the first-use route back without resetting your archive.";
      elements.tutorialPrimaryButton.textContent = "Resume Tutorial";
      elements.tutorialPrimaryButton.title = "Resume tutorial mode and highlight the next required control.";
      elements.tutorialSecondaryButton.hidden = true;
      elements.splitHelper.textContent =
        "Split stays the main path. Optional discovery, rituals, and statistics remain available whenever you want them.";
      return;
    }

    elements.walkthroughEyebrow.textContent = "Bridge Ready";
    elements.walkthroughTitle.textContent = "Tutorial complete.";
    elements.walkthroughStatus.textContent = `${walkthrough.stepStates.length} of ${walkthrough.stepStates.length}`;
    elements.walkthroughLead.textContent =
      "The fast loop is yours now: type two actions, split once, confirm what you actually did, then use the wider Bridge when you want more depth.";
    elements.walkthroughFootnote.textContent =
      "Guide Me now points toward missions and exploration. Restart Tutorial from Guide or Settings any time you want the first-use route again.";
    elements.tutorialPrimaryButton.textContent = "Restart Tutorial";
    elements.tutorialPrimaryButton.title = "Reopen the tutorial route on the Bridge.";
    elements.tutorialSecondaryButton.hidden = true;
    elements.splitHelper.textContent =
      "Hotspots, missions, and lore are optional. They deepen the atmosphere and progression, but they never influence which branch is selected.";
  }

  function renderGuidedProgress(walkthrough) {
    elements.continueMissionButton.textContent = walkthrough.available
      ? walkthrough.active
        ? "Guide Me"
        : "Resume Tutorial"
      : "Guide Me";
    elements.continueMissionButton.disabled = false;
    elements.continueMissionButton.title = walkthrough.available
      ? walkthrough.active
        ? "Highlight the exact next tutorial step."
        : "Resume tutorial mode and highlight the next tutorial step."
      : "Highlight the next mission or exploration step.";
    elements.bridgeMissionBanner.classList.toggle("is-onboarding", walkthrough.available);

    if (walkthrough.available) {
      elements.missionEyebrow.textContent = walkthrough.active ? "Tutorial Context" : "Tutorial Paused";
      elements.missionTitle.textContent = walkthrough.currentStep?.title || "The Bridge is ready.";
      elements.missionSummary.textContent =
        walkthrough.active
          ? "The tutorial shell on Split is leading the route. This panel only mirrors the remaining stops so you can see what comes next."
          : "Tutorial mode is paused. Resume it from Split or with Guide Me when you want the exact next stop back on screen.";
      renderMissionStepsList(
        elements.missionSteps,
        walkthrough.stepStates.map((stepState) => ({
          label: stepState.step.label,
          complete: stepState.complete,
          current: walkthrough.currentStep?.id === stepState.step.id,
          progressText: "",
        }))
      );
      return;
    }

    const mission = getActiveMission();
    elements.missionEyebrow.textContent = mission ? "Adventure Mission" : "Free Exploration";
    if (!mission) {
      elements.missionTitle.textContent = "All primary missions complete";
      elements.missionSummary.textContent =
        "The main quest track is complete. Keep splitting for answers, or inspect the Bridge when you want more lore and artifacts.";
      renderMissionStepsList(elements.missionSteps, []);
      return;
    }

    elements.missionTitle.textContent = mission.title;
    elements.missionSummary.textContent = `Current mission: ${mission.summary}`;
    renderMissionStepsList(elements.missionSteps, getMissionStepStates(mission));
  }

  function maybeAutoguideWalkthrough() {
    const walkthrough = getWalkthroughState();
    if (!walkthrough.active || state.session.guideAutoShown) {
      return;
    }

    state.session.guideAutoShown = true;
    persistSession();
    window.setTimeout(() => {
      guideToWalkthroughStep(walkthrough.currentStep, true);
    }, 220);
  }

  function guideToWalkthroughStep(step, auto = false) {
    if (!step) {
      hideGuideCallout();
      return;
    }

    if (step.screen !== state.local.activeScreen) {
      setActiveScreen(step.screen);
    }

    window.setTimeout(() => {
      const target = resolveGuideTarget(step.target);
      if (!target) {
        showModal({
          eyebrow: "Guide Me",
          title: step.title,
          message: step.guideCopy,
          actions: [{ label: "Close", action: closeModal, variant: "secondary" }],
        });
        return;
      }

      focusGuideTarget(target);
      showGuideCallout(target, {
        source: "walkthrough",
        targetKey: step.target,
        title: step.title,
        body: step.guideCopy,
        eyebrow: auto ? "Bridge Guide" : "Guide Me",
      });

      if (step.id === "result") {
        window.setTimeout(() => {
          state.session.walkthroughResultSeen = true;
          const walkthrough = getWalkthroughState();
          renderWalkthrough(walkthrough);
          renderGuidedProgress(walkthrough);
          renderNavGuidance(walkthrough);
          persistSession();
          refreshGuideCallout();
        }, 900);
      }
    }, step.screen !== state.local.activeScreen ? 180 : 40);
  }

  function getMissionGuideConfig() {
    const mission = getActiveMission();
    if (!mission) {
      return {
        screen: "bridge",
        targetKey: "optionA",
        title: "Keep splitting or start exploring",
        body: "All primary missions are complete. Split again for another answer, or inspect the glowing instruments for extra lore.",
      };
    }

    const stepState = firstIncompleteStep(mission);
    if (!stepState) {
      return {
        screen: "bridge",
        targetKey: "optionA",
        title: mission.title,
        body: "This mission is already complete. Split again or inspect the Bridge to continue the adventure.",
      };
    }

    const step = stepState.step;
    if (step.type === "screenVisit") {
      return {
        screen: "bridge",
        targetKey: getNavButtonForScreen(step.screen)?.id || "navBridgeButton",
        title: `Open ${formatScreenName(step.screen)}`,
        body: step.label,
      };
    }

    if (step.type === "exportCount") {
      return {
        screen: "archive",
        targetKey: "exportButton",
        title: "Export your archive",
        body: step.label,
      };
    }

    if (step.type === "splitCount" || step.type === "branchBalance") {
      return {
        screen: "bridge",
        targetKey: "optionA",
        title: "Prepare another split",
        body: step.label,
      };
    }

    if (step.type === "artifactCount") {
      return {
        screen: state.local.profile.artifacts.length >= (step.target || 0) ? "diagnostics" : "bridge",
        targetKey:
          state.local.profile.artifacts.length >= (step.target || 0)
            ? "navDiagnosticsButton"
            : suggestHotspot(),
        title: "Recover more artifacts",
        body: step.label,
      };
    }

    if (step.type === "loreCount") {
      return {
        screen: state.local.profile.discoveredLore.length >= (step.target || 0) ? "archive" : "bridge",
        targetKey:
          state.local.profile.discoveredLore.length >= (step.target || 0)
            ? "navArchiveButton"
            : suggestHotspot(),
        title: "Recover more lore",
        body: step.label,
      };
    }

    return {
      screen: "bridge",
      targetKey: suggestHotspot() || "briefingButton",
      title: mission.title,
      body: step.label,
    };
  }

  function guideToMissionStep() {
    const config = getMissionGuideConfig();
    if (config.screen !== state.local.activeScreen) {
      setActiveScreen(config.screen);
    }

    window.setTimeout(() => {
      const target = resolveGuideTarget(config.targetKey);
      if (!target) {
        showModal({
          eyebrow: "Guide Me",
          title: config.title,
          message: config.body,
          actions: [{ label: "Close", action: closeModal, variant: "secondary" }],
        });
        return;
      }

      focusGuideTarget(target);
      showGuideCallout(target, {
        source: "mission",
        targetKey: config.targetKey,
        title: config.title,
        body: config.body,
        eyebrow: "Mission Guide",
      });
    }, config.screen !== state.local.activeScreen ? 180 : 40);
  }

  function render() {
    syncBranchMetricsFromHistory();
    const walkthrough = getWalkthroughState();
    elements.appShell.dataset.tutorialMode = walkthrough.active ? "active" : walkthrough.paused ? "paused" : "complete";
    state.session.tutorialActive = walkthrough.active;
    state.session.tutorialStepId = walkthrough.currentStep?.id || null;
    state.session.walkthroughActive = walkthrough.active;
    state.session.walkthroughStepId = walkthrough.currentStep?.id || null;

    elements.navButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.screenTarget === state.local.activeScreen);
    });

    elements.panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.screenPanel === state.local.activeScreen);
    });

    const levelInfo = getLevelInfo(state.local.profile.xp);
    elements.profileLevel.textContent = `Level ${levelInfo.level}`;
    elements.profileTitle.textContent = getOperatorTitle(levelInfo.level);
    elements.masteryRingValue.textContent = String(levelInfo.level);
    elements.masteryRing.style.setProperty("--ring-progress", `${Math.round(levelInfo.progress * 100)}%`);
    renderSoundToggle();
    renderNavGuidance(walkthrough);
    renderWalkthrough(walkthrough);
    renderGuidedProgress(walkthrough);
    renderHotspots();
    renderHotspotCard();
    renderRitual();
    renderChoicePrediction();
    renderLatestResult();

    if (state.local.activeScreen === "archive") {
      renderTimeline();
      renderLore();
    } else if (state.local.activeScreen === "diagnostics") {
      renderDiagnostics();
    } else if (state.local.activeScreen === "manual") {
      renderManual();
    }

    updateControls();

    if (!elements.diagnosticsConsole.childElementCount) {
      clearDiagnostics();
      appendDiagnostic(state.local.diagnostics.lastMessage || "Bridge diagnostics idle.");
    }

    updateLiveStatus(
      state.splitInProgress
        ? "Sequence armed"
        : state.local.diagnostics.lastSuccessfulSource
          ? "Relay linked"
          : "Standby",
      state.splitInProgress || Boolean(state.local.diagnostics.lastSuccessfulSource)
    );

    refreshGuideCallout();
    persistSession();
  }

  function setActiveScreen(screen) {
    if (!isValidScreen(screen)) {
      return;
    }

    state.local.activeScreen = screen;
    rememberScreenVisit(screen);
    persistLocal();
    render();

    if (screen === "archive") {
      window.setTimeout(scrollTimelineToLatest, 40);
    }

    if (window.innerWidth <= 780) {
      window.scrollTo({ top: 0, behavior: state.local.settings.reducedMotionAware ? "auto" : "smooth" });
    }
  }

  function renderMission() {
    const mission = getActiveMission();
    if (!mission) {
      elements.missionTitle.textContent = "All primary missions complete";
      elements.missionSummary.textContent =
        "Optional missions are complete. Keep splitting for answers, or explore the Bridge if you want more lore and progression.";
      renderMissionStepsList(elements.missionSteps, []);
      elements.continueMissionButton.disabled = false;
      return;
    }

    elements.missionTitle.textContent = mission.title;
    elements.missionSummary.textContent = `Optional challenge: ${mission.summary}`;
    renderMissionStepsList(elements.missionSteps, getMissionStepStates(mission));
    elements.continueMissionButton.disabled = false;
  }

  function renderMissionStepsList(listElement, stepStates) {
    listElement.replaceChildren();

    if (!stepStates.length) {
      const item = document.createElement("li");
      item.textContent = "No further steps are required. The relay now responds to your own curiosity.";
      item.classList.add("is-complete");
      listElement.appendChild(item);
      return;
    }

    stepStates.forEach((stepState) => {
      const item = document.createElement("li");
      item.classList.toggle("is-complete", stepState.complete);
      item.classList.toggle("is-current", Boolean(stepState.current));
      item.textContent = stepState.progressText
        ? `${stepState.label} (${stepState.progressText})`
        : stepState.label;
      listElement.appendChild(item);
    });
  }

  function renderHotspots() {
    elements.hotspotLayer.replaceChildren();

    state.content.hotspots.forEach((hotspot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hotspot";
      button.dataset.hotspotId = hotspot.id;
      button.style.left = `${hotspot.x}%`;
      button.style.top = `${hotspot.y}%`;
      button.setAttribute("aria-label", hotspot.label);
      button.classList.toggle("is-active", state.session.activeHotspotId === hotspot.id);
      button.classList.toggle("is-discovered", state.local.profile.discoveredHotspots.includes(hotspot.id));
      button.addEventListener("click", () => inspectHotspot(hotspot.id));

      const abbrev = document.createElement("span");
      abbrev.textContent = hotspot.shortLabel || hotspot.label.slice(0, 2).toUpperCase();
      button.appendChild(abbrev);

      if (state.local.settings.hotspotHints) {
        const label = document.createElement("span");
        label.className = "hotspot__label";
        label.textContent = hotspot.label;
        button.appendChild(label);
      }

      elements.hotspotLayer.appendChild(button);
    });
  }

  function renderHotspotCard() {
    const walkthrough = getWalkthroughState();
    const hotspot = getActiveHotspot() || findHotspot(suggestHotspot());

    if (!hotspot) {
      elements.hotspotTitle.textContent = "Inspect the console";
      elements.hotspotBody.textContent =
        "The Bridge is filled with optional instruments. Inspect any hotspot to uncover lore, artifacts, and mission progress without interrupting the split flow.";
      elements.hotspotMeta.textContent = "Suggested first click: the relay prism or phase dial.";
      return;
    }

    if (walkthrough.active && walkthrough.currentStep?.id !== "explore" && !state.session.activeHotspotId) {
      elements.hotspotTitle.textContent = "Optional discovery panel";
      elements.hotspotBody.textContent =
        "You can ignore the glowing instruments until after your first split. They deepen the atmosphere and adventure layer, but they are never required for a fair answer.";
      elements.hotspotMeta.textContent = "Guide Me will bring you back here when it is time to begin exploring.";
      return;
    }

    const discovered = state.local.profile.discoveredHotspots.includes(hotspot.id);
    const lore = hotspot.loreId ? findLore(hotspot.loreId) : null;
    elements.hotspotTitle.textContent = hotspot.title;
    elements.hotspotBody.textContent = discovered
      ? hotspot.description
      : `${hotspot.description} The Archivist is still cataloging this instrument.`;
    elements.hotspotMeta.textContent = lore && state.local.profile.discoveredLore.includes(lore.id)
      ? lore.body
      : hotspot.meta;
  }

  function renderRitual() {
    const inspected = state.session.inspectedThisSession
      .map((hotspotId) => findHotspot(hotspotId))
      .filter(Boolean);

    elements.ritualTrail.replaceChildren();
    inspected.forEach((hotspot) => {
      const chip = document.createElement("span");
      chip.className = "ritual-chip";
      chip.textContent = hotspot.shortLabel || hotspot.label;
      elements.ritualTrail.appendChild(chip);
    });

    elements.ritualBanner.classList.toggle("is-ready", state.session.ritualReady);
    const title = elements.ritualBanner.querySelector(".ritual-banner__title");
    const body = elements.ritualBanner.querySelector(".ritual-banner__body");

    if (state.session.ritualReady) {
      title.textContent = "Optional ritual stabilized.";
      body.textContent =
        "The next successful split will count as a ritualized bifurcation and award extra mastery.";
    } else if (inspected.length === 1) {
      title.textContent = "One instrument calibrated.";
      body.textContent = "Inspect one more distinct Bridge instrument to prepare the optional ritual.";
    } else {
      title.textContent = "Optional ritual not yet stabilized.";
      body.textContent = "Inspect two distinct instruments to enrich the atmosphere and earn extra mastery.";
    }
  }

  function renderLatestResult() {
    const latest = getLatestSplit();
    if (!latest) {
      elements.resultPrimary.textContent = "No relay result yet.";
      elements.resultSecondary.textContent =
        "Type two actions, run one split, and this panel will show the relay assignment plus the place where you confirm what actually happened.";
      elements.resultConfirm.hidden = true;
      elements.shareButton.disabled = true;
      return;
    }

    elements.shareButton.disabled = false;
    setResultCopy(latest);
    renderResultConfirmation(latest);
  }

  function renderChoicePrediction() {
    const prediction = buildChoicePrediction(buildCurrentUniverseEstimator(state.local.history, state.local.draft));
    elements.choicePrediction.dataset.prediction = prediction.key;
    elements.choicePredictionBadge.textContent = prediction.badge;
    elements.choicePredictionConfirmed.textContent = prediction.confirmed.value;
    elements.choicePredictionConfirmedMeta.textContent = prediction.confirmed.meta;
    elements.choicePredictionGuess.textContent = prediction.guess.value;
    elements.choicePredictionGuessMeta.textContent = prediction.guess.meta;
    elements.choicePredictionPattern.textContent = prediction.pattern.value;
    elements.choicePredictionPatternMeta.textContent = prediction.pattern.meta;
    elements.choicePredictionMeta.textContent = prediction.meta;
  }

  function renderEstimatorDiagnostics(estimator) {
    elements.estimatorGrid.replaceChildren(
      buildFrequentistEstimatorCard(estimator),
      buildBayesianEstimatorCard(estimator),
      buildWeightedEstimatorCard(estimator)
    );
  }

  function renderResultConfirmation(record) {
    if (!record) {
      elements.resultConfirm.hidden = true;
      return;
    }

    const assignedKey = getAssignedBranchKey(record);
    const assignedText = getAssignedBranchText(record);
    const otherKey = getOppositeBranchKey(assignedKey);
    const otherText = getBranchText(record, otherKey);
    const observedKey = getObservedBranchKey(record);

    elements.resultConfirm.hidden = false;
    elements.resultConfirmLead.textContent =
      "The relay can assign a branch, but only you know what you actually did. Confirm it below so History, Profile, and the prediction layer all stay grounded in reality.";
    elements.confirmSelectedButton.textContent = `I did: ${truncateLabel(assignedText, 42)}`;
    elements.confirmOtherButton.textContent = `I did: ${truncateLabel(otherText, 42)}`;
    elements.confirmSelectedButton.classList.toggle("is-active", observedKey === assignedKey);
    elements.confirmOtherButton.classList.toggle("is-active", observedKey === otherKey);
    elements.confirmSelectedButton.title = `Confirm that you actually did "${assignedText}".`;
    elements.confirmOtherButton.title = `Confirm that you actually did "${otherText}".`;

    if (!observedKey) {
      elements.resultConfirmStatus.textContent =
        "Unconfirmed. Right now the archive is showing the relay assignment only.";
      return;
    }

    elements.resultConfirmStatus.textContent =
      observedKey === assignedKey
        ? "Confirmed. The archive now matches the relay assignment."
        : "Confirmed. You took the other option, so the archive has been corrected to match your real branch.";
  }

  function renderTimeline() {
    const history = state.local.history.slice(-18);
    const svg = elements.timelineSvg;
    const maxLabelLength = history.reduce((maxLength, entry) => {
      return Math.max(maxLength, getEffectiveBranchText(entry).length);
    }, 0);
    const width = Math.max(1120, maxLabelLength * 22 + 600);
    const centerX = width / 2;
    const branchOffset = 220;
    const leftX = centerX - branchOffset;
    const rightX = centerX + branchOffset;
    svg.replaceChildren();

    svg.setAttribute("viewBox", `0 0 ${width} 420`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", "420");
    svg.style.width = `${width}px`;

    if (!history.length) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(centerX));
      text.setAttribute("y", "210");
      text.setAttribute("fill", "rgba(145, 185, 204, 0.88)");
      text.setAttribute("font-size", "22");
      text.setAttribute("text-anchor", "middle");
      text.textContent = "No branches recorded yet.";
      svg.appendChild(text);
      elements.branchLog.replaceChildren();
      return;
    }

    const rowHeight = 94;
    const height = Math.max(420, history.length * rowHeight + 80);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", String(height));

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const glow = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    glow.setAttribute("id", "timelineGlow");
    glow.innerHTML =
      '<feGaussianBlur stdDeviation="4" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>';
    defs.appendChild(glow);
    svg.appendChild(defs);

    const mainLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    mainLine.setAttribute("x1", String(centerX));
    mainLine.setAttribute("y1", "40");
    mainLine.setAttribute("x2", String(centerX));
    mainLine.setAttribute("y2", String(height - 40));
    mainLine.setAttribute("stroke", "rgba(126, 240, 255, 0.28)");
    mainLine.setAttribute("stroke-width", "3");
    mainLine.setAttribute("stroke-linecap", "round");
    svg.appendChild(mainLine);

    history.forEach((entry, index) => {
      const y = 70 + index * rowHeight;
      const branchRight = getEffectiveBranchKey(entry) === "B";
      const x = branchRight ? rightX : leftX;
      const siblingX = branchRight ? leftX : rightX;

      const chosenPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      chosenPath.setAttribute(
        "d",
        `M ${centerX} ${y} C ${centerX + 12} ${y + 8}, ${x - (branchRight ? 28 : -28)} ${y + 18}, ${x} ${y + 24}`
      );
      chosenPath.setAttribute("fill", "none");
      chosenPath.setAttribute("stroke", branchRight ? "rgba(126, 240, 255, 0.92)" : "rgba(255, 196, 109, 0.94)");
      chosenPath.setAttribute("stroke-width", "4");
      chosenPath.setAttribute("filter", "url(#timelineGlow)");
      svg.appendChild(chosenPath);

      const siblingPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      siblingPath.setAttribute(
        "d",
        `M ${centerX} ${y} C ${centerX - 10} ${y + 6}, ${siblingX - (branchRight ? -18 : 18)} ${y + 14}, ${siblingX} ${y + 20}`
      );
      siblingPath.setAttribute("fill", "none");
      siblingPath.setAttribute("stroke", "rgba(145, 185, 204, 0.2)");
      siblingPath.setAttribute("stroke-width", "2");
      siblingPath.setAttribute("stroke-dasharray", "6 8");
      svg.appendChild(siblingPath);

      const node = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      node.setAttribute("cx", String(x));
      node.setAttribute("cy", String(y + 24));
      node.setAttribute("r", "10");
      node.setAttribute("fill", branchRight ? "rgba(126, 240, 255, 0.95)" : "rgba(255, 196, 109, 0.96)");
      node.setAttribute("stroke", "rgba(255,255,255,0.4)");
      node.setAttribute("stroke-width", "1.5");
      svg.appendChild(node);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", String(branchRight ? x + 22 : x - 22));
      label.setAttribute("y", String(y + 30));
      label.setAttribute("fill", "rgba(232, 251, 255, 0.92)");
      label.setAttribute("font-size", "18");
      label.setAttribute("font-family", "Consolas, monospace");
      label.setAttribute("text-anchor", branchRight ? "start" : "end");
      label.textContent = getEffectiveBranchText(entry);
      svg.appendChild(label);

      const stamp = document.createElementNS("http://www.w3.org/2000/svg", "text");
      stamp.setAttribute("x", String(centerX));
      stamp.setAttribute("y", String(y - 12));
      stamp.setAttribute("fill", "rgba(145, 185, 204, 0.78)");
      stamp.setAttribute("font-size", "14");
      stamp.setAttribute("font-family", "Consolas, monospace");
      stamp.setAttribute("text-anchor", "middle");
      stamp.textContent = formatClock(entry.createdAt);
      svg.appendChild(stamp);
    });

    elements.branchLog.replaceChildren();
    state.local.history
      .slice()
      .reverse()
      .forEach((entry) => {
        const fragment = elements.branchLogTemplate.content.cloneNode(true);
        const assignedKey = getAssignedBranchKey(entry);
        const observedKey = getObservedBranchKey(entry);
        const currentKey = getEffectiveBranchKey(entry);
        const currentText = getEffectiveBranchText(entry);
        const assignedText = getAssignedBranchText(entry);
        const otherText = getEffectiveOtherBranchText(entry);
        fragment.querySelector(".branch-log__timestamp").textContent = formatDateTime(entry.createdAt);
        fragment.querySelector(".branch-log__selected").textContent = observedKey
          ? `Current branch: ${currentText} (${currentKey})`
          : `Relay assignment: ${assignedText} (${assignedKey})`;
        fragment.querySelector(".branch-log__rejected").textContent = observedKey
          ? observedKey === assignedKey
            ? `Relay confirmed. Other universe: ${otherText}`
            : `Relay originally pointed to ${assignedText}. Other universe: ${otherText}`
          : "Unconfirmed. Confirm what you actually did from the Split screen.";
        elements.branchLog.appendChild(fragment);
      });
  }

  function renderLore() {
    elements.loreGrid.replaceChildren();

    state.content.lore.forEach((entry) => {
      const card = document.createElement("article");
      const unlocked = state.local.profile.discoveredLore.includes(entry.id);
      card.className = "lore-card";
      card.classList.toggle("is-locked", !unlocked);

      const title = document.createElement("h3");
      title.textContent = unlocked ? entry.title : "Unknown Fragment";

      const body = document.createElement("p");
      body.textContent = unlocked
        ? entry.body
        : "This fragment remains hidden. Inspect the Bridge and complete more of the relay ritual.";

      const source = document.createElement("p");
      source.className = "lore-card__source";
      source.textContent = unlocked ? entry.source : "Source obscured";

      card.append(title, body, source);
      elements.loreGrid.appendChild(card);
    });
  }

  function renderDiagnostics() {
    const profile = state.local.profile;
    const metrics = profile.metrics;
    const levelInfo = getLevelInfo(profile.xp);
    const title = getOperatorTitle(levelInfo.level);
    const estimator = buildCurrentUniverseEstimator(state.local.history, state.local.draft);
    const nextLevelText = levelInfo.nextLevelAt ? `${levelInfo.currentLevelXp} / ${levelInfo.nextLevelAt} XP` : "Max signal";
    const totalSplits = state.local.history.length;
    const universes = 2n ** BigInt(totalSplits);
    const totalConfirmed = estimator.confirmed.total;
    const ratioA = totalConfirmed ? (estimator.confirmed.countA / totalConfirmed) * 100 : 50;
    const ratioB = totalConfirmed ? (estimator.confirmed.countB / totalConfirmed) * 100 : 50;

    elements.masteryTitle.textContent = title;
    elements.masterySummary.textContent =
      "Inspect the Bridge, complete missions, and preserve branch records to deepen the relay profile.";
    elements.masteryProgressBar.style.width = `${Math.round(levelInfo.progress * 100)}%`;
    elements.masteryProgressText.textContent = nextLevelText;
    elements.splitsCount.textContent = String(totalSplits);
    elements.universesCount.textContent = formatBigInt(universes);
    elements.ritualCount.textContent = String(metrics.ritualsCompleted);
    elements.loreCount.textContent = String(profile.discoveredLore.length);
    elements.biasBarA.style.width = `${ratioA}%`;
    elements.biasBarB.style.width = `${ratioB}%`;

    elements.statsNotes.replaceChildren();
    [
      ["Current title", title],
      ["Artifacts unlocked", `${profile.artifacts.length} / ${Object.keys(ARTIFACT_CATALOG).length}`],
      ["Confirmed sample", `${totalConfirmed} of ${totalSplits} recorded splits`],
      [
        "Current likely now",
        estimator.currentLikely.leadingKey
          ? `${estimator.labels[estimator.currentLikely.leadingKey].short} ${formatProbability(
              estimator.currentLikely.leadingKey === "A" ? estimator.currentLikely.pA : estimator.currentLikely.pB
            )}`
          : "Too close to call",
      ],
      [
        "Recent drift",
        estimator.recent.available
          ? estimator.recent.leadingKey
            ? `${estimator.labels[estimator.recent.leadingKey].short} from the last ${estimator.recent.sampleSize}`
            : `Balanced across the last ${estimator.recent.sampleSize}`
          : `Available after ${ESTIMATOR_RECENT_WINDOW} confirmations`,
      ],
      ["Last branch", getLatestSplit() ? formatDateTime(getLatestSplit().createdAt) : "No branches yet"],
      [
        "Signal source",
        state.local.diagnostics.lastSuccessfulSource
          ? `${state.local.diagnostics.lastSuccessfulSource.sourceDevice} via ${state.local.diagnostics.lastSuccessfulSource.transport}`
          : "No successful live split recorded",
      ],
      ["Data source", state.local.diagnostics.contentSource === "json" ? "External JSON content loaded" : "Embedded fallback content"],
    ].forEach(([label, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      elements.statsNotes.append(dt, dd);
    });

    renderEstimatorDiagnostics(estimator);
    renderAchievements();
    renderArtifacts();
  }

  function renderAchievements() {
    elements.achievementGrid.replaceChildren();

    state.content.achievements.forEach((achievement) => {
      const unlocked = Boolean(state.local.profile.achievements[achievement.id]);
      const card = document.createElement("article");
      card.className = "achievement-card";
      card.classList.toggle("is-locked", !unlocked);
      card.classList.toggle("is-unlocked", unlocked);

      const icon = document.createElement("div");
      icon.className = "achievement-card__icon";
      icon.textContent = achievement.icon || achievement.title.slice(0, 2).toUpperCase();

      const title = document.createElement("h3");
      title.textContent = achievement.title;

      const description = document.createElement("p");
      description.textContent = achievement.description;

      const meta = document.createElement("p");
      meta.className = "achievement-card__meta";
      meta.textContent = unlocked
        ? `Unlocked ${formatDateTime(state.local.profile.achievements[achievement.id].unlockedAt)}`
        : describeConditionProgress(achievement);

      card.append(icon, title, description, meta);
      elements.achievementGrid.appendChild(card);
    });
  }

  function renderArtifacts() {
    elements.artifactGrid.replaceChildren();

    Object.values(ARTIFACT_CATALOG).forEach((artifact) => {
      const unlocked = state.local.profile.artifacts.includes(artifact.id);
      const card = document.createElement("article");
      card.className = "artifact-card";
      card.classList.toggle("is-locked", !unlocked);
      card.classList.toggle("is-unlocked", unlocked);

      const icon = document.createElement("div");
      icon.className = "artifact-card__icon";
      icon.textContent = artifact.icon;

      const title = document.createElement("h3");
      title.textContent = artifact.title;

      const description = document.createElement("p");
      description.textContent = artifact.description;

      const small = document.createElement("small");
      small.textContent = unlocked ? "Recovered and logged in the Archive." : artifact.unlockText;

      card.append(icon, title, description, small);
      elements.artifactGrid.appendChild(card);
    });
  }

  function renderManual() {
    const walkthrough = getWalkthroughState();
    const mission = getActiveMission();
    renderMissionStepsList(
      elements.manualMissionSteps,
      walkthrough.available
        ? walkthrough.stepStates.map((stepState) => ({
            label: stepState.step.label,
            complete: stepState.complete,
            current: walkthrough.currentStep?.id === stepState.step.id,
            progressText: "",
          }))
        : mission
          ? getMissionStepStates(mission)
          : []
    );

    elements.manualLoreNotes.replaceChildren();
    const loreIds = state.local.profile.discoveredLore.slice(-3);
    if (!loreIds.length) {
      const paragraph = document.createElement("p");
      paragraph.textContent = walkthrough.available
        ? walkthrough.active
          ? "Tutorial mode leads from Split. This screen is the calmer reference version of the same route, while Guide Me handles the exact next control."
          : "Tutorial mode is paused. Resume it or restart it when you want the first-use route back on screen."
        : "The Bridge reveals itself slowly. The more you inspect, split, and review the Archive, the more the relay's hidden history comes into focus.";
      elements.manualLoreNotes.appendChild(paragraph);
      return;
    }

    loreIds.forEach((loreId) => {
      const lore = findLore(loreId);
      if (!lore) {
        return;
      }
      const block = document.createElement("p");
      block.textContent = `${lore.title}: ${lore.body}`;
      elements.manualLoreNotes.appendChild(block);
    });
  }

  function updateControls() {
    const hasDraft = Boolean(elements.optionA.value.trim() || elements.optionB.value.trim());
    const latest = getLatestSplit();
    const walkthrough = getWalkthroughState();
    elements.splitButton.disabled = state.splitInProgress;
    elements.nevermindButton.disabled = !state.splitInProgress && !hasDraft;
    elements.nevermindButton.textContent = state.splitInProgress ? "Nevermind" : "Clear Chamber";
    elements.shareButton.disabled = !latest;
    elements.shareButton.title = latest
      ? "Share the currently resolved branch."
      : "Complete one split first so there is a branch to share.";
    elements.nevermindButton.title = state.splitInProgress
      ? "Cancel the live split sequence."
      : hasDraft
        ? "Clear both action chambers."
        : "Type an action first, then you can clear the chamber.";
    elements.musicVolume.title = state.local.settings.muted
      ? "Turn sound on first, then adjust music volume here."
      : "Adjust the music level for the app mix.";
    elements.goArchiveButton.title = latest
      ? "Open History to review previous branches."
      : "You can open History now, but it becomes useful after your first split.";
    elements.openManualButton.title = walkthrough.available
      ? "Open Guide for the calmer reference version of the tutorial route."
      : "Open Guide for controls, lore, and progression help.";
  }

  function renderSoundToggle() {
    const label = state.local.settings.muted ? "Sound: Off" : "Sound: On";
    elements.soundQuickToggle.textContent = label;
    elements.soundQuickToggle.classList.toggle("is-active", !state.local.settings.muted);
    elements.soundQuickToggle.setAttribute("aria-pressed", String(!state.local.settings.muted));
    elements.soundQuickToggle.title = state.local.settings.muted
      ? "Sound is currently off. Turn it on if you want music and button audio."
      : "Sound is currently on. Turn it off if you want silence.";
    elements.soundToggle.checked = !state.local.settings.muted;
    elements.musicVolume.value = String(state.local.settings.musicVolume);
    elements.musicVolumeValue.textContent = `${state.local.settings.musicVolume}%`;
    elements.musicVolume.disabled = state.local.settings.muted;
  }

  function setMuted(muted, playCue) {
    state.local.settings.muted = Boolean(muted);
    const engine = getAudioEngine();
    engine.setMusicVolume(state.local.settings.musicVolume);
    if (!state.local.settings.muted) {
      engine.prime();
      engine.syncAudioState();
    } else {
      engine.syncAudioState();
    }
    if (playCue && !state.local.settings.muted) {
      engine.toggleCue();
    }
    renderSoundToggle();
    persistLocal();
  }

  function handleDraftInput() {
    state.local.draft.optionA = elements.optionA.value;
    state.local.draft.optionB = elements.optionB.value;
    persistLocal();
    renderChoicePrediction();
    updateControls();
    const walkthrough = getWalkthroughState();
    renderWalkthrough(walkthrough);
    renderGuidedProgress(walkthrough);
    renderNavGuidance(walkthrough);
    refreshGuideCallout();

    const validation = validateOptions(state.local.draft.optionA, state.local.draft.optionB);
    if (!state.local.draft.optionA.trim() && !state.local.draft.optionB.trim()) {
      setValidationMessage("Start with the first text box. Sound is optional; the split is the main path.");
      return;
    }

    if (!validation.ok) {
      setValidationMessage(validation.message, "danger");
      return;
    }

    setValidationMessage("Choices calibrated. Press Split Universe when you are ready.", "warning");
  }

  async function handleSplitRequest() {
    if (state.splitInProgress) {
      return;
    }

    getAudioEngine().prime();
    const optionA = elements.optionA.value;
    const optionB = elements.optionB.value;
    const result = await SplitEngine.run(optionA, optionB);

    if (!result.ok) {
      if (result.cancelled) {
        clearStageClasses();
        clearDiagnostics();
        appendDiagnostic("Sequence cancelled by operator.");
        state.local.diagnostics.lastMessage = result.message;
        setValidationMessage(result.message, "warning");
        updateLiveStatus("Standby", false);
        resetSessionRitual();
        persistLocal();
        persistSession();
        render();
        return;
      }

      getAudioEngine().failTone();
      applyFailureStage(result.stage);
      appendDiagnostic(result.message);
      state.local.diagnostics.lastMessage = result.message;
      setValidationMessage(result.message, "danger");
      updateLiveStatus("Signal fault", false);
      persistLocal();
      persistSession();
      render();
      showFailureModal(result);
      return;
    }

    const record = result.record;
    state.local.history.push(record);
    state.local.diagnostics.lastSuccessfulSource = {
      sourceDevice: record.sourceDevice,
      transport: record.transport,
      at: record.createdAt,
    };
    state.local.diagnostics.lastMessage = `Branch resolved at ${formatClock(record.createdAt)}.`;
    syncBranchMetricsFromHistory();
    if (record.ritualPrepared) {
      state.local.profile.metrics.ritualsCompleted += 1;
      grantXp(36);
    }

    grantXp(48);
    discoverLore("first-bifurcation-note");
    if (state.local.profile.metrics.branchA > 0 && state.local.profile.metrics.branchB > 0) {
      discoverLore("balanced-signal-note");
    }

    resetSessionRitual();
    state.session.walkthroughResultSeen = false;
    setResultCopy(record);
    completeAllStages();
    setValidationMessage("The relay assignment is ready below. Confirm what you actually did so the archive matches reality.", "warning");
    evaluateProgress();
    persistLocal();
    persistSession();
    render();

    const walkthrough = getWalkthroughState();
    if (walkthrough.active && walkthrough.currentStep?.id === "result") {
      guideToWalkthroughStep(walkthrough.currentStep, true);
    }

    if (state.local.activeScreen === "archive") {
      window.setTimeout(scrollTimelineToLatest, 40);
    }
  }

  function handleConfirmLatestBranch(mode) {
    const latest = getLatestSplit();
    if (!latest) {
      return;
    }

    const assignedKey = getAssignedBranchKey(latest);
    const confirmedKey = mode === "other" ? getOppositeBranchKey(assignedKey) : assignedKey;
    const changed = getObservedBranchKey(latest) !== confirmedKey;

    latest.observedKey = confirmedKey;
    latest.observedText = getBranchText(latest, confirmedKey);
    state.session.walkthroughResultSeen = true;
    syncBranchMetricsFromHistory();
    state.local.diagnostics.lastMessage =
      confirmedKey === assignedKey
        ? "Current branch confirmed from the relay assignment."
        : "Current branch corrected to the other action.";

    if (state.local.profile.metrics.branchA > 0 && state.local.profile.metrics.branchB > 0) {
      discoverLore("balanced-signal-note");
    }

    setValidationMessage(
      confirmedKey === assignedKey
        ? "Branch confirmed. History and Profile now reflect the branch you actually took."
        : "Branch corrected. History and Profile now reflect the other action as your current branch."
    );
    if (changed) {
      evaluateProgress({ silent: true });
    }
    persistLocal();
    persistSession();
    render();
  }

  function handleClearChamber() {
    if (state.splitInProgress) {
      if (currentRun) {
        currentRun.cancelled = true;
      }
      state.local.diagnostics.lastMessage = "Cancellation requested by operator.";
      setValidationMessage("Cancellation requested. The chamber will clear as soon as the relay responds.", "warning");
      appendDiagnostic("Operator requested Nevermind.");
      return;
    }

    elements.optionA.value = "";
    elements.optionB.value = "";
    state.local.draft.optionA = "";
    state.local.draft.optionB = "";
    state.session.activeHotspotId = null;
    state.local.diagnostics.lastMessage = "Chamber cleared. Awaiting mutually exclusive instructions.";
    clearStageClasses();
    clearDiagnostics();
    appendDiagnostic("Chamber cleared.");
    setValidationMessage("Start with the first text box. Sound is optional; the split is the main path.");
    persistLocal();
    persistSession();
    render();
  }

  async function handleShare() {
    const latest = getLatestSplit();
    if (!latest) {
      showModal({
        eyebrow: "Share Unavailable",
        title: "No Branch To Share",
        message: "Complete a split first so the terminal has a resolved branch to describe.",
        actions: [{ label: "Close", action: closeModal, variant: "secondary" }],
      });
      return;
    }

    const assignedText = getAssignedBranchText(latest);
    const currentText = getEffectiveBranchText(latest);
    const otherText = getEffectiveOtherBranchText(latest);
    const text = hasObservedBranch(latest)
      ? `Current branch confirmed: ${currentText}. Relay assignment: ${assignedText}. Other universe: ${otherText}.`
      : `Relay assignment: ${assignedText}. Confirm what you actually did in the app if you took the other option. Alternate branch: ${otherText}.`;

    try {
      if (navigator.share) {
        await navigator.share({ title: "Universe Splitter", text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("No share target available.");
      }

      state.local.profile.metrics.shares += 1;
      state.local.diagnostics.lastMessage = "Branch summary shared.";
      evaluateProgress({ silent: true });
      persistLocal();
      render();
    } catch (error) {
      showModal({
        eyebrow: "Share Interrupted",
        title: "Signal Could Not Be Shared",
        message: "The browser blocked sharing or clipboard access. Try again from a secure context.",
        actions: [{ label: "Close", action: closeModal, variant: "secondary" }],
      });
    }
  }

  function handleExport() {
    const payload = {
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      profile: state.local.profile,
      history: state.local.history,
      settings: state.local.settings,
      diagnostics: state.local.diagnostics,
      achievements: state.local.profile.achievements,
      artifacts: state.local.profile.artifacts,
      loreFlags: state.local.profile.discoveredLore,
      missions: state.local.profile.completedMissions,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `universe-splitter-profile-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    state.local.profile.metrics.exports += 1;
    state.local.diagnostics.lastMessage = "Profile exported as JSON.";
    evaluateProgress();
    persistLocal();
    render();
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const imported = sanitizeImportedPayload(payload);
      state.local.settings = imported.settings;
      state.local.history = imported.history;
      state.local.diagnostics = imported.diagnostics;
      state.local.tutorial = {
        dismissed:
          imported.history.length > 0 ||
          imported.profile.visitedScreens.includes("archive") ||
          imported.profile.visitedScreens.includes("diagnostics"),
      };
      state.local.profile = imported.profile;
      getAudioEngine().setMusicVolume(state.local.settings.musicVolume);
      getAudioEngine().syncAudioState();
      state.local.profile.metrics.imports += 1;
      state.local.diagnostics.lastMessage = "Archive imported successfully.";
      state.session.tutorialActive = !state.local.tutorial.dismissed;
      state.session.tutorialStepId = "option-a";
      state.session.guideAutoShown = false;
      state.session.walkthroughResultSeen = state.local.history.length > 0;
      hideGuideCallout(false);
      persistLocal();
      persistSession();
      render();
      showModal({
        eyebrow: "Archive Restored",
        title: "Import Complete",
        message: "History, achievements, artifacts, and lore have been restored to the local profile.",
        actions: [{ label: "Continue", action: closeModal, variant: "secondary" }],
      });
    } catch (error) {
      showModal({
        eyebrow: "Import Rejected",
        title: "JSON Could Not Be Restored",
        message: "The selected file was not a compatible Universe Splitter profile export.",
        actions: [{ label: "Close", action: closeModal, variant: "secondary" }],
      });
    } finally {
      event.target.value = "";
    }
  }

  function sanitizeImportedPayload(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid payload.");
    }

    return {
      settings: {
        muted:
          typeof payload.settings?.muted === "boolean"
            ? payload.settings.muted
            : createDefaultLocalState().settings.muted,
        musicVolume: sanitizePercent(payload.settings?.musicVolume, 100),
        flashEnabled:
          typeof payload.settings?.flashEnabled === "boolean" ? payload.settings.flashEnabled : !reducedMotionQuery.matches,
        shakeEnabled:
          typeof payload.settings?.shakeEnabled === "boolean" ? payload.settings.shakeEnabled : !reducedMotionQuery.matches,
        hotspotHints:
          typeof payload.settings?.hotspotHints === "boolean" ? payload.settings.hotspotHints : true,
        reducedMotionAware: reducedMotionQuery.matches,
      },
      history: Array.isArray(payload.history)
        ? payload.history
            .map((record) => ({
              id: typeof record.id === "string" ? record.id : buildRecordId(),
              createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
              optionA: typeof record.optionA === "string" ? record.optionA : "",
              optionB: typeof record.optionB === "string" ? record.optionB : "",
              selectedKey: record.selectedKey === "B" ? "B" : "A",
              selectedText: typeof record.selectedText === "string" ? record.selectedText : "",
              rejectedText: typeof record.rejectedText === "string" ? record.rejectedText : "",
              observedKey: record.observedKey === "B" ? "B" : record.observedKey === "A" ? "A" : null,
              observedText: typeof record.observedText === "string" ? record.observedText : "",
              sourceDevice: typeof record.sourceDevice === "string" ? record.sourceDevice : "geneva",
              transport: typeof record.transport === "string" ? record.transport : "live",
              progressLog: Array.isArray(record.progressLog) ? record.progressLog.slice(0, 6) : STAGES.map((stage) => stage.label),
              ritualPrepared: Boolean(record.ritualPrepared),
              inspectedHotspots: sanitizeArray(record.inspectedHotspots),
            }))
            .filter((record) => record.selectedText && record.rejectedText)
        : [],
      diagnostics: {
        lastApiStatus: payload.diagnostics?.lastApiStatus || null,
        lastSuccessfulSource: payload.diagnostics?.lastSuccessfulSource || null,
        lastMessage: payload.diagnostics?.lastMessage || "Archive restored.",
        contentSource: payload.diagnostics?.contentSource || state.local.diagnostics.contentSource,
      },
      profile: sanitizeProfile(payload.profile),
    };
  }

  function promptReset() {
    showModal({
      eyebrow: "Archive Warning",
      title: "Reset Persistent Profile",
      message:
        "This clears split history, missions, achievements, artifacts, and discovered lore from local storage. The current tab state will also be cleared.",
      actions: [
        { label: "Reset Archive", action: resetAllState, variant: "secondary" },
        { label: "Cancel", action: closeModal, variant: "ghost" },
      ],
    });
  }

  function resetAllState() {
    const defaultLocal = createDefaultLocalState();
    defaultLocal.diagnostics.contentSource = state.local.diagnostics.contentSource;
    state.local = defaultLocal;
    state.session = createDefaultSessionState();
    hideGuideCallout(false);
    LocalStore.clear();
    SessionStore.clear();
    elements.optionA.value = "";
    elements.optionB.value = "";
    clearStageClasses();
    clearDiagnostics();
    appendDiagnostic("Archive reset complete.");
    closeModal();
    persistLocal();
    persistSession();
    render();
  }

  function inspectHotspot(hotspotId) {
    const hotspot = findHotspot(hotspotId);
    if (!hotspot) {
      return;
    }

    getAudioEngine().uiTap();
    const firstDiscovery = !state.local.profile.discoveredHotspots.includes(hotspot.id);
    state.session.activeHotspotId = hotspot.id;
    state.local.profile.metrics.hotspotInspections += 1;

    if (firstDiscovery) {
      state.local.profile.discoveredHotspots.push(hotspot.id);
      grantXp(hotspot.xp || 16);
    }

    if (!state.session.inspectedThisSession.includes(hotspot.id)) {
      state.session.inspectedThisSession.push(hotspot.id);
    }

    if (hotspot.loreId) {
      discoverLore(hotspot.loreId);
    }
    if (hotspot.artifactId) {
      awardArtifact(hotspot.artifactId);
    }

    state.session.ritualReady = state.session.inspectedThisSession.length >= 2;
    state.local.diagnostics.lastMessage = `${hotspot.title} inspected.`;
    evaluateProgress();
    persistLocal();
    persistSession();
    render();
  }

  function handleContinueMission() {
    const walkthrough = getWalkthroughState();
    if (walkthrough.available) {
      resumeTutorialMode({ guide: true });
      return;
    }

    guideToMissionStep();
  }

  function focusSuggestedHotspot() {
    const hotspotId = suggestHotspot();
    if (!hotspotId) {
      elements.optionA.focus();
      return;
    }

    const button = Array.from(elements.hotspotLayer.querySelectorAll(".hotspot")).find(
      (candidate) => candidate.getAttribute("aria-label") === findHotspot(hotspotId)?.label
    );
    if (button) {
      button.focus();
    }
  }

  function suggestHotspot() {
    const undiscovered = state.content.hotspots.find(
      (hotspot) => !state.local.profile.discoveredHotspots.includes(hotspot.id)
    );
    return undiscovered ? undiscovered.id : state.content.hotspots[0]?.id || null;
  }

  function showBriefingModal() {
    const mission = getActiveMission();
    const walkthrough = getWalkthroughState();
    const stepSummary = mission
      ? getMissionStepStates(mission)
          .map((step) => `${step.complete ? "Complete" : "Pending"}: ${step.label}`)
          .join(" ")
      : "All guided missions complete. Continue exploring at your own pace.";

    showModal({
      eyebrow: walkthrough.available ? "Tutorial Briefing" : "Mission Briefing",
      title: walkthrough.available ? "Your first route through the Bridge" : mission ? mission.title : "Bridge Status",
      message: walkthrough.available
        ? walkthrough.active
          ? "Stay with Split first. Type two different actions, resolve one branch, confirm what you actually did, then let Guide Me walk you through History, Profile, and the discovery deck."
          : "Tutorial mode is paused. Resume it when you want the exact next step, or keep using the terminal freely."
        : mission
          ? `${mission.summary} ${stepSummary}`
          : stepSummary,
      actions: [
        {
          label: walkthrough.available ? (walkthrough.active ? "Guide Me" : "Resume Tutorial") : "Continue Mission",
          action: () => {
            closeModal();
            walkthrough.available ? resumeTutorialMode({ guide: true }) : handleContinueMission();
          },
          variant: "secondary",
        },
        {
          label: "Dismiss Briefing",
          action: () => {
            state.session.onboardingDismissed = true;
            persistSession();
            closeModal();
          },
          variant: "ghost",
        },
      ],
    });
  }

  function evaluateProgress(options = {}) {
    syncBranchMetricsFromHistory();
    const notices = [];

    const completedMissions = completeEligibleMissions();
    completedMissions.forEach((mission) => {
      notices.push({
        eyebrow: "Mission Complete",
        title: mission.title,
        message: "The Archivist has recorded your progress and granted a new reward.",
      });
    });

    const unlockedAchievements = unlockEligibleAchievements();
    unlockedAchievements.forEach((achievement) => {
      notices.push({
        eyebrow: "Achievement Unlocked",
        title: achievement.title,
        message: achievement.description,
      });
    });

    if (!options.silent && notices.length && !state.splitInProgress) {
      const notice = notices[0];
      showModal({
        eyebrow: notice.eyebrow,
        title: notice.title,
        message: notice.message,
        actions: [{ label: "Continue", action: closeModal, variant: "secondary" }],
      });
    }
  }

  function completeEligibleMissions() {
    const completed = [];

    state.content.missions.forEach((mission) => {
      if (state.local.profile.completedMissions.includes(mission.id)) {
        return;
      }

      const stepStates = getMissionStepStates(mission);
      if (stepStates.every((step) => step.complete)) {
        state.local.profile.completedMissions.push(mission.id);
        grantXp(mission.rewardXp || 0);
        if (mission.rewardArtifactId) {
          awardArtifact(mission.rewardArtifactId);
        }
        state.local.diagnostics.lastMessage = `${mission.title} completed.`;
        completed.push(mission);
      }
    });

    return completed;
  }

  function unlockEligibleAchievements() {
    const unlocked = [];

    state.content.achievements.forEach((achievement) => {
      if (state.local.profile.achievements[achievement.id]) {
        return;
      }

      if (isConditionComplete(achievement)) {
        state.local.profile.achievements[achievement.id] = {
          unlockedAt: new Date().toISOString(),
          rewardXp: achievement.rewardXp || 0,
        };
        grantXp(achievement.rewardXp || 0);
        unlocked.push(achievement);
      }
    });

    return unlocked;
  }

  function isConditionComplete(condition) {
    const metrics = state.local.profile.metrics;

    switch (condition.type) {
      case "inspectCount":
        return metrics.hotspotInspections >= (condition.target || 0);
      case "ritualCount":
        return metrics.ritualsCompleted >= (condition.target || 0);
      case "splitCount":
        return state.local.history.length >= (condition.target || 0);
      case "screenVisit":
        return state.local.profile.visitedScreens.includes(condition.screen);
      case "uniqueHotspotCount":
        return state.local.profile.discoveredHotspots.length >= (condition.target || 0);
      case "loreCount":
        return state.local.profile.discoveredLore.length >= (condition.target || 0);
      case "artifactCount":
        return state.local.profile.artifacts.length >= (condition.target || 0);
      case "branchBalance":
        return metrics.branchA > 0 && metrics.branchB > 0;
      case "exportCount":
        return metrics.exports >= (condition.target || 0);
      default:
        return false;
    }
  }

  function getMissionStepStates(mission) {
    return mission.steps.map((step) => ({
      step,
      label: step.label,
      complete: isConditionComplete(step),
      progressText: describeConditionProgress(step),
    }));
  }

  function describeConditionProgress(condition) {
    const metrics = state.local.profile.metrics;

    switch (condition.type) {
      case "inspectCount":
        return `${Math.min(metrics.hotspotInspections, condition.target || 0)} / ${condition.target || 0}`;
      case "ritualCount":
        return `${Math.min(metrics.ritualsCompleted, condition.target || 0)} / ${condition.target || 0}`;
      case "splitCount":
        return `${Math.min(state.local.history.length, condition.target || 0)} / ${condition.target || 0}`;
      case "screenVisit":
        return state.local.profile.visitedScreens.includes(condition.screen) ? "Logged" : "Pending";
      case "uniqueHotspotCount":
        return `${Math.min(state.local.profile.discoveredHotspots.length, condition.target || 0)} / ${condition.target || 0}`;
      case "loreCount":
        return `${Math.min(state.local.profile.discoveredLore.length, condition.target || 0)} / ${condition.target || 0}`;
      case "artifactCount":
        return `${Math.min(state.local.profile.artifacts.length, condition.target || 0)} / ${condition.target || 0}`;
      case "branchBalance":
        return state.local.profile.metrics.branchA > 0 && state.local.profile.metrics.branchB > 0 ? "Balanced" : "Pending";
      case "exportCount":
        return `${Math.min(metrics.exports, condition.target || 0)} / ${condition.target || 0}`;
      default:
        return "";
    }
  }

  function firstIncompleteStep(mission) {
    return getMissionStepStates(mission).find((stepState) => !stepState.complete) || null;
  }

  function getActiveMission() {
    return state.content.missions.find(
      (mission) => !state.local.profile.completedMissions.includes(mission.id)
    ) || null;
  }

  function grantXp(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    state.local.profile.xp += amount;
  }

  function discoverLore(loreId) {
    if (!loreId || state.local.profile.discoveredLore.includes(loreId)) {
      return;
    }

    state.local.profile.discoveredLore.push(loreId);
    grantXp(12);
  }

  function awardArtifact(artifactId) {
    if (!artifactId || state.local.profile.artifacts.includes(artifactId) || !ARTIFACT_CATALOG[artifactId]) {
      return;
    }

    state.local.profile.artifacts.push(artifactId);
    grantXp(18);
  }

  function rememberScreenVisit(screen) {
    if (!state.local.profile.visitedScreens.includes(screen)) {
      state.local.profile.visitedScreens.push(screen);
      evaluateProgress({ silent: true });
    }
  }

  function resetSessionRitual() {
    state.session.activeHotspotId = null;
    state.session.inspectedThisSession = [];
    state.session.ritualReady = false;
  }

  function setResultCopy(record) {
    const assignedKey = getAssignedBranchKey(record);
    const assignedText = getAssignedBranchText(record);
    const currentKey = getEffectiveBranchKey(record);
    const currentText = getEffectiveBranchText(record);
    const otherText = getEffectiveOtherBranchText(record);

    if (!hasObservedBranch(record)) {
      elements.resultPrimary.textContent = `Relay assignment: ${assignedText}.`;
      elements.resultSecondary.textContent =
        "This panel reports the relay result first. Confirm what you actually did below so the archive can separate the relay from reality.";
      return;
    }

    elements.resultPrimary.textContent = `Current branch confirmed: ${currentText}.`;
    elements.resultSecondary.textContent =
      currentKey === assignedKey
        ? `The relay assigned the same branch. The prediction card above still interprets the broader pattern separately. Other universe: ${otherText}.`
        : `The relay originally assigned ${assignedText}, but your confirmation now anchors reality here. Other universe: ${otherText}.`;
  }

  function buildChoicePrediction(estimator) {
    const confirmedTotal = estimator.confirmed.total;
    const currentSelection = estimator.currentSelection;
    const guessKey = estimator.currentLikely.leadingKey;
    const guessProbability = guessKey
      ? formatProbability(guessKey === "A" ? estimator.currentLikely.pA : estimator.currentLikely.pB)
      : "";
    const disagreement = Boolean(currentSelection && guessKey && currentSelection.key !== guessKey);

    return {
      key: currentSelection?.key || guessKey || estimator.weighted.leadingKey || "even",
      badge: !confirmedTotal
        ? "Quiet teaser"
        : disagreement
          ? "Confirmed vs model"
          : currentSelection
            ? "Confirmed + model"
            : `${confirmedTotal} confirmed`,
      confirmed: {
        value: currentSelection ? currentSelection.headline : "No confirmed current universe yet.",
        meta: currentSelection
          ? "This is the latest explicit confirmation in your archive."
          : "Confirm a branch after the relay runs to anchor this layer in reality.",
      },
      guess: {
        value: !confirmedTotal
          ? "No confirmed pattern yet."
          : guessKey
            ? `${estimator.labels[guessKey].headline} | ${guessProbability}`
            : "Too close to call.",
        meta: !confirmedTotal
          ? "The model stays quiet until confirmed choices exist."
          : estimator.currentLikely.mode === "baseline-plus-recent"
            ? `Current likely branch blends the long-view synthesis with recent drift from the last ${estimator.recent.sampleSize} confirmations.`
            : `Current likely branch is using the long-view synthesis across ${confirmedTotal} confirmed ${pluralize(confirmedTotal, "choice")}.`,
      },
      pattern: {
        value: estimator.pattern.headline,
        meta: estimator.pattern.meta,
      },
      meta: !confirmedTotal
        ? "Relay assignment stays random. This card only interprets confirmed behavior."
        : disagreement
          ? `Confirmed reality is ${currentSelection.shortLabel}. The broader model still leans ${estimator.labels[guessKey].short}.`
          : currentSelection
            ? "Confirmed reality stays separate from the model's broader pattern context."
            : "Model interpretation only. Confirm what you actually did so the archive can separate truth from trend.",
    };
  }

  function buildFrequentistEstimatorCard(estimator) {
    const article = createEstimatorCard("Frequentist", "Bernoulli PMF");
    const lead = document.createElement("p");
    lead.className = "estimator-card__lead";
    lead.textContent = estimator.frequentist.available
      ? "Confirmed branch frequencies converted into a Bernoulli PMF over Option A and Option B."
      : "No confirmed observations yet, so the frequentist point estimate is unavailable.";

    article.append(
      lead,
      createEstimatorStatsList([
        ["Point estimate p(A)", estimator.frequentist.available ? formatProportion(estimator.frequentist.pA) : "Unavailable"],
        [
          "Wilson 95% CI",
          estimator.frequentist.available
            ? `${formatProbability(estimator.frequentist.interval.lower)} to ${formatProbability(estimator.frequentist.interval.upper)}`
            : "Unavailable",
        ],
        ["Confirmed sample", `${estimator.confirmed.total} ${pluralize(estimator.confirmed.total, "branch")}`],
      ])
    );

    if (estimator.frequentist.available) {
      article.append(
        createProbabilityStack([
          { label: "Option A", value: estimator.frequentist.pA, tone: "a" },
          { label: "Option B", value: estimator.frequentist.pB, tone: "b" },
        ])
      );
    }

    const note = document.createElement("p");
    note.className = "estimator-card__note";
    note.textContent = estimator.frequentist.available
      ? "Wilson interval shows the 95% confidence range for P(A)."
      : "Confirm at least one branch to activate the frequentist PMF.";
    article.append(note);
    return article;
  }

  function buildBayesianEstimatorCard(estimator) {
    const article = createEstimatorCard("Bayesian", "Beta Posterior PDF");
    const lead = document.createElement("p");
    lead.className = "estimator-card__lead";
    lead.textContent = "Posterior over the latent preference p = P(A), updated from a neutral Beta(1,1) prior.";

    article.append(
      lead,
      createEstimatorStatsList([
        ["Prior", `Beta(${estimator.bayesian.priorAlpha}, ${estimator.bayesian.priorBeta})`],
        ["Posterior", `Beta(${estimator.bayesian.alpha}, ${estimator.bayesian.beta})`],
        ["Posterior mean", formatProportion(estimator.bayesian.mean)],
        ["Posterior variance", formatDecimal(estimator.bayesian.variance, 4)],
      ]),
      createDensityChart(estimator.bayesian.densitySamples)
    );

    const note = document.createElement("p");
    note.className = "estimator-card__note";
    note.textContent = "The density begins flat at cold start and tightens as confirmed choices accumulate.";
    article.append(note);
    return article;
  }

  function buildWeightedEstimatorCard(estimator) {
    const article = createEstimatorCard("Current Universe Estimate", "Layered Interpretation", "estimator-card--weighted");
    const lead = document.createElement("p");
    const currentSelection = estimator.currentSelection;
    const leadingKey = estimator.currentLikely.leadingKey;
    const strong = document.createElement("strong");
    const longViewKey = estimator.weighted.leadingKey;
    lead.className = "estimator-card__lead";
    lead.append("Model guess now: ");
    strong.textContent = leadingKey ? estimator.labels[leadingKey].headline : "Too close to call";
    lead.append(strong);
    lead.append(".");

    article.append(
      lead,
      createEstimatorStatsList([
        [
          "Long-view synthesis",
          longViewKey
            ? `${estimator.labels[longViewKey].short} ${formatProbability(longViewKey === "A" ? estimator.weighted.pA : estimator.weighted.pB)}`
            : "Balanced baseline",
        ],
        [
          "Recent drift",
          estimator.recent.available
            ? estimator.recent.leadingKey
              ? `${estimator.labels[estimator.recent.leadingKey].short} ${formatProbability(
                  estimator.recent.leadingKey === "A" ? estimator.recent.pA : estimator.recent.pB
                )} from the last ${estimator.recent.sampleSize}`
              : `Balanced across the last ${estimator.recent.sampleSize}`
            : `Available after ${ESTIMATOR_RECENT_WINDOW} confirmed choices`,
        ],
        [
          "Current likely now",
          leadingKey
            ? `${estimator.labels[leadingKey].short} ${formatProbability(
                leadingKey === "A" ? estimator.currentLikely.pA : estimator.currentLikely.pB
              )}`
            : "Too close to call",
        ],
        ["Latest explicit confirmation", currentSelection ? currentSelection.headline : "Awaiting confirmation"],
      ]),
      createProbabilityStack([
        { label: estimator.labels.A.short, value: estimator.currentLikely.pA, tone: "a" },
        { label: estimator.labels.B.short, value: estimator.currentLikely.pB, tone: "b" },
      ])
    );

    const note = document.createElement("p");
    note.className = "estimator-card__note";
    note.textContent = !estimator.confirmed.total
      ? "The layered view stays quiet until at least one confirmed branch exists."
      : currentSelection && leadingKey && currentSelection.key !== leadingKey
        ? "Confirmed reality wins. The disagreement here is interesting context, not a correction."
        : "Current likely branch blends long-view synthesis with recent drift once five confirmed choices exist.";
    article.append(note);
    return article;
  }

  function createEstimatorCard(title, eyebrow, extraClass = "") {
    const article = document.createElement("article");
    article.className = extraClass ? `estimator-card ${extraClass}` : "estimator-card";

    const eyebrowLine = document.createElement("p");
    eyebrowLine.className = "estimator-card__eyebrow";
    eyebrowLine.textContent = eyebrow;

    const heading = document.createElement("h3");
    heading.textContent = title;

    article.append(eyebrowLine, heading);
    return article;
  }

  function createEstimatorStatsList(entries) {
    const list = document.createElement("dl");
    list.className = "estimator-card__stats";

    entries.forEach(([label, value]) => {
      const wrapper = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      wrapper.append(dt, dd);
      list.appendChild(wrapper);
    });

    return list;
  }

  function createProbabilityStack(rows) {
    const stack = document.createElement("div");
    stack.className = "probability-stack";
    rows.forEach((row) => {
      stack.appendChild(createProbabilityRow(row.label, row.value, row.tone));
    });
    return stack;
  }

  function createProbabilityRow(label, value, tone) {
    const row = document.createElement("div");
    row.className = "probability-row";

    const labelElement = document.createElement("span");
    labelElement.className = "probability-row__label";
    labelElement.textContent = label;

    const track = document.createElement("span");
    track.className = "probability-row__track";

    const fill = document.createElement("span");
    fill.className = `probability-row__fill probability-row__fill--${tone}`;
    fill.style.width = `${Math.max(0, Math.min(100, (Number(value) || 0) * 100))}%`;
    track.appendChild(fill);

    const valueElement = document.createElement("span");
    valueElement.className = "probability-row__value";
    valueElement.textContent = formatProbability(value);

    row.append(labelElement, track, valueElement);
    return row;
  }

  function createDensityChart(samples) {
    const wrapper = document.createElement("div");
    wrapper.className = "estimator-chart";

    const svg = buildDensityChartSvg(samples);
    const caption = document.createElement("p");
    caption.className = "estimator-chart__caption";
    caption.textContent = "Beta PDF over the latent probability P(A).";

    wrapper.append(svg, caption);
    return wrapper;
  }

  function buildDensityChartSvg(samples) {
    const svgNs = "http://www.w3.org/2000/svg";
    const width = 240;
    const height = 120;
    const left = 18;
    const right = 18;
    const top = 12;
    const bottom = 18;
    const baselineY = height - bottom;
    const innerWidth = width - left - right;
    const innerHeight = baselineY - top;
    const maxDensity = Math.max(1, ...samples.map((sample) => sample.density));
    const toX = (x) => left + x * innerWidth;
    const toY = (density) => baselineY - (density / maxDensity) * innerHeight;
    const points = samples.map((sample) => ({
      x: toX(sample.x),
      y: toY(sample.density),
    }));

    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("class", "estimator-chart__svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Beta posterior density for the probability of choosing Option A.");

    const axis = document.createElementNS(svgNs, "line");
    axis.setAttribute("class", "estimator-chart__axis");
    axis.setAttribute("x1", String(left));
    axis.setAttribute("y1", String(baselineY));
    axis.setAttribute("x2", String(width - right));
    axis.setAttribute("y2", String(baselineY));

    const area = document.createElementNS(svgNs, "path");
    area.setAttribute("class", "estimator-chart__area");
    area.setAttribute(
      "d",
      `M ${points[0].x.toFixed(2)} ${baselineY} ${points
        .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ")} L ${points[points.length - 1].x.toFixed(2)} ${baselineY} Z`
    );

    const line = document.createElementNS(svgNs, "path");
    line.setAttribute("class", "estimator-chart__line");
    line.setAttribute(
      "d",
      points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ")
    );

    const leftLabel = document.createElementNS(svgNs, "text");
    leftLabel.setAttribute("class", "estimator-chart__label");
    leftLabel.setAttribute("x", String(left));
    leftLabel.setAttribute("y", String(height - 4));
    leftLabel.textContent = "0";

    const rightLabel = document.createElementNS(svgNs, "text");
    rightLabel.setAttribute("class", "estimator-chart__label");
    rightLabel.setAttribute("x", String(width - right - 6));
    rightLabel.setAttribute("y", String(height - 4));
    rightLabel.textContent = "1";

    svg.append(axis, area, line, leftLabel, rightLabel);
    return svg;
  }

  function buildCurrentUniverseEstimator(history, draft) {
    const labels = buildDraftBranchLabels(draft?.optionA, draft?.optionB);
    const confirmedHistory = getConfirmedHistory(history);
    const confirmed = countObservedBranches(confirmedHistory);
    const frequentist = buildFrequentistEstimate(confirmed.countA, confirmed.total);
    const bayesian = buildBayesianEstimate(confirmed.countA, confirmed.total);
    const weighted = buildWeightedSynthesis(frequentist, bayesian, confirmed.total);
    const recent = buildRecentEstimate(confirmedHistory);
    const currentLikely = buildCurrentLikelyEstimate(weighted, recent, confirmed.total);
    const latestConfirmedRecord = getLatestConfirmedRecord(history);
    const latestObservedKey = getObservedBranchKey(latestConfirmedRecord);
    const latestObservedText = latestObservedKey ? getBranchText(latestConfirmedRecord, latestObservedKey) : "";
    const currentSelection =
      latestObservedKey && latestConfirmedRecord
        ? {
            key: latestObservedKey,
            shortLabel: labels[latestObservedKey].short,
            text: latestObservedText,
            headline: latestObservedText
              ? `Option ${latestObservedKey}, "${truncateLabel(latestObservedText, 48)}"`
              : `Option ${latestObservedKey}`,
          }
        : null;
    const pattern = buildBehaviorPatternSummary({
      confirmed,
      weighted,
      recent,
      currentLikely,
      labels,
    });

    return {
      recordedTotal: Array.isArray(history) ? history.length : 0,
      confirmed,
      frequentist,
      bayesian,
      weighted,
      recent,
      currentLikely,
      currentSelection,
      pattern,
      labels,
    };
  }

  function getLatestConfirmedRecord(history) {
    if (!Array.isArray(history)) {
      return null;
    }

    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (getObservedBranchKey(history[index])) {
        return history[index];
      }
    }

    return null;
  }

  function getConfirmedHistory(history) {
    if (!Array.isArray(history)) {
      return [];
    }

    return history.filter((record) => Boolean(getObservedBranchKey(record)));
  }

  function countObservedBranches(history) {
    return history.reduce(
      (counts, record) => {
        if (getObservedBranchKey(record) === "B") {
          counts.countB += 1;
        } else {
          counts.countA += 1;
        }
        counts.total += 1;
        return counts;
      },
      { total: 0, countA: 0, countB: 0 }
    );
  }

  function buildRecentEstimate(confirmedHistory) {
    const recentHistory = confirmedHistory.slice(-ESTIMATOR_RECENT_WINDOW);
    const counts = countObservedBranches(recentHistory);
    const total = counts.total;
    const pA = total ? counts.countA / total : 0.5;

    return {
      available: total >= ESTIMATOR_RECENT_WINDOW,
      sampleSize: total,
      countA: counts.countA,
      countB: counts.countB,
      pA,
      pB: 1 - pA,
      leadingKey: total >= ESTIMATOR_RECENT_WINDOW ? getLeadingBranchKey(pA, 1 - pA) : null,
    };
  }

  function buildCurrentLikelyEstimate(weighted, recent, total) {
    if (!total) {
      return {
        mode: "quiet",
        pA: weighted.pA,
        pB: weighted.pB,
        leadingKey: weighted.leadingKey,
      };
    }

    if (!recent.available) {
      return {
        mode: "long-view-only",
        pA: weighted.pA,
        pB: weighted.pB,
        leadingKey: weighted.leadingKey,
      };
    }

    const pA = ESTIMATOR_BASELINE_WEIGHT * weighted.pA + ESTIMATOR_RECENT_WEIGHT * recent.pA;
    return {
      mode: "baseline-plus-recent",
      pA,
      pB: 1 - pA,
      leadingKey: getLeadingBranchKey(pA, 1 - pA),
    };
  }

  function buildBehaviorPatternSummary({ confirmed, weighted, recent, currentLikely, labels }) {
    if (!confirmed.total) {
      return {
        headline: "No confirmed pattern yet.",
        meta: "The prediction surface stays quiet until you confirm a real branch.",
      };
    }

    if (confirmed.total < 3) {
      return {
        headline: "Too little confirmed history.",
        meta: `${confirmed.total} confirmed ${pluralize(confirmed.total, "choice")} logged so far.`,
      };
    }

    if (recent.available && recent.leadingKey && weighted.leadingKey && recent.leadingKey !== weighted.leadingKey) {
      return {
        headline: `Recent drift: ${labels[recent.leadingKey].short}.`,
        meta: `Long-run lean still favors ${labels[weighted.leadingKey].short}.`,
      };
    }

    if (recent.available && recent.leadingKey) {
      return {
        headline: `Recently leaning ${labels[recent.leadingKey].short}.`,
        meta: weighted.leadingKey
          ? `Long-run lean: ${labels[weighted.leadingKey].short}.`
          : "Long-run history is still balanced.",
      };
    }

    if (currentLikely.leadingKey) {
      return {
        headline: `Long-run lean: ${labels[currentLikely.leadingKey].short}.`,
        meta: `Recent drift activates after ${ESTIMATOR_RECENT_WINDOW} confirmed choices.`,
      };
    }

    return {
      headline: "Balanced so far.",
      meta: "Confirmed history is still too balanced to call.",
    };
  }

  function buildFrequentistEstimate(countA, total) {
    if (!total) {
      return {
        available: false,
        pA: 0.5,
        pB: 0.5,
        interval: { lower: 0, upper: 1 },
      };
    }

    const pA = countA / total;
    return {
      available: true,
      pA,
      pB: 1 - pA,
      interval: computeWilsonInterval(countA, total),
    };
  }

  function computeWilsonInterval(successes, trials, z = ESTIMATOR_CONFIDENCE_Z) {
    if (!trials) {
      return { lower: 0, upper: 1 };
    }

    const zSquared = z * z;
    const proportion = successes / trials;
    const denominator = 1 + zSquared / trials;
    const center = (proportion + zSquared / (2 * trials)) / denominator;
    const margin = (z * Math.sqrt((proportion * (1 - proportion) + zSquared / (4 * trials)) / trials)) / denominator;

    return {
      lower: Math.max(0, center - margin),
      upper: Math.min(1, center + margin),
    };
  }

  function buildBayesianEstimate(countA, total) {
    const alpha = ESTIMATOR_PRIOR_ALPHA + countA;
    const beta = ESTIMATOR_PRIOR_BETA + total - countA;
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / (((alpha + beta) ** 2) * (alpha + beta + 1));

    return {
      priorAlpha: ESTIMATOR_PRIOR_ALPHA,
      priorBeta: ESTIMATOR_PRIOR_BETA,
      alpha,
      beta,
      mean,
      variance,
      densitySamples: sampleBetaPdf(alpha, beta, ESTIMATOR_DENSITY_SAMPLES),
    };
  }

  function buildWeightedSynthesis(frequentist, bayesian, total) {
    if (!total || !frequentist.available) {
      return {
        mode: "prior-only",
        pA: bayesian.mean,
        pB: 1 - bayesian.mean,
        weightFrequentist: 0,
        weightBayesian: 1,
        leadingKey: getLeadingBranchKey(bayesian.mean, 1 - bayesian.mean),
      };
    }

    const uncertaintyFrequentist = Math.max(frequentist.interval.upper - frequentist.interval.lower, 1e-6);
    const uncertaintyBayesian = Math.max(3.92 * Math.sqrt(bayesian.variance), 1e-6);
    const frequentistWeightRaw = 1 / (uncertaintyFrequentist * uncertaintyFrequentist);
    const bayesianWeightRaw = 1 / (uncertaintyBayesian * uncertaintyBayesian);
    const totalWeight = frequentistWeightRaw + bayesianWeightRaw;
    const weightFrequentist = frequentistWeightRaw / totalWeight;
    const weightBayesian = bayesianWeightRaw / totalWeight;
    const pA = weightFrequentist * frequentist.pA + weightBayesian * bayesian.mean;

    return {
      mode: "weighted",
      pA,
      pB: 1 - pA,
      weightFrequentist,
      weightBayesian,
      leadingKey: getLeadingBranchKey(pA, 1 - pA),
    };
  }

  function buildDraftBranchLabels(optionA, optionB) {
    const textA = String(optionA || "").trim();
    const textB = String(optionB || "").trim();
    const includeText = Boolean(textA && textB);

    return {
      A: {
        short: "Option A",
        headline: includeText ? `Option A, "${truncateLabel(textA, 48)}"` : "Option A",
      },
      B: {
        short: "Option B",
        headline: includeText ? `Option B, "${truncateLabel(textB, 48)}"` : "Option B",
      },
    };
  }

  function getLeadingBranchKey(probabilityA, probabilityB) {
    if (Math.abs(probabilityA - probabilityB) < ESTIMATOR_TIE_EPSILON) {
      return null;
    }
    return probabilityB > probabilityA ? "B" : "A";
  }

  function sampleBetaPdf(alpha, beta, sampleCount) {
    const epsilon = 0.0001;
    const samples = [];

    for (let index = 0; index < sampleCount; index += 1) {
      const rawX = sampleCount > 1 ? index / (sampleCount - 1) : 0.5;
      const x = Math.min(1 - epsilon, Math.max(epsilon, rawX));
      samples.push({
        x: rawX,
        density: betaPdf(x, alpha, beta),
      });
    }

    return samples;
  }

  function betaPdf(x, alpha, beta) {
    if (x <= 0 || x >= 1) {
      return 0;
    }

    const logDensity = (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logBeta(alpha, beta);
    const density = Math.exp(logDensity);
    return Number.isFinite(density) ? density : 0;
  }

  function logBeta(alpha, beta) {
    return logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  }

  function logGamma(value) {
    const coefficients = [
      676.5203681218851,
      -1259.1392167224028,
      771.3234287776531,
      -176.6150291621406,
      12.507343278686905,
      -0.13857109526572012,
      0.000009984369578019572,
      0.00000015056327351493116,
    ];

    if (value < 0.5) {
      return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
    }

    let x = 0.9999999999998099;
    const adjusted = value - 1;

    coefficients.forEach((coefficient, index) => {
      x += coefficient / (adjusted + index + 1);
    });

    const t = adjusted + coefficients.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (adjusted + 0.5) * Math.log(t) - t + Math.log(x);
  }

  function validateOptions(optionA, optionB) {
    const normalizedA = normalizeDecision(optionA);
    const normalizedB = normalizeDecision(optionB);

    if (!normalizedA || !normalizedB) {
      return {
        ok: false,
        stage: "valid",
        message: "Both chambers must contain a meaningful action before the relay can proceed.",
      };
    }

    if (normalizedA === normalizedB) {
      return {
        ok: false,
        stage: "valid",
        message: "The actions are identical. The relay requires two distinct futures.",
      };
    }

    if (diceCoefficient(normalizedA, normalizedB) > 0.84) {
      return {
        ok: false,
        stage: "valid",
        message: "The actions are too similar. Make the branches more meaningfully different.",
      };
    }

    return { ok: true, stage: "valid", message: "" };
  }

  function normalizeDecision(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function diceCoefficient(left, right) {
    if (!left || !right) {
      return 0;
    }
    if (left === right) {
      return 1;
    }
    if (left.length < 2 || right.length < 2) {
      return 0;
    }

    const pairs = new Map();
    for (let index = 0; index < left.length - 1; index += 1) {
      const pair = left.slice(index, index + 2);
      pairs.set(pair, (pairs.get(pair) || 0) + 1);
    }

    let intersection = 0;
    for (let index = 0; index < right.length - 1; index += 1) {
      const pair = right.slice(index, index + 2);
      const count = pairs.get(pair) || 0;
      if (count > 0) {
        pairs.set(pair, count - 1);
        intersection += 1;
      }
    }

    return (2 * intersection) / (left.length + right.length - 2);
  }

  function setValidationMessage(message, tone) {
    elements.validationMessage.textContent = message;
    elements.validationMessage.classList.remove("is-warning", "is-danger");
    if (tone === "warning") {
      elements.validationMessage.classList.add("is-warning");
    }
    if (tone === "danger") {
      elements.validationMessage.classList.add("is-danger");
    }
  }

  function clearDiagnostics() {
    elements.diagnosticsConsole.replaceChildren();
  }

  function appendDiagnostic(message) {
    const line = document.createElement("p");
    line.className = "diagnostics-console__line";
    line.textContent = message;
    elements.diagnosticsConsole.appendChild(line);

    while (elements.diagnosticsConsole.childElementCount > 7) {
      elements.diagnosticsConsole.firstElementChild?.remove();
    }

    elements.diagnosticsConsole.scrollTop = elements.diagnosticsConsole.scrollHeight;
  }

  function updateLiveStatus(message, linked) {
    elements.liveStatusText.textContent = message;
    elements.connectionReadout.textContent = state.local.diagnostics.lastMessage || message;
    elements.liveLamp.classList.toggle("is-live", Boolean(linked));
  }

  function clearStageClasses() {
    elements.stageItems.forEach((item) => {
      item.classList.remove("is-active", "is-complete", "is-failed");
    });
  }

  function activateStage(stageKey) {
    clearStageClasses();
    const stageIndex = STAGE_INDEX[stageKey];
    elements.stageItems.forEach((item, index) => {
      if (index < stageIndex) {
        item.classList.add("is-complete");
      } else if (index === stageIndex) {
        item.classList.add("is-active");
      }
    });
  }

  function completeAllStages() {
    elements.stageItems.forEach((item) => {
      item.classList.remove("is-active", "is-failed");
      item.classList.add("is-complete");
    });
  }

  function applyFailureStage(stageKey) {
    clearStageClasses();
    const stageIndex = STAGE_INDEX[stageKey] ?? 0;
    elements.stageItems.forEach((item, index) => {
      if (index < stageIndex) {
        item.classList.add("is-complete");
      } else if (index === stageIndex) {
        item.classList.add("is-failed");
      }
    });
  }

  function updateSplitRunStage(stageKey) {
    if (!state.session.splitRun) {
      return;
    }
    state.session.splitRun.currentStage = stageKey;
    persistSession();
  }

  function triggerEffects() {
    if (state.local.settings.flashEnabled) {
      elements.flashOverlay.classList.remove("is-active");
      void elements.flashOverlay.offsetWidth;
      elements.flashOverlay.classList.add("is-active");
    }

    if (state.local.settings.shakeEnabled) {
      elements.appShell.classList.remove("is-shaking");
      void elements.appShell.offsetWidth;
      elements.appShell.classList.add("is-shaking");
      window.setTimeout(() => elements.appShell.classList.remove("is-shaking"), 450);
    }
  }

  async function waitForStage(stageKey) {
    const stage = STAGES.find((entry) => entry.key === stageKey);
    await delay(stage ? stage.hold : 300);
  }

  function showFailureModal(failure) {
    showModal({
      eyebrow: "Relay Fault",
      title: "Split Interrupted",
      message: failure.message,
      actions: [
        {
          label: "Try Again",
          action: () => {
            closeModal();
            handleSplitRequest().catch(() => {});
          },
          variant: "secondary",
        },
        { label: "Nevermind", action: closeModal, variant: "ghost" },
      ],
    });
  }

  function showModal(config) {
    elements.modalEyebrow.textContent = config.eyebrow || "Archivist Relay";
    elements.modalTitle.textContent = config.title || "Signal Notice";
    elements.modalMessage.textContent = config.message || "";
    elements.modalActions.replaceChildren();

    config.actions.forEach((actionConfig) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = actionConfig.label;
      button.className = actionConfig.variant === "ghost" ? "ghost-button" : "secondary-button";
      button.addEventListener("click", () => {
        getAudioEngine().uiTap();
        actionConfig.action();
      });
      elements.modalActions.appendChild(button);
    });

    elements.modalBackdrop.classList.remove("is-hidden");
    elements.modalBackdrop.setAttribute("aria-hidden", "false");
    modalEscapeHandler = (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };
    document.addEventListener("keydown", modalEscapeHandler);
    elements.modalBackdrop.addEventListener("click", handleModalBackdropClick);
  }

  function closeModal() {
    elements.modalBackdrop.classList.add("is-hidden");
    elements.modalBackdrop.setAttribute("aria-hidden", "true");
    elements.modalActions.replaceChildren();
    if (modalEscapeHandler) {
      document.removeEventListener("keydown", modalEscapeHandler);
      modalEscapeHandler = null;
    }
    elements.modalBackdrop.removeEventListener("click", handleModalBackdropClick);
  }

  function handleModalBackdropClick(event) {
    if (event.target === elements.modalBackdrop) {
      closeModal();
    }
  }

  function getLevelInfo(xp) {
    let level = 1;
    let levelFloor = 0;
    let nextLevelAt = 180;

    while (xp >= nextLevelAt) {
      levelFloor = nextLevelAt;
      level += 1;
      nextLevelAt += 180 + (level - 2) * 90;
      if (level > 12) {
        return {
          level: 12,
          progress: 1,
          currentLevelXp: xp,
          nextLevelAt: null,
        };
      }
    }

    return {
      level,
      progress: nextLevelAt > levelFloor ? (xp - levelFloor) / (nextLevelAt - levelFloor) : 1,
      currentLevelXp: xp - levelFloor,
      nextLevelAt: nextLevelAt - levelFloor,
    };
  }

  function getOperatorTitle(level) {
    if (level >= 8) {
      return "Atlas Warden";
    }
    if (level >= 7) {
      return "Quiet Archivist";
    }
    if (level >= 6) {
      return "Relay Adept";
    }
    if (level >= 5) {
      return "Signal Keeper";
    }
    if (level >= 4) {
      return "Branch Surveyor";
    }
    if (level >= 3) {
      return "Threshold Listener";
    }
    return "Novice Cartographer";
  }

  function findHotspot(hotspotId) {
    return state.content.hotspots.find((hotspot) => hotspot.id === hotspotId) || null;
  }

  function getActiveHotspot() {
    return findHotspot(state.session.activeHotspotId);
  }

  function findLore(loreId) {
    return state.content.lore.find((entry) => entry.id === loreId) || null;
  }

  function getAssignedBranchKey(record) {
    return record?.selectedKey === "B" ? "B" : "A";
  }

  function getObservedBranchKey(record) {
    if (record?.observedKey === "A" || record?.observedKey === "B") {
      return record.observedKey;
    }
    return null;
  }

  function hasObservedBranch(record) {
    return Boolean(getObservedBranchKey(record));
  }

  function getOppositeBranchKey(key) {
    return key === "B" ? "A" : "B";
  }

  function getBranchText(record, key) {
    if (!record) {
      return "";
    }

    if (key === "A") {
      return (
        record.optionA ||
        (getAssignedBranchKey(record) === "A" ? record.selectedText : record.rejectedText) ||
        ""
      );
    }

    return (
      record.optionB ||
      (getAssignedBranchKey(record) === "B" ? record.selectedText : record.rejectedText) ||
      ""
    );
  }

  function getAssignedBranchText(record) {
    return getBranchText(record, getAssignedBranchKey(record));
  }

  function getEffectiveBranchKey(record) {
    return getObservedBranchKey(record) || getAssignedBranchKey(record);
  }

  function getEffectiveBranchText(record) {
    return getBranchText(record, getEffectiveBranchKey(record));
  }

  function getEffectiveOtherBranchText(record) {
    return getBranchText(record, getOppositeBranchKey(getEffectiveBranchKey(record)));
  }

  function syncBranchMetricsFromHistory() {
    let branchA = 0;
    let branchB = 0;

    state.local.history.forEach((record) => {
      if (getEffectiveBranchKey(record) === "B") {
        branchB += 1;
      } else {
        branchA += 1;
      }
    });

    state.local.profile.metrics.splitsCompleted = state.local.history.length;
    state.local.profile.metrics.branchA = branchA;
    state.local.profile.metrics.branchB = branchB;
  }

  function getLatestSplit() {
    return state.local.history[state.local.history.length - 1] || null;
  }

  function formatScreenName(screen) {
    switch (screen) {
      case "bridge":
        return "Bridge";
      case "archive":
        return "Archive";
      case "diagnostics":
        return "Diagnostics";
      case "manual":
        return "Field Manual";
      default:
        return "Bridge";
    }
  }

  function persistLocal(immediate = false) {
    if (localPersistTimer) {
      window.clearTimeout(localPersistTimer);
      localPersistTimer = null;
    }

    if (immediate) {
      LocalStore.save();
      return;
    }

    localPersistTimer = window.setTimeout(() => {
      LocalStore.save();
      localPersistTimer = null;
    }, LOCAL_SAVE_DELAY_MS);
  }

  function persistSession(immediate = false) {
    if (sessionPersistTimer) {
      window.clearTimeout(sessionPersistTimer);
      sessionPersistTimer = null;
    }

    if (immediate) {
      SessionStore.save();
      return;
    }

    sessionPersistTimer = window.setTimeout(() => {
      SessionStore.save();
      sessionPersistTimer = null;
    }, SESSION_SAVE_DELAY_MS);
  }

  function flushPersistedState() {
    if (localPersistTimer) {
      window.clearTimeout(localPersistTimer);
      localPersistTimer = null;
    }

    if (sessionPersistTimer) {
      window.clearTimeout(sessionPersistTimer);
      sessionPersistTimer = null;
    }

    LocalStore.save();
    SessionStore.save();
  }

  function buildRecordId() {
    return `split-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function buildCancellationFailure() {
    return {
      ok: false,
      cancelled: true,
      stage: state.session.splitRun?.currentStage || "valid",
      message: "Sequence cancelled. Chamber cleared by operator.",
      recoverable: true,
    };
  }

  function isValidScreen(screen) {
    return ["bridge", "archive", "diagnostics", "manual"].includes(screen);
  }

  function getAudioEngine() {
    if (!audioEngine) {
      audioEngine = new AudioEngine();
    }
    return audioEngine;
  }

  function parseQuantumInteger(text) {
    const match = String(text || "").match(/-?\d+/);
    return match ? Number.parseInt(match[0], 10) : null;
  }

  function normalizeApiText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}`);
    }
    return response.json();
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return response;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function isLikelyNetworkError(error) {
    if (!error) {
      return false;
    }
    return error.name === "AbortError" || /network|failed|abort|fetch/i.test(String(error.message || ""));
  }

  function scrollTimelineToLatest() {
    const { timelineFrame } = elements;
    timelineFrame.scrollTop = timelineFrame.scrollHeight;
    timelineFrame.scrollLeft = Math.max(0, (timelineFrame.scrollWidth - timelineFrame.clientWidth) / 2);
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Unknown date";
    }
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function formatClock(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "--:--";
    }
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function formatBigInt(value) {
    const stringValue = value.toString();
    if (stringValue.length <= 12) {
      return stringValue;
    }

    const exponent = stringValue.length - 1;
    const mantissa = `${stringValue.slice(0, 3)}.${stringValue.slice(3, 5)}`;
    return `${mantissa}e${exponent}`;
  }

  function truncateLabel(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength - 1)}...`;
  }

  function formatProbability(value, digits = 1) {
    return `${(Math.max(0, Math.min(1, Number(value) || 0)) * 100).toFixed(digits)}%`;
  }

  function formatProportion(value, digits = 3) {
    return Number.isFinite(value) ? Number(value).toFixed(digits) : "Unavailable";
  }

  function formatDecimal(value, digits = 4) {
    return Number.isFinite(value) ? Number(value).toFixed(digits) : "Unavailable";
  }

  function pluralize(count, singular, plural = `${singular}s`) {
    return count === 1 ? singular : plural;
  }

  function sanitizeArray(value, fallback = []) {
    if (!Array.isArray(value)) {
      return fallback.slice();
    }
    return value.filter((entry) => typeof entry === "string");
  }

  function dedupeArray(value) {
    return Array.from(new Set(value));
  }

  function sanitizeObjectMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return Object.keys(value).reduce((map, key) => {
      if (typeof key === "string") {
        const entry = value[key];
        map[key] =
          entry && typeof entry === "object"
            ? { unlockedAt: entry.unlockedAt || new Date().toISOString(), rewardXp: toSafeNumber(entry.rewardXp) }
            : { unlockedAt: new Date().toISOString(), rewardXp: 0 };
      }
      return map;
    }, {});
  }

  function sanitizePercent(value, fallback = 100) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(100, Math.max(0, Math.round(parsed)));
  }

  function toSafeNumber(value) {
    return Number.isFinite(value) ? value : 0;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
