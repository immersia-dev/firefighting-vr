/**
 * Movement Controller Component
 *
 * Gerencia dois modos de movimento: analógico e teleporte
 * Controla qual é ativo em cada momento
 */

AFRAME.registerComponent("movement-controller", {
  schema: {
    mode: { type: "string", default: "analog" }, // 'analog' ou 'teleport'
    enabled: { type: "boolean", default: false },
  },

  init: function () {
    this.mode = this.data.mode;
    this.rig = this.el;

    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_CONTROLS) {
      window.debugLog(
        "MovementController",
        "Initialized with mode:",
        this.mode,
      );
    }

    this.setupTeleportRaycaster();
  },

  setupTeleportRaycaster: function () {
    const leftController = document.querySelector("#left-hand-controller");
    if (leftController) {
      leftController.setAttribute("teleport-controls", {
        enabled: this.mode === "teleport",
        type: "line",
        curveShootSpeed: 18000,
        curveLineWidth: 0.025,
      });
    }
  },

  setMode: function (newMode) {
    if (newMode !== "analog" && newMode !== "teleport") {
      console.warn("Invalid movement mode:", newMode);
      return;
    }

    this.mode = newMode;
    this.data.mode = newMode;

    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_CONTROLS) {
      window.debugLog("MovementController", "Mode switched to:", newMode);
    }

    // Ativar/desativar controles apropriados
    const leftController = document.querySelector("#left-hand-controller");
    if (leftController && leftController.components["teleport-controls"]) {
      leftController.components["teleport-controls"].data.enabled =
        newMode === "teleport" && this.data.enabled;
    }

    this.el.emit("movement-mode-changed", { mode: newMode });
  },

  getMode: function () {
    return this.mode;
  },

  setEnabled: function (enabled) {
    this.data.enabled = enabled;

    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_CONTROLS) {
      window.debugLog("MovementController", "Enabled:", enabled);
    }

    // Desativar teleporte também se desabilitar movimento
    const leftController = document.querySelector("#left-hand-controller");
    if (leftController && leftController.components["teleport-controls"]) {
      leftController.components["teleport-controls"].data.enabled =
        enabled && this.mode === "teleport";
    }
  },

  isEnabled: function () {
    return this.data.enabled;
  },
});
