/**
 * UI Helpers — shared utilities for VR panel / HUD components.
 *
 * Loaded via <script> before any component that needs them.
 * Exposes window.UI_HELPERS so every component in the global scope can use it.
 *
 * Usage:
 *   const plane = window.UI_HELPERS.createPlane(1.2, 0.8, "#070615", { o: 0.75, z: -0.01 });
 *   const msdf  = window.UI_HELPERS.MSDF_FONT;  // attribute string for <a-entity text="…">
 */

(function () {
  "use strict";

  /** MSDF font attribute fragment — append to any `text` attribute string. */
  const MSDF_FONT =
    "font: /assets/fonts/Exo2-Regular-msdf.json; shader: msdf; negate: false";

  /**
   * Creates an <a-plane> element with optional transparency and offset.
   *
   * @param {number} w    - Width in meters
   * @param {number} h    - Height in meters
   * @param {string} c    - Hex colour
   * @param {Object} [opts]
   * @param {number} [opts.o]  - Opacity (0-1), default 1
   * @param {number} [opts.z]  - Z offset
   * @param {number} [opts.y]  - Y offset
   * @returns {HTMLElement}  Configured <a-plane>
   */
  function createPlane(w, h, c, opts) {
    opts = opts || {};
    var p = document.createElement("a-plane");
    p.setAttribute("width", w.toString());
    p.setAttribute("height", h.toString());
    p.setAttribute("color", c);
    p.setAttribute(
      "material",
      "transparent: true; opacity: " + (opts.o != null ? opts.o : 1) + "; side: double",
    );
    if (opts.z != null || opts.y != null) {
      p.setAttribute("position", "0 " + (opts.y || 0) + " " + (opts.z || 0));
    }
    return p;
  }

  window.UI_HELPERS = {
    MSDF_FONT: MSDF_FONT,
    createPlane: createPlane,
  };
})();
