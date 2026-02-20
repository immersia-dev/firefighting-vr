/**
 * Burn Effect Component
 *
 * Progressively darkens an object's material while nearby fire is active.
 * The effect is accumulative (soot/char) — it never reverses even after
 * the fire is extinguished.
 *
 * Requires a parent entity with the `fire` component.
 *
 * Usage:
 *   <a-entity fire="…">
 *     <a-entity gltf-model="#pallet" burn-effect="burnRate: 0.08"></a-entity>
 *   </a-entity>
 */

AFRAME.registerComponent("burn-effect", {
  schema: {
    burnRate: { type: "number", default: 0.08 },
    minIntensity: { type: "number", default: 0.2 },
    maxDarkness: { type: "number", default: 0.7 },
  },

  init: function () {
    this.initialColor = new THREE.Color(0x1a0f08);
    this.burnedColor = new THREE.Color(0x3a2818);
    this.initialEmissive = new THREE.Color(0x0a0503);
    this.burnedEmissive = new THREE.Color(0x120a06);
    this.burnAmount = 0;
  },

  tick: function (_time, timeDelta) {
    var fire = this.el.parentEl && this.el.parentEl.components["fire-system"];
    if (!fire) return;

    // Accumulate burn over time while fire is above threshold
    if (fire.fireIntensity > this.data.minIntensity) {
      this.burnAmount = Math.min(
        1,
        this.burnAmount + (timeDelta / 1000) * this.data.burnRate,
      );
    }

    // Throttle material traversal — every 100ms is enough for a slow effect
    this._accumTime = (this._accumTime || 0) + timeDelta;
    if (this._accumTime < 100) return;
    this._accumTime = 0;

    var self = this;
    this.el.object3D.traverse(function (node) {
      if (!node.material) return;
      var mat = node.material;

      // Cache original colours on first encounter
      if (!mat.userData.originalColor) {
        mat.userData.originalColor = mat.color
          ? mat.color.clone()
          : self.initialColor.clone();
        mat.userData.originalEmissive = mat.emissive
          ? mat.emissive.clone()
          : self.initialEmissive.clone();
      }

      var darknessAmount = self.burnAmount * self.data.maxDarkness;

      if (mat.color) {
        mat.color.copy(mat.userData.originalColor).lerp(self.burnedColor, darknessAmount);
      }
      if (mat.emissive) {
        mat.emissive.copy(mat.userData.originalEmissive).lerp(self.burnedEmissive, darknessAmount);
      }
    });
  },
});
