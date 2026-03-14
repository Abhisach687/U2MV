(function () {
  "use strict";

  const STORAGE_KEY = "universe-splitter-v1";
  const STORAGE_VERSION = 1;
  const API_BASE = "https://api.freeuniversesplitter.com";
  const QUERY_TIMEOUT_MS = 5500;
  const STATUS_TIMEOUT_MS = 3200;
  const STAGES = [
    { key: "valid", label: "Input valid", hold: 360 },
    { key: "internet", label: "Internet contacted", hold: 460 },
    { key: "geneva", label: "Geneva online", hold: 420 },
    { key: "ready", label: "Device ready", hold: 340 },
    { key: "photon", label: "Photon emitted", hold: 650 },
    { key: "event", label: "Quantum event", hold: 380 },
  ];

  const stageIndexByKey = STAGES.reduce((index, stage, position) => {
    index[stage.key] = position;
    return index;
  }, {});

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const params = new URLSearchParams(window.location.search);

  const state = {
    activeScreen: "splitter",
    draft: {
      optionA: "",
      optionB: "",
    },
    settings: {
      muted: false,
      flashEnabled: !reducedMotionQuery.matches,
      shakeEnabled: !reducedMotionQuery.matches,
      reducedMotionAware: reducedMotionQuery.matches,
    },
    splits: [],
    diagnostics: {
      lastApiStatus: null,
      lastSuccessfulSource: null,
      lastMessage: "Awaiting mutually exclusive instructions.",
    },
    storageVersion: STORAGE_VERSION,
    splitInProgress: false,
    latestSplitId: null,
    lastFailure: null,
  };

  let currentRun = null;
  let audioEngine = null;
  let modalEscapeHandler = null;

  const elements = {
    appShell: document.getElementById("appShell"),
    flashOverlay: document.getElementById("flashOverlay"),
    liveLamp: document.getElementById("liveLamp"),
    liveStatusText: document.getElementById("liveStatusText"),
    connectionReadout: document.getElementById("connectionReadout"),
    navButtons: Array.from(document.querySelectorAll("[data-screen-target]")),
    panels: Array.from(document.querySelectorAll("[data-screen-panel]")),
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
    shareButton: document.getElementById("shareButton"),
    resetButton: document.getElementById("resetButton"),
    soundToggle: document.getElementById("soundToggle"),
    flashToggle: document.getElementById("flashToggle"),
    shakeToggle: document.getElementById("shakeToggle"),
    timelineFrame: document.getElementById("timelineFrame"),
    timelineSvg: document.getElementById("timelineSvg"),
    branchLog: document.getElementById("branchLog"),
    branchLogTemplate: document.getElementById("branchLogTemplate"),
    splitsCount: document.getElementById("splitsCount"),
    universesCount: document.getElementById("universesCount"),
    branchABias: document.getElementById("branchABias"),
    branchBBias: document.getElementById("branchBBias"),
    biasBarA: document.getElementById("biasBarA"),
    biasBarB: document.getElementById("biasBarB"),
    statsNotes: document.getElementById("statsNotes"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modalEyebrow: document.getElementById("modalEyebrow"),
    modalTitle: document.getElementById("modalTitle"),
    modalMessage: document.getElementById("modalMessage"),
    modalActions: document.getElementById("modalActions"),
  };

  const HistoryStore = {
    load() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return null;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
          return null;
        }
        return parsed;
      } catch (error) {
        return null;
      }
    },

    save() {
      const payload = {
        activeScreen: state.activeScreen,
        draft: state.draft,
        settings: state.settings,
        splits: state.splits,
        diagnostics: state.diagnostics,
        storageVersion: STORAGE_VERSION,
        latestSplitId: state.latestSplitId,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    },

    reset() {
      window.localStorage.removeItem(STORAGE_KEY);
    },
  };

  class AudioEngine {
    constructor() {
      this.context = null;
    }

    getContext() {
      if (state.settings.muted) {
        return null;
      }

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

    pulse({ frequency, duration, type = "sine", gain = 0.05, detune = 0 }) {
      const context = this.getContext();
      if (!context) {
        return;
      }

      const oscillator = context.createOscillator();
      const amp = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;
      amp.gain.value = 0.0001;
      oscillator.connect(amp);
      amp.connect(context.destination);
      const now = context.currentTime;
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.03);
    }

    activationBeep() {
      this.pulse({ frequency: 420, duration: 0.16, type: "square", gain: 0.05 });
      window.setTimeout(() => {
        this.pulse({ frequency: 560, duration: 0.18, type: "square", gain: 0.04 });
      }, 70);
    }

    machineHum() {
      this.pulse({ frequency: 120, duration: 0.95, type: "sawtooth", gain: 0.025 });
      window.setTimeout(() => {
        this.pulse({ frequency: 180, duration: 0.75, type: "triangle", gain: 0.022, detune: 4 });
      }, 200);
    }

    releaseBurst() {
      this.pulse({ frequency: 880, duration: 0.14, type: "square", gain: 0.045 });
      this.pulse({ frequency: 180, duration: 0.4, type: "triangle", gain: 0.035 });
      window.setTimeout(() => {
        this.pulse({ frequency: 1240, duration: 0.18, type: "square", gain: 0.025 });
      }, 30);
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
      const summary = normalizeApiText(text) || "Geneva relay acknowledged.";
      return {
        summary,
        sourceDevice: "geneva",
        transport: "live",
      };
    },

    async getBit() {
      if (this.devStub) {
        const bit = Math.random() > 0.5 ? 1 : 0;
        return {
          bit,
          sourceDevice: "geneva",
          transport: "live",
          rawNumber: bit,
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
        return {
          stage: validation.stage,
          message: validation.message,
          recoverable: true,
        };
      }

      currentRun = { cancelled: false };
      state.splitInProgress = true;
      state.lastFailure = null;
      updateControls();
      setValidationMessage("Input validated. Prepare for bifurcation.", "warning");
      clearStageClasses();
      clearDiagnostics();
      logDiagnostic("Input chamber sealed.");
      updateLiveStatus("Sequence armed", true);

      try {
        activateStage("valid");
        logDiagnostic("Input valid.");
        getAudioEngine().activationBeep();
        await waitForStage("valid");

        if (currentRun.cancelled) {
          return buildCancellationFailure();
        }

        if (!navigator.onLine) {
          return {
            stage: "internet",
            message: "The machine cannot contact the network. Restore internet access and try again.",
            recoverable: true,
          };
        }

        activateStage("internet");
        logDiagnostic("Internet contacted.");
        updateLiveStatus("Contacting Geneva relay", true);
        await waitForStage("internet");

        if (currentRun.cancelled) {
          return buildCancellationFailure();
        }

        let statusMeta = null;
        try {
          statusMeta = await QuantumSource.getStatus();
          state.diagnostics.lastApiStatus = statusMeta.summary;
          logDiagnostic(statusMeta.summary);
        } catch (error) {
          logDiagnostic("Status relay uncertain. Attempting direct device line.");
        }

        activateStage("geneva");
        logDiagnostic("Geneva online.");
        updateLiveStatus("Geneva device online", true);
        await waitForStage("geneva");

        if (currentRun.cancelled) {
          return buildCancellationFailure();
        }

        activateStage("ready");
        logDiagnostic("Device ready.");
        updateLiveStatus("Device ready", true);
        await waitForStage("ready");

        if (currentRun.cancelled) {
          return buildCancellationFailure();
        }

        let quantumResult;
        try {
          quantumResult = await QuantumSource.getBit();
        } catch (error) {
          const networkFailure = isLikelyNetworkError(error);
          return {
            stage: statusMeta ? "photon" : "geneva",
            message: networkFailure
              ? "Contact with Geneva failed before the photon could be registered."
              : "Geneva responded, but no usable quantum event was returned.",
            recoverable: true,
          };
        }

        activateStage("photon");
        logDiagnostic("Photon emitted.");
        getAudioEngine().machineHum();
        updateLiveStatus("Photon emission underway", true);
        await waitForStage("photon");

        if (currentRun.cancelled) {
          return buildCancellationFailure();
        }

        activateStage("event");
        logDiagnostic("Quantum event.");
        state.diagnostics.lastSuccessfulSource = `${quantumResult.sourceDevice} (${quantumResult.transport})`;
        updateLiveStatus("Branch resolved", true);
        triggerEffects();
        getAudioEngine().releaseBurst();
        await waitForStage("event");
        completeAllStages();

        const selectedKey = quantumResult.bit === 0 ? "A" : "B";
        const selectedText = selectedKey === "A" ? optionA.trim() : optionB.trim();
        const rejectedText = selectedKey === "A" ? optionB.trim() : optionA.trim();

        return {
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
        };
      } finally {
        state.splitInProgress = false;
        currentRun = null;
        updateControls();
      }
    },
  };

  function init() {
    hydrateState();
    bindEvents();
    render();
  }

  function hydrateState() {
    const stored = HistoryStore.load();
    if (stored) {
      state.activeScreen = isValidScreen(stored.activeScreen) ? stored.activeScreen : "splitter";
      state.draft = {
        optionA: typeof stored.draft?.optionA === "string" ? stored.draft.optionA : "",
        optionB: typeof stored.draft?.optionB === "string" ? stored.draft.optionB : "",
      };
      state.settings = {
        muted: Boolean(stored.settings?.muted),
        flashEnabled:
          typeof stored.settings?.flashEnabled === "boolean"
            ? stored.settings.flashEnabled
            : !state.settings.reducedMotionAware,
        shakeEnabled:
          typeof stored.settings?.shakeEnabled === "boolean"
            ? stored.settings.shakeEnabled
            : !state.settings.reducedMotionAware,
        reducedMotionAware: state.settings.reducedMotionAware,
      };
      state.splits = Array.isArray(stored.splits) ? stored.splits : [];
      state.diagnostics = {
        lastApiStatus: stored.diagnostics?.lastApiStatus || null,
        lastSuccessfulSource: stored.diagnostics?.lastSuccessfulSource || null,
        lastMessage: stored.diagnostics?.lastMessage || state.diagnostics.lastMessage,
      };
      state.latestSplitId = stored.latestSplitId || (state.splits.length ? state.splits[state.splits.length - 1].id : null);
    }

    elements.optionA.value = state.draft.optionA;
    elements.optionB.value = state.draft.optionB;
    elements.soundToggle.checked = !state.settings.muted;
    elements.flashToggle.checked = state.settings.flashEnabled;
    elements.shakeToggle.checked = state.settings.shakeEnabled;
  }

  function bindEvents() {
    elements.navButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setActiveScreen(button.dataset.screenTarget);
      });
    });

    elements.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleSplitRequest();
    });

    elements.nevermindButton.addEventListener("click", handleNevermind);
    elements.shareButton.addEventListener("click", handleShare);
    elements.resetButton.addEventListener("click", promptReset);

    elements.optionA.addEventListener("input", handleDraftInput);
    elements.optionB.addEventListener("input", handleDraftInput);
    elements.soundToggle.addEventListener("change", () => {
      state.settings.muted = !elements.soundToggle.checked;
      persist();
      updateControls();
    });
    elements.flashToggle.addEventListener("change", () => {
      state.settings.flashEnabled = elements.flashToggle.checked;
      persist();
    });
    elements.shakeToggle.addEventListener("change", () => {
      state.settings.shakeEnabled = elements.shakeToggle.checked;
      persist();
    });

    reducedMotionQuery.addEventListener("change", (event) => {
      state.settings.reducedMotionAware = event.matches;
      if (event.matches) {
        state.settings.flashEnabled = false;
        state.settings.shakeEnabled = false;
        elements.flashToggle.checked = false;
        elements.shakeToggle.checked = false;
      }
      persist();
    });
  }

  async function handleSplitRequest() {
    closeModal();
    const optionA = elements.optionA.value;
    const optionB = elements.optionB.value;
    const outcome = await SplitEngine.run(optionA, optionB);

    if (outcome.selectedText) {
      state.splits.push(outcome);
      state.latestSplitId = outcome.id;
      state.lastFailure = null;
      state.diagnostics.lastMessage = `Branch resolved in ${outcome.sourceDevice}.`;
      setResultCopy(outcome);
      setValidationMessage("Split complete. You now know your branch.", "warning");
      persist();
      renderTimeline();
      renderStats();
      setActiveScreen("splitter");
      logDiagnostic(`Recorded split ${state.splits.length}.`);
      return;
    }

    state.lastFailure = outcome;
    state.diagnostics.lastMessage = outcome.message;
    setValidationMessage(outcome.message, outcome.stage === "validation" ? "danger" : "warning");
    applyFailureStage(outcome.stage);
    updateLiveStatus("Sequence interrupted", false);

    if (outcome.stage === "cancelled") {
      logDiagnostic("Sequence cancelled by operator.");
      return;
    }

    logDiagnostic(outcome.message);
    showFailureModal(outcome);
    persist();
  }

  function handleNevermind() {
    if (state.splitInProgress && currentRun) {
      currentRun.cancelled = true;
      state.lastFailure = buildCancellationFailure();
      updateLiveStatus("Sequence cancelled", false);
      setValidationMessage("Split attempt abandoned. No new universe recorded.", "warning");
      return;
    }

    state.draft.optionA = "";
    state.draft.optionB = "";
    elements.optionA.value = "";
    elements.optionB.value = "";
    setValidationMessage("Input chamber cleared. Awaiting mutually exclusive instructions.", "");
    const latestSplit = getLatestSplit();
    if (latestSplit) {
      setResultCopy(latestSplit);
    } else {
      elements.resultPrimary.textContent = "Your universe is stable. No split has been recorded yet.";
      elements.resultSecondary.textContent =
        "When you initiate a bifurcation, this panel will report your branch.";
    }
    clearStageClasses();
    clearDiagnostics();
    elements.connectionReadout.textContent = "Awaiting mutually exclusive instructions.";
    updateLiveStatus("Standby", false);
    persist();
  }

  async function handleShare() {
    const latestSplit = getLatestSplit();
    if (!latestSplit) {
      setValidationMessage("A completed split is required before it can be announced.", "warning");
      return;
    }

    const shareText = `Your universe has just split. You're in the universe in which you should ${latestSplit.selectedText}. And right now in the other universe, the other you is being told to ${latestSplit.rejectedText}.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Universe Splitter",
          text: shareText,
        });
        setValidationMessage("Branch report shared.", "warning");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setValidationMessage("Branch report copied to clipboard.", "warning");
        return;
      }

      throw new Error("No share surface available.");
    } catch (error) {
      setValidationMessage("This terminal cannot share the branch report right now.", "danger");
    }
  }

  function promptReset() {
    if (!state.splits.length) {
      setValidationMessage("There are no recorded splits to reset.", "warning");
      return;
    }

    showModal({
      eyebrow: "Reset Warning",
      title: "Erase Recorded Splits?",
      message:
        "This will clear the chart, statistics, and saved branch history from local storage on this terminal.",
      actions: [
        {
          label: "Reset",
          variant: "danger",
          onClick: () => {
            resetState();
            closeModal();
          },
        },
        {
          label: "Nevermind",
          onClick: closeModal,
        },
      ],
    });
  }

  function handleDraftInput() {
    state.draft.optionA = elements.optionA.value;
    state.draft.optionB = elements.optionB.value;
    persist();
  }

  function resetState() {
    state.splits = [];
    state.latestSplitId = null;
    state.diagnostics.lastApiStatus = null;
    state.diagnostics.lastSuccessfulSource = null;
    state.diagnostics.lastMessage = "Machine reset. Awaiting mutually exclusive instructions.";
    clearStageClasses();
    clearDiagnostics();
    elements.connectionReadout.textContent = state.diagnostics.lastMessage;
    updateLiveStatus("Standby", false);
    elements.resultPrimary.textContent = "Your universe is stable. No split has been recorded yet.";
    elements.resultSecondary.textContent =
      "When you initiate a bifurcation, this panel will report your branch.";
    setValidationMessage("Recorded universes erased from this terminal.", "warning");
    HistoryStore.reset();
    persist();
    renderTimeline();
    renderStats();
  }

  function render() {
    setActiveScreen(state.activeScreen, { persist: false });
    renderTimeline();
    renderStats();
    renderLatestResult();
    updateControls();
    updateLiveStatus(
      state.diagnostics.lastSuccessfulSource ? "Ready" : "Standby",
      Boolean(state.diagnostics.lastSuccessfulSource)
    );
    elements.connectionReadout.textContent = state.diagnostics.lastApiStatus || state.diagnostics.lastMessage;
  }

  function renderLatestResult() {
    const latestSplit = getLatestSplit();
    if (latestSplit) {
      setResultCopy(latestSplit);
    }
  }

  function setResultCopy(split) {
    elements.resultPrimary.textContent = `Your universe has just split. You're in the universe in which you should ${split.selectedText}.`;
    elements.resultSecondary.textContent = `And right now in the other universe, the other you is being told to ${split.rejectedText}.`;
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

  function setActiveScreen(screen, options = { persist: true }) {
    if (!isValidScreen(screen)) {
      return;
    }

    state.activeScreen = screen;
    elements.navButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.screenTarget === screen);
    });
    elements.panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.screenPanel === screen);
    });

    if (screen === "chart") {
      window.setTimeout(scrollTimelineToLatest, 30);
    }

    if (options.persist) {
      persist();
    }
  }

  function updateControls() {
    elements.splitButton.disabled = state.splitInProgress;
    elements.optionA.disabled = state.splitInProgress;
    elements.optionB.disabled = state.splitInProgress;
    elements.shareButton.disabled = !state.splits.length;
    elements.soundToggle.checked = !state.settings.muted;
    elements.flashToggle.checked = state.settings.flashEnabled;
    elements.shakeToggle.checked = state.settings.shakeEnabled;
  }

  function updateLiveStatus(label, live) {
    elements.liveStatusText.textContent = label;
    elements.liveLamp.classList.toggle("is-live", live);
  }

  function clearStageClasses() {
    elements.stageItems.forEach((item) => {
      item.classList.remove("is-active", "is-complete", "is-failed");
    });
  }

  function activateStage(stageKey) {
    const targetIndex = stageIndexByKey[stageKey];
    elements.stageItems.forEach((item, index) => {
      item.classList.toggle("is-complete", index < targetIndex);
      item.classList.toggle("is-active", item.dataset.stageKey === stageKey);
      item.classList.remove("is-failed");
    });
  }

  function completeAllStages() {
    elements.stageItems.forEach((item) => {
      item.classList.remove("is-active", "is-failed");
      item.classList.add("is-complete");
    });
  }

  function applyFailureStage(stageKey) {
    if (!Object.prototype.hasOwnProperty.call(stageIndexByKey, stageKey)) {
      return;
    }

    const targetIndex = stageIndexByKey[stageKey];
    elements.stageItems.forEach((item, index) => {
      item.classList.toggle("is-complete", index < targetIndex);
      item.classList.remove("is-active");
      item.classList.toggle("is-failed", index === targetIndex);
    });
  }

  function clearDiagnostics() {
    elements.diagnosticsConsole.innerHTML = '<p class="diagnostics-console__line">Diagnostics idle.</p>';
  }

  function logDiagnostic(message) {
    state.diagnostics.lastMessage = message;
    elements.connectionReadout.textContent = message;
    const line = document.createElement("p");
    line.className = "diagnostics-console__line";
    line.textContent = `[${formatClock(new Date())}] ${message}`;
    elements.diagnosticsConsole.appendChild(line);
    elements.diagnosticsConsole.scrollTop = elements.diagnosticsConsole.scrollHeight;
  }

  function renderTimeline() {
    const splits = state.splits;
    elements.branchLog.innerHTML = "";

    if (!splits.length) {
      elements.timelineSvg.setAttribute("viewBox", "0 0 560 320");
      elements.timelineSvg.innerHTML =
        '<text x="280" y="150" text-anchor="middle" class="timeline-label">No successful splits recorded yet.</text>' +
        '<text x="280" y="176" text-anchor="middle" class="timeline-label timeline-label--muted">The first bifurcation will establish the trunk.</text>';
      elements.branchLog.innerHTML =
        '<article class="branch-log__entry"><p class="branch-log__timestamp">Standby</p><p class="branch-log__selected">No branches recorded.</p><p class="branch-log__rejected">Initiate a split from the main screen.</p></article>';
      return;
    }

    const width = 560;
    const rowGap = 92;
    const height = Math.max(320, 90 + splits.length * rowGap);
    const trunkX = 280;
    elements.timelineSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const lines = [];
    lines.push(`<line x1="${trunkX}" y1="40" x2="${trunkX}" y2="${height - 40}" class="timeline-trunk"></line>`);

    splits.forEach((split, index) => {
      const y = 60 + index * rowGap;
      const side = split.selectedKey === "A" ? -1 : 1;
      const branchX = trunkX + side * 142;
      const rejectX = trunkX - side * 142;
      const selectedAnchor = branchX + side * 10;
      const rejectedAnchor = rejectX - side * 10;

      lines.push(
        `<path d="M ${trunkX} ${y} C ${trunkX + side * 42} ${y}, ${branchX - side * 30} ${y - 8}, ${branchX} ${y - 8}" class="timeline-branch timeline-branch--selected"></path>`
      );
      lines.push(
        `<path d="M ${trunkX} ${y} C ${trunkX - side * 42} ${y}, ${rejectX + side * 30} ${y + 16}, ${rejectX} ${y + 16}" class="timeline-branch timeline-branch--rejected"></path>`
      );
      lines.push(`<circle cx="${trunkX}" cy="${y}" r="10" class="timeline-node timeline-node--selected"></circle>`);
      lines.push(`<circle cx="${branchX}" cy="${y - 8}" r="12" class="timeline-node timeline-node--selected"></circle>`);
      lines.push(`<circle cx="${rejectX}" cy="${y + 16}" r="10" class="timeline-node timeline-node--rejected"></circle>`);
      lines.push(
        `<text x="${selectedAnchor}" y="${y - 14}" text-anchor="${side === -1 ? "end" : "start"}" class="timeline-label">${escapeHtml(truncateLabel(split.selectedText, 22))}</text>`
      );
      lines.push(
        `<text x="${rejectedAnchor}" y="${y + 36}" text-anchor="${side === -1 ? "start" : "end"}" class="timeline-label timeline-label--muted">${escapeHtml(truncateLabel(split.rejectedText, 18))}</text>`
      );
    });

    elements.timelineSvg.innerHTML = lines.join("");

    const fragment = document.createDocumentFragment();
    splits
      .slice()
      .reverse()
      .forEach((split) => {
        const node = elements.branchLogTemplate.content.firstElementChild.cloneNode(true);
        node.querySelector(".branch-log__timestamp").textContent = formatDateTime(split.createdAt);
        node.querySelector(".branch-log__selected").textContent = `You were told to ${split.selectedText}.`;
        node.querySelector(".branch-log__rejected").textContent = `The other you was told to ${split.rejectedText}.`;
        fragment.appendChild(node);
      });
    elements.branchLog.appendChild(fragment);
    scrollTimelineToLatest();
  }

  function renderStats() {
    const splits = state.splits.length;
    const branchACount = state.splits.filter((split) => split.selectedKey === "A").length;
    const branchBCount = splits - branchACount;
    const universes = 2n ** BigInt(splits);
    const ratioA = splits ? Math.round((branchACount / splits) * 100) : 0;
    const ratioB = splits ? 100 - ratioA : 0;
    const firstSplit = state.splits[0];
    const lastSplit = getLatestSplit();

    elements.splitsCount.textContent = String(splits);
    elements.universesCount.textContent = formatBigInt(universes);
    elements.branchABias.textContent = `${ratioA}%`;
    elements.branchBBias.textContent = `${ratioB}%`;
    elements.biasBarA.style.width = `${ratioA}%`;
    elements.biasBarB.style.width = `${ratioB}%`;

    elements.statsNotes.innerHTML = `
      <div>
        <dt>First split</dt>
        <dd>${firstSplit ? formatDateTime(firstSplit.createdAt) : "None recorded"}</dd>
      </div>
      <div>
        <dt>Last split</dt>
        <dd>${lastSplit ? formatDateTime(lastSplit.createdAt) : "None recorded"}</dd>
      </div>
      <div>
        <dt>Last source</dt>
        <dd>${state.diagnostics.lastSuccessfulSource || "Awaiting contact"}</dd>
      </div>
      <div>
        <dt>Diagnostics</dt>
        <dd>${escapeHtml(state.diagnostics.lastApiStatus || state.diagnostics.lastMessage || "Machine in standby.")}</dd>
      </div>
    `;
  }

  function showFailureModal(failure) {
    const title = failure.stage === "validation" ? "Input Rejected" : "Split Interrupted";
    showModal({
      eyebrow: failure.stage === "validation" ? "Input Chamber" : "Geneva Relay",
      title,
      message: failure.message,
      actions: [
        {
          label: "Try Again",
          onClick: () => {
            closeModal();
            elements.optionA.focus();
          },
        },
        {
          label: "Nevermind",
          onClick: closeModal,
        },
      ],
    });
  }

  function showModal(config) {
    elements.modalEyebrow.textContent = config.eyebrow;
    elements.modalTitle.textContent = config.title;
    elements.modalMessage.textContent = config.message;
    elements.modalActions.innerHTML = "";
    config.actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      if (action.variant) {
        button.dataset.variant = action.variant;
      }
      button.addEventListener("click", action.onClick);
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

    const firstButton = elements.modalActions.querySelector("button");
    if (firstButton) {
      firstButton.focus();
    }
  }

  function closeModal() {
    elements.modalBackdrop.classList.add("is-hidden");
    elements.modalBackdrop.setAttribute("aria-hidden", "true");
    elements.modalActions.innerHTML = "";
    if (modalEscapeHandler) {
      document.removeEventListener("keydown", modalEscapeHandler);
      modalEscapeHandler = null;
    }
  }

  function triggerEffects() {
    if (state.settings.flashEnabled && !state.settings.reducedMotionAware) {
      elements.flashOverlay.classList.remove("is-active");
      void elements.flashOverlay.offsetWidth;
      elements.flashOverlay.classList.add("is-active");
    }

    if (state.settings.shakeEnabled && !state.settings.reducedMotionAware) {
      elements.appShell.classList.remove("is-shaking");
      void elements.appShell.offsetWidth;
      elements.appShell.classList.add("is-shaking");
      window.setTimeout(() => elements.appShell.classList.remove("is-shaking"), 450);
    }
  }

  function waitForStage(stageKey) {
    const stage = STAGES.find((entry) => entry.key === stageKey);
    const duration = state.settings.reducedMotionAware ? 120 : stage.hold;
    return delay(duration);
  }

  function validateOptions(optionA, optionB) {
    const trimmedA = optionA.trim();
    const trimmedB = optionB.trim();

    if (!trimmedA || !trimmedB) {
      return {
        ok: false,
        stage: "validation",
        message: "Two actions are required before the universe can be split.",
      };
    }

    if (trimmedA.length < 3 || trimmedB.length < 3) {
      return {
        ok: false,
        stage: "validation",
        message: "Each instruction must be specific enough to create a meaningful branch.",
      };
    }

    const normalizedA = normalizeDecision(trimmedA);
    const normalizedB = normalizeDecision(trimmedB);
    const similarity = diceCoefficient(normalizedA, normalizedB);
    if (normalizedA === normalizedB || similarity >= 0.88) {
      return {
        ok: false,
        stage: "validation",
        message: "The machine requires two distinct actions, not near-identical variations.",
      };
    }

    return { ok: true };
  }

  function normalizeDecision(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function diceCoefficient(a, b) {
    if (a.length < 2 || b.length < 2) {
      return a === b ? 1 : 0;
    }

    const bigrams = new Map();
    for (let index = 0; index < a.length - 1; index += 1) {
      const gram = a.slice(index, index + 2);
      bigrams.set(gram, (bigrams.get(gram) || 0) + 1);
    }

    let overlap = 0;
    for (let index = 0; index < b.length - 1; index += 1) {
      const gram = b.slice(index, index + 2);
      const count = bigrams.get(gram) || 0;
      if (count > 0) {
        bigrams.set(gram, count - 1);
        overlap += 1;
      }
    }

    return (2 * overlap) / (a.length + b.length - 2);
  }

  function getLatestSplit() {
    return state.splits.length ? state.splits[state.splits.length - 1] : null;
  }

  function persist() {
    HistoryStore.save();
  }

  function formatBigInt(value) {
    const text = value.toString();
    if (text.length <= 15) {
      return text;
    }
    const exponent = text.length - 1;
    const mantissa = `${text[0]}.${text.slice(1, 4)}`;
    return `${mantissa} x 10^${exponent}`;
  }

  function formatDateTime(value) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function formatClock(date) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  function truncateLabel(text, length) {
    return text.length <= length ? text : `${text.slice(0, Math.max(0, length - 1))}...`;
  }

  function parseQuantumInteger(rawText) {
    const cleaned = normalizeApiText(rawText);
    if (!cleaned) {
      return null;
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed === "number" && Number.isFinite(parsed)) {
        return parsed;
      }
      if (parsed && typeof parsed === "object") {
        const candidateKeys = ["randomNumber", "rndnum", "number", "result", "value", "random"];
        for (const key of candidateKeys) {
          if (typeof parsed[key] === "number" && Number.isFinite(parsed[key])) {
            return parsed[key];
          }
          if (typeof parsed[key] === "string") {
            const innerMatch = parsed[key].match(/-?\d+/);
            if (innerMatch) {
              return Number(innerMatch[0]);
            }
          }
        }
      }
    } catch (error) {
      const match = cleaned.match(/-?\d+/);
      if (match) {
        return Number(match[0]);
      }
    }

    return null;
  }

  function normalizeApiText(text) {
    return String(text || "").trim();
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.code = "HTTP_ERROR";
        throw error;
      }
      return response;
    } catch (error) {
      if (error.name === "AbortError") {
        error.code = "TIMEOUT";
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function isLikelyNetworkError(error) {
    return (
      error.code === "TIMEOUT" ||
      error.code === "HTTP_ERROR" ||
      error.name === "TypeError" ||
      String(error.message || "").includes("Failed to fetch")
    );
  }

  function scrollTimelineToLatest() {
    if (!state.splits.length) {
      return;
    }
    elements.timelineFrame.scrollTop = elements.timelineFrame.scrollHeight;
    elements.branchLog.scrollTop = 0;
  }

  function buildRecordId() {
    return `split-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function buildCancellationFailure() {
    return {
      stage: "cancelled",
      message: "Split attempt abandoned. No new branch has been recorded.",
      recoverable: true,
    };
  }

  function isValidScreen(screen) {
    return ["splitter", "chart", "stats", "manual"].includes(screen);
  }

  function getAudioEngine() {
    if (!audioEngine) {
      audioEngine = new AudioEngine();
    }
    return audioEngine;
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  init();
})();
