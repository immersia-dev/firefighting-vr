/**
 * Extinguisher Controller Component
 *
 * Realistic fire extinguisher interaction using snap-to-hand technique:
 *
 * SETUP (in scene):
 *   - World extinguisher: visible model at a fixed position with invisible grab collider
 *   - Hidden hand extinguisher: pre-attached to dominant hand, invisible until grabbed
 *   - Hose anchor (#hose-anchor): child of body model, marks where the hose exits the body
 *   - Hose: single TubeGeometry spline from anchor → other hand (1 draw call)
 *   - Foam nozzle: at hose tip, oriented along last tangent of the spline
 *
 * FLOW:
 *   1. Aim raycaster at extinguisher collider
 *   2. Grip once → snap to hand (toggle — no need to hold)
 *   3. A/X removes safety seal
 *   4. Trigger to spray foam from hose tip
 *   5. Grip again → release back to world position
 */

AFRAME.registerComponent("extinguisher-controller", {
  schema: {
    enabled: { type: "boolean", default: true },
    gripHand: { type: "string", default: "right" },
    hoseTubularSegments: { type: "int", default: 16 },
    hoseRadialSegments: { type: "int", default: 6 },
    hoseRadius: { type: "number", default: 0.012 },
  },

  init: function () {
    // ── State ──
    this.isHeld = false;
    this.sealRemoved = false;
    this.isSpraying = false;

    // ── DOM references (resolved after scene load) ──
    this.worldExtinguisher = null;
    this.handExtinguisher = null;
    this.sealEntity = null;
    this.foamEntity = null;
    this.hoseAnchor = null; // <a-entity id="hose-anchor"> inside the body

    // ── Hose Three.js objects ──
    this.hoseEntity = null;   // A-Frame wrapper <a-entity>
    this._hoseMesh = null;    // THREE.Mesh inside hoseEntity
    this._hoseMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.3,
      roughness: 0.7,
    });

    // ── Reusable math objects (avoid GC) ──
    this._anchorWorld = new THREE.Vector3();
    this._otherHandWorld = new THREE.Vector3();
    this._mid1 = new THREE.Vector3();
    this._mid2 = new THREE.Vector3();
    this._tangent = new THREE.Vector3();
    this._hoseDir = new THREE.Vector3();
    this._foamQuat = new THREE.Quaternion();
    this._curvePoints = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ];

    // ── Bind handlers ──
    this._onGripDown = this._onGripDown.bind(this);
    this._onTriggerDown = this._onTriggerDown.bind(this);
    this._onTriggerUp = this._onTriggerUp.bind(this);
    this._onSealButton = this._onSealButton.bind(this);

    this.el.sceneEl.addEventListener("loaded", () => {
      this._resolveReferences();
      this._attachListeners();
      this._createHose();
    });

    this._log("Initialized");
  },

  // ─── References ───────────────────────────────────────────────────

  _resolveReferences: function () {
    this.worldExtinguisher = document.querySelector("#extinguisher-world");
    this.handExtinguisher = document.querySelector("#extinguisher-hand");
    this.sealEntity = document.querySelector("#extintor-hand-seal");
    this.foamEntity = document.querySelector("#foam-nozzle");
    this.hoseAnchor = document.querySelector("#hose-anchor");

    if (this.handExtinguisher) {
      this.handExtinguisher.setAttribute("visible", false);
    }

    const collider = document.querySelector("#extinguisher-collider");
    if (collider) collider.classList.add("interactable");

    this._log(
      "References resolved, hoseAnchor:",
      this.hoseAnchor ? "found" : "MISSING",
    );
  },

  // ─── Listeners ────────────────────────────────────────────────────

  _attachListeners: function () {
    // Grip on dominant hand for grab/release toggle
    const gripCtrl = document.querySelector(
      `#${this.data.gripHand}-hand-controller`,
    );
    if (!gripCtrl) {
      console.warn("[ExtinguisherCtrl] Controller not found:", this.data.gripHand);
      return;
    }

    gripCtrl.addEventListener("gripdown", this._onGripDown);

    // Trigger (spray) — listen on BOTH controllers so it always works
    const rightCtrl = document.querySelector("#right-hand-controller");
    const leftCtrl = document.querySelector("#left-hand-controller");

    if (rightCtrl) {
      rightCtrl.addEventListener("triggerdown", this._onTriggerDown);
      rightCtrl.addEventListener("triggerup", this._onTriggerUp);
      rightCtrl.addEventListener("abuttondown", this._onSealButton);
    }
    if (leftCtrl) {
      leftCtrl.addEventListener("triggerdown", this._onTriggerDown);
      leftCtrl.addEventListener("triggerup", this._onTriggerUp);
      leftCtrl.addEventListener("xbuttondown", this._onSealButton);
    }

    this._log("Listeners attached — grip:", this.data.gripHand, "| trigger: both | seal: A/X");
  },

  // ─── Event Handlers ──────────────────────────────────────────────

  /** Toggle grip: first press grabs, second press releases. */
  _onGripDown: function () {
    if (!this.data.enabled) return;

    if (this.isHeld) {
      this._release();
      return;
    }

    // Check raycaster aim
    const gripCtrl = document.querySelector(
      `#${this.data.gripHand}-hand-controller`,
    );
    if (!gripCtrl) return;

    const raycaster = gripCtrl.components.raycaster;
    if (raycaster) {
      const hitsCollider = raycaster.intersections.some(
        (i) =>
          i.object.el &&
          (i.object.el.id === "extinguisher-collider" ||
            i.object.el.closest("#extinguisher-world")),
      );
      if (!hitsCollider) {
        this._log("Grip pressed but not aiming at extinguisher");
        return;
      }
    }

    this._grab();
  },

  _onTriggerDown: function () {
    this._log("TriggerDown — isHeld:", this.isHeld, "sealRemoved:", this.sealRemoved, "enabled:", this.data.enabled);
    if (!this.isHeld || !this.data.enabled) return;
    if (!this.sealRemoved) {
      this._log("Cannot spray — seal not removed yet! Press A or X first.");
      return;
    }
    this._startSpray();
  },

  _onTriggerUp: function () {
    if (!this.isSpraying) return;
    this._stopSpray();
  },

  _onSealButton: function () {
    this._log("SealButton — isHeld:", this.isHeld, "sealRemoved:", this.sealRemoved);
    if (!this.isHeld || !this.data.enabled || this.sealRemoved) return;
    this._removeSeal();
  },

  // ─── Core Actions ─────────────────────────────────────────────────

  _grab: function () {
    this.isHeld = true;
    if (this.worldExtinguisher) this.worldExtinguisher.setAttribute("visible", false);
    if (this.handExtinguisher) this.handExtinguisher.setAttribute("visible", true);
    if (this.hoseEntity) this.hoseEntity.setAttribute("visible", true);

    this._haptic(this.data.gripHand, 0.4, 100);
    this._log("Grabbed (toggle ON)");
    this.el.sceneEl.emit("extinguisher-grabbed");
  },

  _release: function () {
    this.isHeld = false;
    if (this.isSpraying) this._stopSpray();
    if (this.worldExtinguisher) this.worldExtinguisher.setAttribute("visible", true);
    if (this.handExtinguisher) this.handExtinguisher.setAttribute("visible", false);
    if (this.hoseEntity) this.hoseEntity.setAttribute("visible", false);

    this._haptic(this.data.gripHand, 0.2, 50);
    this._log("Released (toggle OFF)");
    this.el.sceneEl.emit("extinguisher-released");
  },

  _removeSeal: function () {
    if (!this.sealEntity) return;
    this.sealEntity.setAttribute("animation__fadeout", {
      property: "scale",
      from: "1 1 1",
      to: "0.01 0.01 0.01",
      dur: 300,
      easing: "easeInQuad",
    });
    setTimeout(() => {
      this.sealEntity.setAttribute("visible", false);
      this.sealRemoved = true;
      this.el.sceneEl.emit("extinguisher-seal-removed");
      this._haptic(this.data.gripHand, 0.6, 150);
      this._log("Seal removed");
    }, 300);
  },

  _startSpray: function () {
    this.isSpraying = true;
    if (this.foamEntity && this.foamEntity.components.foam) {
      this.foamEntity.components.foam.start();
      this._log("Spraying started — foam.start() called");
    } else {
      console.warn("[ExtinguisherCtrl] Foam entity or component not found!",
        "foamEntity:", !!this.foamEntity,
        "foam component:", this.foamEntity ? !!this.foamEntity.components.foam : "N/A");
    }
  },

  _stopSpray: function () {
    this.isSpraying = false;
    if (this.foamEntity && this.foamEntity.components.foam) {
      this.foamEntity.components.foam.stop();
    }
    this._log("Spraying stopped");
  },

  // ─── Hose (Spline TubeGeometry — single draw call) ────────────────

  /**
   * Create the hose as an A-Frame entity wrapping a Three.js TubeGeometry mesh.
   * Visible in A-Frame Inspector as #extinguisher-hose.
   * The geometry is rebuilt each frame — it's tiny (16×6 verts) so the cost
   * is negligible compared to the rest of the VR render pipeline.
   */
  _createHose: function () {
    // Dummy initial geometry (will be replaced in first tick)
    const dummyCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.2, 0),
      new THREE.Vector3(0, -0.3, -0.1),
      new THREE.Vector3(0, -0.4, -0.2),
    ]);
    const geom = new THREE.TubeGeometry(
      dummyCurve,
      this.data.hoseTubularSegments,
      this.data.hoseRadius,
      this.data.hoseRadialSegments,
      false,
    );

    this._hoseMesh = new THREE.Mesh(geom, this._hoseMaterial);
    this._hoseMesh.frustumCulled = false;

    // Wrap in A-Frame entity so it appears in the Inspector
    this.hoseEntity = document.createElement("a-entity");
    this.hoseEntity.id = "extinguisher-hose";
    this.hoseEntity.setAttribute("visible", false);
    this.hoseEntity.classList.add("hose");
    this.el.sceneEl.appendChild(this.hoseEntity);

    // Append the Three.js mesh to the entity's Object3D
    this.hoseEntity.object3D.add(this._hoseMesh);

    this._log("Hose spline mesh created");
  },

  // ─── Tick ─────────────────────────────────────────────────────────

  tick: function () {
    if (!this.data.enabled || !this.isHeld) return;

    // 1. Hose start: world position of the anchor entity on the body
    if (this.hoseAnchor) {
      this.hoseAnchor.object3D.updateMatrixWorld(true);
      this.hoseAnchor.object3D.getWorldPosition(this._anchorWorld);
    }

    // 2. Hose end: other hand world position
    const otherHand = this.data.gripHand === "right" ? "left" : "right";
    const otherCtrl = document.querySelector(`#${otherHand}-hand-controller`);
    if (otherCtrl) {
      otherCtrl.object3D.getWorldPosition(this._otherHandWorld);
    } else {
      this._otherHandWorld.copy(this._anchorWorld);
      this._otherHandWorld.y -= 0.4;
    }

    // 3. Rebuild hose spline
    this._updateHose();

    // 4. Orient foam at hose tip along spline tangent
    this._updateFoamNozzle();
  },

  /**
   * Rebuild TubeGeometry along a 4-point CatmullRom spline.
   * Points: anchor → mid1 (sag near body) → mid2 (sag near hand) → otherHand
   * The two intermediate points create a natural gravity droop.
   */
  _updateHose: function () {
    if (!this._hoseMesh) return;

    const a = this._anchorWorld;
    const b = this._otherHandWorld;
    const dist = a.distanceTo(b);
    const sag = Math.max(0.06, dist * 0.2);

    // Two intermediate points at 1/3 and 2/3 with gravity sag
    this._mid1.lerpVectors(a, b, 0.33);
    this._mid1.y -= sag;
    this._mid2.lerpVectors(a, b, 0.66);
    this._mid2.y -= sag * 1.2; // slightly more sag towards the hand

    // Reuse pre-allocated vectors for the curve
    this._curvePoints[0].copy(a);
    this._curvePoints[1].copy(this._mid1);
    this._curvePoints[2].copy(this._mid2);
    this._curvePoints[3].copy(b);

    const curve = new THREE.CatmullRomCurve3(this._curvePoints);

    // Dispose old geometry, create new
    if (this._hoseMesh.geometry) this._hoseMesh.geometry.dispose();
    this._hoseMesh.geometry = new THREE.TubeGeometry(
      curve,
      this.data.hoseTubularSegments,
      this.data.hoseRadius,
      this.data.hoseRadialSegments,
      false,
    );

    // Store tangent at end for foam orientation
    this._tangent.copy(curve.getTangentAt(1.0));
  },

  /**
   * Orient foam nozzle along the spline's end tangent.
   * Foam component shoots along local -Z, so we align -Z with the tangent.
   */
  _updateFoamNozzle: function () {
    if (!this.foamEntity) return;

    // The tangent at t=1 gives the exact hose direction at the tip
    this._foamQuat.setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      this._tangent,
    );

    // Convert world quaternion → local quaternion relative to parent
    if (this.foamEntity.parentEl) {
      this.foamEntity.parentEl.object3D.updateMatrixWorld(true);
      const parentQuatInv = this.foamEntity.parentEl.object3D.quaternion
        .clone()
        .invert();
      this._foamQuat.premultiply(parentQuatInv);
    }

    this.foamEntity.object3D.quaternion.copy(this._foamQuat);
  },

  // ─── Utilities ────────────────────────────────────────────────────

  _haptic: function (hand, intensity, duration) {
    const ctrl = document.querySelector(`#${hand}-hand-controller`);
    if (!ctrl) return;
    const gp =
      ctrl.components["tracked-controls"] &&
      ctrl.components["tracked-controls"].controller &&
      ctrl.components["tracked-controls"].controller.gamepad;
    if (gp && gp.hapticActuators && gp.hapticActuators[0]) {
      gp.hapticActuators[0].pulse(intensity, duration);
    }
  },

  _log: function (...args) {
    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_CONTROLS) {
      window.debugLog("ExtinguisherCtrl", ...args);
    }
  },

  setEnabled: function (enabled) {
    this.data.enabled = enabled;
    if (!enabled && this.isHeld) this._release();
    this._log("Enabled:", enabled);
  },

  remove: function () {
    const gripCtrl = document.querySelector(
      `#${this.data.gripHand}-hand-controller`,
    );
    if (gripCtrl) {
      gripCtrl.removeEventListener("gripdown", this._onGripDown);
    }

    // Remove trigger/seal listeners from both controllers
    const rightCtrl = document.querySelector("#right-hand-controller");
    const leftCtrl = document.querySelector("#left-hand-controller");
    if (rightCtrl) {
      rightCtrl.removeEventListener("triggerdown", this._onTriggerDown);
      rightCtrl.removeEventListener("triggerup", this._onTriggerUp);
    }
    if (leftCtrl) {
      leftCtrl.removeEventListener("triggerdown", this._onTriggerDown);
      leftCtrl.removeEventListener("triggerup", this._onTriggerUp);
    }

    if (this._hoseMesh) {
      if (this._hoseMesh.geometry) this._hoseMesh.geometry.dispose();
      this._hoseMaterial.dispose();
    }
    if (this.hoseEntity && this.hoseEntity.parentNode) {
      this.hoseEntity.parentNode.removeChild(this.hoseEntity);
    }
  },
});
