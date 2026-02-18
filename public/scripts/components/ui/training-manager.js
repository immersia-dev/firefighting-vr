/**
 * Training Manager — orchestrates the entire training flow.
 * Controls: Interactive Panels → Movement Unlock → Tutorial HUD
 *
 * In dev mode (DEBUG_CONFIG.DEV_MODE = true):
 *   - Skips intro panel, unlocks movement immediately
 *   - State machine is available but does not auto-advance
 *   - Use console helpers: window.trainingDev.forward() / .back() / .goTo('suppress')
 *
 * Depends on: interactive-panels, tutorial-hud, training-state
 */

AFRAME.registerComponent("training-manager", {
  schema: {
    enabled: { type: "boolean", default: true },
  },

  init: function () {
    window.debugLog("TrainingManager", "Initializing");

    this.scene = this.el.sceneEl;
    this.isDevMode = window.DEBUG_CONFIG && window.DEBUG_CONFIG.DEV_MODE;

    if (!this.data.enabled) return;

    this._exposeDevHelpers();

    this.scene.addEventListener("loaded", () => {
      setTimeout(() => {
        if (this.isDevMode) {
          this._startDevMode();
        } else {
          this.startTraining();
        }
      }, 500);
    });
  },

  startTraining: function () {
    window.debugLog("TrainingManager", "Starting training flow");
    this.showIntroPanel();
  },

  showIntroPanel: function () {
    const panelComponent = document.querySelector("[interactive-panels]");
    if (!panelComponent) {
      window.debugWarn("TrainingManager", "Interactive panels component not found");
      return;
    }
    panelComponent.components["interactive-panels"].showPanel("intro", {
      toMovement: () => this.startMainTraining(),
    });
  },

  startMainTraining: function () {
    window.debugLog("TrainingManager", "Starting main training phase");

    const panelComponent = document.querySelector("[interactive-panels]");
    panelComponent.components["interactive-panels"].clearPanel();
    panelComponent.components["interactive-panels"].unlockMovement();

    const hudComponent = document.querySelector("[tutorial-hud]");
    if (hudComponent && hudComponent.components["tutorial-hud"]) {
      setTimeout(() => {
        hudComponent.components["tutorial-hud"].show(
          "Pegue o extintor para começar o treinamento",
          5000,
        );
      }, 500);
    }
  },

  /**
   * Dev mode: skip intro, unlock movement, log available commands.
   */
  _startDevMode: function () {
    console.log(
      "%c[DEV MODE] Training Manager — interaction testing mode",
      "color: #10B981; font-weight: bold; font-size: 14px",
    );
    console.log(
      "%cAvailable commands:\n" +
        "  trainingDev.forward()        - Next state\n" +
        "  trainingDev.back()           - Previous state\n" +
        "  trainingDev.goTo('suppress') - Jump to state\n" +
        "  trainingDev.get()            - Current state\n" +
        "  trainingDev.list()           - All states\n" +
        "  trainingDev.reset()          - Reset to intro\n" +
        "  trainingDev.showPanel()      - Show intro panel\n" +
        "  trainingDev.hidePanel()      - Hide current panel",
      "color: #A855F7",
    );

    const panelComponent = document.querySelector("[interactive-panels]");
    if (panelComponent) {
      panelComponent.components["interactive-panels"].unlockMovement();
    }
  },

  /**
   * Expose window.trainingDev helpers for console interaction.
   * Caches the training-state element lookup to avoid repetition (DRY).
   */
  _exposeDevHelpers: function () {
    const self = this;

    /** Lookup training-state once per call — entity may be added later. */
    function _ts() {
      const el = document.querySelector("[training-state]");
      return el && el.trainingState ? el.trainingState : null;
    }

    window.trainingDev = {
      forward: function () {
        const ts = _ts();
        if (ts) { ts.forward(); console.log("[DEV] State:", ts.get()); }
        else { console.warn("[DEV] training-state not found"); }
      },
      back: function () {
        const ts = _ts();
        if (ts) { ts.back(); console.log("[DEV] State:", ts.get()); }
      },
      goTo: function (state) {
        const ts = _ts();
        if (ts) { ts.goTo(state); console.log("[DEV] State:", ts.get()); }
      },
      get: function () {
        const ts = _ts();
        if (ts) {
          console.log("[DEV] Current:", ts.get(), "| Desc:", ts.getDesc());
          return ts.get();
        }
      },
      list: function () {
        const ts = _ts();
        if (ts) {
          const all = ts.getAll();
          const cur = ts.get();
          console.log("[DEV] States:", all.map((s) => (s === cur ? `[${s}]` : s)).join(" → "));
          return all;
        }
      },
      reset: function () {
        const ts = _ts();
        if (ts) { ts.reset(); console.log("[DEV] Reset to:", ts.get()); }
      },
      showPanel: function () {
        self.showIntroPanel();
      },
      hidePanel: function () {
        const panelComponent = document.querySelector("[interactive-panels]");
        if (panelComponent) {
          panelComponent.components["interactive-panels"].clearPanel();
          panelComponent.components["interactive-panels"].unlockMovement();
        }
      },
    };
  },
});
