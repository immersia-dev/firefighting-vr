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
 *   - Foam nozzle: child of other-hand controller, yaw-only (forward)
 *
 * FLOW:
 *   1. Aim raycaster at extinguisher collider
 *   2. Grip once → snap to hand (toggle — no need to hold)
 *   3. A/X removes safety seal
 *   4. Trigger to spray foam from hose tip
 *   5. Release is disabled after grab (training mode)
 */

AFRAME.registerComponent("extinguisher-controller", {
  schema: {
    enabled: { type: "boolean", default: true },
    gripHand: { type: "string", default: "right" },
    hoseTubularSegments: { type: "int", default: 16 },
    hoseRadialSegments: { type: "int", default: 6 },
    hoseRadius: { type: "number", default: 0.012 },
    hoseExitLength: { type: "number", default: 0.08 },
    hoseExitDir: { type: "vec3", default: { x: -1, y: 0, z: 0 } },
    hoseTipLength: { type: "number", default: 0.005 },
    hoseTipDir: { type: "vec3", default: { x: 0, y: 0, z: -1 } },
    requireSeal: { type: "boolean", default: false },
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
    this._negZ = new THREE.Vector3(0, 0, -1); // constant for foam orientation
    this._anchorQuat = new THREE.Quaternion();
    this._anchorForward = new THREE.Vector3();
    this._exitDir = new THREE.Vector3(); // normalized exit direction in local space
    this._tipDir = new THREE.Vector3();   // normalized tip direction (nozzle end)
    this._tipForward = new THREE.Vector3();
    this._flowDir = new THREE.Vector3();  // natural hose flow direction (body → hand)
    this._nozzleQuat = new THREE.Quaternion();
    this._parentQuat = new THREE.Quaternion();
    this._parentQuatInv = new THREE.Quaternion();
    this._foamEuler = new THREE.Euler(0, 0, 0, "YXZ");
    this._curvePoints = [
      new THREE.Vector3(), // 0: anchor
      new THREE.Vector3(), // 1: exit (anchor + exitDir * exitLen)
      new THREE.Vector3(), // 2: mid1 (sag)
      new THREE.Vector3(), // 3: mid2 (sag)
      new THREE.Vector3(), // 4: tip entry (nozzle - tipDir * tipLen)
      new THREE.Vector3(), // 5: nozzle
    ];

    // ── Bind handlers ──
    this._onGripDown = this._onGripDown.bind(this);
    this._onTriggerDown = this._onTriggerDown.bind(this);
    this._onTriggerUp = this._onTriggerUp.bind(this);
    this._onSealButton = this._onSealButton.bind(this);

    // Cached controller references (resolved after scene loads)
    this._gripCtrl = null;
    this._otherCtrl = null;
    this._rightCtrl = null;
    this._leftCtrl = null;

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
    const gripCtrl = document.querySelector(
      `#${this.data.gripHand}-hand-controller`,
    );
    if (!gripCtrl) {
      console.warn("[ExtinguisherCtrl] Controller not found:", this.data.gripHand);
      return;
    }
    this._gripCtrl = gripCtrl;
    gripCtrl.addEventListener("gripdown", this._onGripDown);

    // Cache both controllers for trigger/seal listeners
    this._rightCtrl = document.querySelector("#right-hand-controller");
    this._leftCtrl = document.querySelector("#left-hand-controller");

    // Determine other hand controller for hose target
    const otherHand = this.data.gripHand === "right" ? "left" : "right";
    this._otherCtrl = document.querySelector(`#${otherHand}-hand-controller`);

    if (this._rightCtrl) {
      this._rightCtrl.addEventListener("triggerdown", this._onTriggerDown);
      this._rightCtrl.addEventListener("triggerup", this._onTriggerUp);
      this._rightCtrl.addEventListener("abuttondown", this._onSealButton);
    }
    if (this._leftCtrl) {
      this._leftCtrl.addEventListener("triggerdown", this._onTriggerDown);
      this._leftCtrl.addEventListener("triggerup", this._onTriggerUp);
      this._leftCtrl.addEventListener("xbuttondown", this._onSealButton);
    }

    this._log("Listeners attached — grip:", this.data.gripHand, "| trigger: both | seal: A/X");
  },

  // ─── Event Handlers ──────────────────────────────────────────────

  /** Toggle grip: first press grabs, second press releases. */
  _onGripDown: function () {
    if (!this.data.enabled) return;

    if (this.isHeld) {
      this._log("Grip pressed while held — release disabled");
      return;
    }

    // Check raycaster aim
    if (!this._gripCtrl) return;

    const raycaster = this._gripCtrl.components.raycaster;
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
    if (this.data.requireSeal && !this.sealRemoved) {
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
    if (this.foamEntity && this.foamEntity.components["foam-system"]) {
      this.foamEntity.components["foam-system"].start();
      this._log("Spraying started — foam-system.start() called");
    } else {
      console.warn("[ExtinguisherCtrl] Foam entity or component not found!",
        "foamEntity:", !!this.foamEntity,
        "foam-system:", this.foamEntity ? !!this.foamEntity.components["foam-system"] : "N/A");
    }
  },

  _stopSpray: function () {
    this.isSpraying = false;
    if (this.foamEntity && this.foamEntity.components["foam-system"]) {
      this.foamEntity.components["foam-system"].stop();
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
      this.hoseAnchor.object3D.getWorldQuaternion(this._anchorQuat);
      // Exit direction: configurable local direction rotated to world space
      const d = this.data.hoseExitDir;
      this._exitDir.set(d.x, d.y, d.z).normalize();
      this._anchorForward.copy(this._exitDir).applyQuaternion(this._anchorQuat);
    }

    // 2. Hose end: foam nozzle world position (NOT the controller origin)
    if (this.foamEntity) {
      this.foamEntity.object3D.updateMatrixWorld(true);
      this.foamEntity.object3D.getWorldPosition(this._otherHandWorld);
      // Tip direction: controller's actual forward (-Z), same as raycaster
      this.foamEntity.parentEl.object3D.getWorldQuaternion(this._nozzleQuat);
      this._tipForward.set(0, 0, -1).applyQuaternion(this._nozzleQuat);
    } else if (this._otherCtrl) {
      this._otherCtrl.object3D.getWorldPosition(this._otherHandWorld);
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
   * Rebuild TubeGeometry along a 6-point CatmullRom spline.
   * Points: anchor → exit → mid1 (sag) → mid2 (sag) → tipEntry → nozzle
   * The exit/tipEntry segments ensure the hose leaves straight from both ends.
   */
  _updateHose: function () {
    if (!this._hoseMesh) return;

    const a = this._anchorWorld;
    const b = this._otherHandWorld;

    // Short exit segment along the anchor's configurable direction
    const exitLen = this.data.hoseExitLength;
    const exitPoint = this._curvePoints[1];
    exitPoint.copy(a).addScaledVector(this._anchorForward, exitLen);

    // Short tip entry segment along the controller's forward direction
    // This makes the hose tip always point same direction as the raycaster
    const tipLen = this.data.hoseTipLength;
    const tipEntry = this._curvePoints[4];
    tipEntry.copy(b).addScaledVector(this._tipForward, -tipLen);

    // Two intermediate points between exit and tipEntry with gravity sag
    const dist = exitPoint.distanceTo(tipEntry);
    const sag = Math.max(0.06, dist * 0.2);

    this._mid1.lerpVectors(exitPoint, tipEntry, 0.33);
    this._mid1.y -= sag;
    this._mid2.lerpVectors(exitPoint, tipEntry, 0.66);
    this._mid2.y -= sag * 1.2;

    // Reuse pre-allocated vectors for the curve
    this._curvePoints[0].copy(a);
    this._curvePoints[2].copy(this._mid1);
    this._curvePoints[3].copy(this._mid2);
    this._curvePoints[5].copy(b);

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
   * Keep foam nozzle aligned with the controller (identity quaternion).
   * The foam sprays along the controller's -Z, same direction as the raycaster.
   */
  _updateFoamNozzle: function () {
    if (!this.foamEntity) return;
    this.foamEntity.object3D.quaternion.identity();
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
    if (this._gripCtrl) {
      this._gripCtrl.removeEventListener("gripdown", this._onGripDown);
    }

    if (this._rightCtrl) {
      this._rightCtrl.removeEventListener("triggerdown", this._onTriggerDown);
      this._rightCtrl.removeEventListener("triggerup", this._onTriggerUp);
    }
    if (this._leftCtrl) {
      this._leftCtrl.removeEventListener("triggerdown", this._onTriggerDown);
      this._leftCtrl.removeEventListener("triggerup", this._onTriggerUp);
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
