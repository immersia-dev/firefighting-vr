/**
 * Scene Manager Component
 *
 * Lightweight event router for high-level scene transitions.
 * Listens for scene-level events and coordinates responses.
 *
 * Currently handled events:
 *   - training-start  → enables movement
 *   - reset-to-welcome → disables movement, resets state machine
 *   - training-complete → emits completion event
 *
 * NOTE: The actual training flow is orchestrated by training-manager.js.
 *       This component is reserved for future multi-scene / multi-module routing.
 */

AFRAME.registerComponent("scene-manager", {
  schema: {
    autoStart: { type: "boolean", default: false },
  },

  init: function () {
    this.currentScene = "welcome";
    this._attachListeners();
    window.debugLog("SceneManager", "Initialized — scene:", this.currentScene);
  },

  _attachListeners: function () {
    const scene = this.el.sceneEl;

    scene.addEventListener("training-start", (e) => {
      this.currentScene = "training";
      window.debugLog("SceneManager", "→ training (mode:", e.detail && e.detail.mode, ")");

      const rig = document.querySelector("#rig");
      if (rig && rig.components["movement-controller"]) {
        rig.components["movement-controller"].setEnabled(true);
      }
    });

    scene.addEventListener("reset-to-welcome", () => {
      this.currentScene = "welcome";
      window.debugLog("SceneManager", "→ welcome");

      const rig = document.querySelector("#rig");
      if (rig && rig.components["movement-controller"]) {
        rig.components["movement-controller"].setEnabled(false);
      }
    });

    scene.addEventListener("training-complete", () => {
      this.currentScene = "complete";
      window.debugLog("SceneManager", "→ complete");
    });
  },

  getCurrentScene: function () {
    return this.currentScene;
  },
});
