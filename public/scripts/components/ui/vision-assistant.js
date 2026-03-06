/* ============================================================
   vision-assistant  -  A-Frame component (entity-level)
   Voice + screenshot capture, sends to backend VLM (Ollama)
   ============================================================

   Usage (attach to any entity — position/rotate freely):
     <a-entity
       vision-assistant="
         backendUrl: /api/vision;
         screenshotMaxWidth: 384;
         defaultPrompt: Describe what you see;
         keyboardKey: Space;
         tts: true
       "
       position="0 2 -4"
       rotation="0 90 0"
     >

   The component builds its panel UI as children of the host
   entity, so you control placement via the entity's transform.
   ============================================================ */

AFRAME.registerComponent("vision-assistant", {
  schema: {
    backendUrl: { type: "string", default: "/api/vision" },
    screenshotMaxWidth: { type: "int", default: 384 },
    recordTimeout: { type: "int", default: 20000 },
    lang: { type: "string", default: "en-US" },
    defaultPrompt: {
      type: "string",
      default: "Analyze this scene. What type of fire is this? Which extinguisher should I use?",
    },
    buttonIndices: { type: "array", default: [0, 1, 4, 5] },
    keyboardKey: { type: "string", default: "Space" },
    tts: { type: "boolean", default: true },
    // Responsive panel sizing
    panelMinWidth: { type: "number", default: 2.0 },
    panelMaxWidth: { type: "number", default: 4.5 },
    panelMinHeight: { type: "number", default: 0.6 },
    panelMaxHeight: { type: "number", default: 3.5 },
    padding: { type: "number", default: 0.15 },
    wrapCount: { type: "int", default: 55 },
  },

  init() {
    this.responseEl = null;
    this.statusEl = null;
    this.busy = false;
    this.recording = false;
    this._recognition = null;
    this._recordTimer = null;
    this._transcript = "";
    this._lastButtonState = {};

    this._buildPanel();

    this.el.sceneEl.addEventListener("loaded", () => {
      console.log("[vision-assistant] Component initialized");
      this._initSpeechRecognition();
      this._initInputs();
    });
  },

  remove() {
    clearInterval(this._pollInterval);
    clearTimeout(this._recordTimer);
    if (this._recognition) {
      try {
        this._recognition.stop();
      } catch (_) {}
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  },

  /* ────────────────── UI Panel ────────────────── */

  _buildPanel() {
    const d = this.data;

    // Background
    this._bgPlane = document.createElement("a-plane");
    this._bgPlane.setAttribute("color", "#0a0a0a");
    this._bgPlane.setAttribute("opacity", "0.92");
    this._bgPlane.setAttribute("material", "shader: flat; side: double");

    // Accent line (top edge)
    this._accentLine = document.createElement("a-plane");
    this._accentLine.setAttribute("color", "#00e5ff");
    this._accentLine.setAttribute("material", "shader: flat");
    this._accentLine.setAttribute("height", "0.03");

    // Title
    this._titleText = document.createElement("a-text");
    this._titleText.setAttribute("value", "AI Assistant");
    this._titleText.setAttribute("align", "left");
    this._titleText.setAttribute("color", "#00e5ff");
    this._titleText.setAttribute("width", "2.5");

    // Status
    this.statusEl = document.createElement("a-text");
    this.statusEl.setAttribute("value", "Ready");
    this.statusEl.setAttribute("align", "right");
    this.statusEl.setAttribute("color", "#888888");
    this.statusEl.setAttribute("width", "1.8");

    // Response text
    const initialText = `Press [${d.keyboardKey}] or controller button to speak.`;
    this.responseEl = document.createElement("a-text");
    this.responseEl.setAttribute("value", initialText);
    this.responseEl.setAttribute("align", "left");
    this.responseEl.setAttribute("anchor", "left");
    this.responseEl.setAttribute("baseline", "top");
    this.responseEl.setAttribute("color", "#e0e0e0");
    this.responseEl.setAttribute("wrap-count", String(d.wrapCount));

    // Append children
    this.el.appendChild(this._bgPlane);
    this.el.appendChild(this._accentLine);
    this.el.appendChild(this._titleText);
    this.el.appendChild(this.statusEl);
    this.el.appendChild(this.responseEl);

    // Initial layout
    this._resizePanel(initialText);
    console.log("[vision-assistant] Panel built on entity");
  },

  /* ────────── Responsive resize ────────── */

  _resizePanel(text) {
    const d = this.data;
    const pad = d.padding;
    const headerH = 0.22;
    const accentH = 0.03;

    // Character metrics based on max text area
    const maxTextW = d.panelMaxWidth - 2 * pad;
    const charW = maxTextW / d.wrapCount;

    // --- Width: shrink for short text, expand up to max ---
    const textLines = text.split("\n");
    const longestLine = textLines.reduce((m, l) => Math.max(m, l.length), 0);
    const panelWidth =
      longestLine >= d.wrapCount
        ? d.panelMaxWidth
        : Math.max(d.panelMinWidth, Math.min(d.panelMaxWidth, longestLine * charW + 2 * pad));

    // --- Height: compute from wrapped line count ---
    const actualTextW = panelWidth - 2 * pad;
    const charsPerLine = Math.max(10, Math.floor(actualTextW / charW));

    let totalLines = 0;
    for (const line of textLines) {
      totalLines += Math.max(1, Math.ceil((line.length || 1) / charsPerLine));
    }

    const lineH = charW * 1.35;
    const contentH = totalLines * lineH;
    const panelHeight = Math.max(
      d.panelMinHeight,
      headerH + accentH + contentH + 2 * pad,
    );

    // --- Position child elements ---
    const halfW = panelWidth / 2;
    const halfH = panelHeight / 2;

    this._bgPlane.setAttribute("width", panelWidth);
    this._bgPlane.setAttribute("height", panelHeight);

    this._accentLine.setAttribute("width", panelWidth);
    this._accentLine.setAttribute("position", `0 ${(halfH - accentH / 2).toFixed(4)} 0.001`);

    const titleY = halfH - accentH - pad - 0.05;
    this._titleText.setAttribute(
      "position",
      `${(-halfW + pad).toFixed(4)} ${titleY.toFixed(4)} 0.01`,
    );
    this.statusEl.setAttribute("position", `${(halfW - pad).toFixed(4)} ${titleY.toFixed(4)} 0.01`);

    const responseY = titleY - headerH + 0.05;
    this.responseEl.setAttribute(
      "position",
      `${(-halfW + pad).toFixed(4)} ${responseY.toFixed(4)} 0.01`,
    );
    this.responseEl.setAttribute("width", actualTextW.toFixed(2));
    this.responseEl.setAttribute("wrap-count", String(charsPerLine));
  },

  /* ────────────────── Input binding ────────────────── */

  _initInputs() {
    const d = this.data;

    // Gamepad
    window.addEventListener("gamepadconnected", (e) => {
      console.log("[vision-assistant] Gamepad connected:", e.gamepad.id);
    });

    const btnIndices = d.buttonIndices.map(Number);

    this._pollInterval = setInterval(() => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gamepads) {
        if (!gp) continue;
        for (const idx of btnIndices) {
          const btn = gp.buttons[idx];
          if (!btn) continue;
          const key = `${gp.index}-${idx}`;
          if (btn.pressed && !this._lastButtonState[key]) {
            console.log(`[vision-assistant] Button ${idx} pressed (gamepad ${gp.index})`);
            this.toggleRecording();
          }
          this._lastButtonState[key] = btn.pressed;
        }
      }
    }, 100);

    // Keyboard
    window.addEventListener("keydown", (e) => {
      if (e.code === d.keyboardKey && !e.repeat) {
        e.preventDefault();
        this.toggleRecording();
      }
    });
  },

  /* ────────────────── Speech Recognition ────────────────── */

  _initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[vision-assistant] Web Speech API not supported");
      this.setResponse("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.data.lang;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          final += r[0].transcript + " ";
        } else {
          interim += r[0].transcript;
        }
      }
      this._transcript = (final + interim).trim();
      console.log("[vision-assistant] Transcript:", this._transcript);
      this.setResponse(`Recording: "${this._transcript}"`);
    };

    recognition.onerror = (event) => {
      console.error("[vision-assistant] Speech error:", event.error);
      if (event.error !== "no-speech") {
        this.setStatus("Mic error");
      }
    };

    recognition.onend = () => {
      console.log("[vision-assistant] Recognition ended");
      if (this.recording) this._finishRecording();
    };

    this._recognition = recognition;
    console.log("[vision-assistant] Speech recognition ready");
  },

  /* ────────────────── Recording toggle ────────────────── */

  toggleRecording() {
    if (this.busy) {
      console.log("[vision-assistant] Busy - ignoring toggle");
      return;
    }
    if (this.recording) {
      console.log("[vision-assistant] Stopping recording (button)");
      this._stopRecording();
    } else {
      console.log("[vision-assistant] Starting recording");
      this._startRecording();
    }
  },

  _startRecording() {
    if (!this._recognition) {
      this.captureAndAsk(this.data.defaultPrompt);
      return;
    }

    this.recording = true;
    this._transcript = "";
    this.setStatus("Listening...");
    this.setResponse("Speak now. Press again to stop.");

    try {
      this._recognition.start();
      console.log("[vision-assistant] Recognition started");
    } catch (e) {
      console.warn("[vision-assistant] Recognition start error:", e.message);
    }

    this._recordTimer = setTimeout(() => {
      console.log("[vision-assistant] Timeout reached, stopping");
      this._stopRecording();
    }, this.data.recordTimeout);
  },

  _stopRecording() {
    this.recording = false;
    clearTimeout(this._recordTimer);
    this._recordTimer = null;
    try {
      this._recognition.stop();
    } catch (_) {}
    this._finishRecording();
  },

  _finishRecording() {
    if (this.busy) return;
    const prompt = this._transcript.trim() || this.data.defaultPrompt;
    console.log("[vision-assistant] Final prompt:", prompt);
    this.captureAndAsk(prompt);
  },

  /* ────────────────── Capture + send ────────────────── */

  async captureAndAsk(userPrompt) {
    if (this.busy) {
      console.log("[vision-assistant] Request ignored - already running");
      return;
    }
    this.busy = true;
    this.setStatus("Capturing...");
    this.setResponse("Analyzing image...");
    console.log("\n===== [vision-assistant] captureAndAsk =====");
    console.log("[vision-assistant] prompt:", userPrompt);

    try {
      console.time("[vision-assistant] screenshot");
      const base64 = this.captureScreenshot();
      console.timeEnd("[vision-assistant] screenshot");
      console.log("[vision-assistant] screenshot base64 length:", base64.length);

      this.setStatus("Thinking...");
      console.time("[vision-assistant] backend-roundtrip");
      const data = await this.sendToBackend(base64, userPrompt);
      console.timeEnd("[vision-assistant] backend-roundtrip");

      console.log("[vision-assistant] Response received, length:", data.response?.length ?? 0);
      console.log("[vision-assistant] Response:", data.response);

      const text = data.response || "Model returned an empty response.";
      this.setStatus("Ready");
      this.setResponse(text);
      if (this.data.tts) this.speak(text);
    } catch (err) {
      console.error("[vision-assistant] ERROR:", err);
      this.setStatus("Error");
      this.setResponse("Error: " + err.message);
    } finally {
      this.busy = false;
    }
  },

  /* ────────────────── Screenshot + resize ────────────────── */

  captureScreenshot() {
    const scene = this.el.sceneEl;
    const screenshotComp = scene.components.screenshot;

    let srcCanvas;
    if (screenshotComp && typeof screenshotComp.getCanvas === "function") {
      srcCanvas = screenshotComp.getCanvas("perspective");
      console.log("[vision-assistant] Canvas from screenshot component");
    }
    if (!srcCanvas) {
      srcCanvas = scene.renderer.domElement;
      console.log("[vision-assistant] Canvas from renderer fallback");
    }

    console.log(`[vision-assistant] Canvas original: ${srcCanvas.width}x${srcCanvas.height}`);

    const maxW = this.data.screenshotMaxWidth;
    const scale = Math.min(1, maxW / srcCanvas.width);
    const w = Math.round(srcCanvas.width * scale);
    const h = Math.round(srcCanvas.height * scale);
    console.log(`[vision-assistant] Resized: ${w}x${h} (scale ${scale.toFixed(2)})`);

    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext("2d");
    ctx.drawImage(srcCanvas, 0, 0, w, h);

    return offscreen.toDataURL("image/jpeg", 0.7);
  },

  /* ────────────────── Fetch to backend ────────────────── */

  async sendToBackend(imageBase64, prompt) {
    const payload = { image: imageBase64, prompt };
    console.log("[vision-assistant] POST", this.data.backendUrl);
    console.log("[vision-assistant] payload prompt:", prompt);
    console.log("[vision-assistant] payload image length:", imageBase64.length);

    const res = await fetch(this.data.backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("[vision-assistant] HTTP status:", res.status);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[vision-assistant] Backend error:", err);
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  /* ────────────────── Panel helpers ────────────────── */

  setResponse(text) {
    if (this.responseEl) {
      this.responseEl.setAttribute("value", text);
      this._resizePanel(text);
    }
  },

  setStatus(text) {
    if (this.statusEl) this.statusEl.setAttribute("value", text);
  },

  /* ────────────────── Text-to-Speech ────────────────── */

  speak(text) {
    if (!window.speechSynthesis) {
      console.warn("[vision-assistant] SpeechSynthesis not supported");
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.data.lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      console.log("[vision-assistant] TTS started");
      this.setStatus("Speaking...");
    };
    utterance.onend = () => {
      console.log("[vision-assistant] TTS finished");
      this.setStatus("Ready");
    };
    utterance.onerror = (e) => {
      console.error("[vision-assistant] TTS error:", e.error);
      this.setStatus("Ready");
    };

    window.speechSynthesis.speak(utterance);
  },
});
