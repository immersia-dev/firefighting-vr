/**
 * Training Manager - Orquestra todo o fluxo de treinamento
 * Controla: Painéis Interativos → Liberação de Movimento → Tutorial HUD
 *
 * In dev mode (DEBUG_CONFIG.DEV_MODE = true):
 *   - Skips intro panel, unlocks movement immediately
 *   - State machine is available but does not auto-advance
 *   - Use console helpers: window.trainingDev.forward() / .back() / .goTo('suppress')
 */

AFRAME.registerComponent("training-manager", {
  schema: {
    enabled: { type: "boolean", default: true },
  },

  init: function () {
    console.log("[TrainingManager] Initializing");

    this.scene = this.el.sceneEl;
    this.isDevMode = window.DEBUG_CONFIG && window.DEBUG_CONFIG.DEV_MODE;

    if (!this.data.enabled) return;

    // Expose dev helpers on window for console use
    this._exposeDevHelpers();

    // Aguardar scene estar pronta
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
    console.log("[TrainingManager] Starting training flow");
    this.showIntroPanel();
  },

  showIntroPanel: function () {
    const panelComponent = document.querySelector("[interactive-panels]");
    if (!panelComponent) {
      console.warn("[TrainingManager] Interactive panels component not found");
      return;
    }

    panelComponent.components["interactive-panels"].showPanel("intro", {
      toMovement: () => this.startMainTraining(),
    });
  },

  startMainTraining: function () {
    console.log("[TrainingManager] Starting main training phase");

    const panelComponent = document.querySelector("[interactive-panels]");

    // Limpar painel
    panelComponent.components["interactive-panels"].clearPanel();

    // Liberar movimento
    panelComponent.components["interactive-panels"].unlockMovement();

    // Show initial HUD message
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
      "%c[DEV MODE] Training Manager - interaction testing mode",
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

    // Unlock movement immediately
    const panelComponent = document.querySelector("[interactive-panels]");
    if (panelComponent) {
      panelComponent.components["interactive-panels"].unlockMovement();
    }
  },

  /**
   * Expose window.trainingDev helpers for console interaction.
   */
  _exposeDevHelpers: function () {
    const self = this;
    window.trainingDev = {
      forward: function () {
        const el = document.querySelector("[training-state]");
        if (el && el.trainingState) {
          el.trainingState.forward();
          console.log("[DEV] State:", el.trainingState.get());
        } else {
          console.warn("[DEV] training-state component not found");
        }
      },
      back: function () {
        const el = document.querySelector("[training-state]");
        if (el && el.trainingState) {
          el.trainingState.back();
          console.log("[DEV] State:", el.trainingState.get());
        }
      },
      goTo: function (state) {
        const el = document.querySelector("[training-state]");
        if (el && el.trainingState) {
          el.trainingState.goTo(state);
          console.log("[DEV] State:", el.trainingState.get());
        }
      },
      get: function () {
        const el = document.querySelector("[training-state]");
        if (el && el.trainingState) {
          const state = el.trainingState.get();
          console.log("[DEV] Current state:", state, "| Desc:", el.trainingState.getDesc());
          return state;
        }
      },
      list: function () {
        const el = document.querySelector("[training-state]");
        if (el && el.trainingState) {
          const all = el.trainingState.getAll();
          const current = el.trainingState.get();
          console.log("[DEV] States:", all.map(s => s === current ? `[${s}]` : s).join(" → "));
          return all;
        }
      },
      reset: function () {
        const el = document.querySelector("[training-state]");
        if (el && el.trainingState) {
          el.trainingState.reset();
          console.log("[DEV] Reset to:", el.trainingState.get());
        }
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
