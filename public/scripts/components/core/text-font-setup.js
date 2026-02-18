/**
 * Text Font Setup Component (auto-MSDF)
 *
 * Automatically applies the MSDF font (Exo2-Regular) to any <a-text> element
 * added as a child of the entity this component is attached to.
 *
 * Useful as a catch-all on <a-scene> to ensure no <a-text> falls back
 * to the default SDF font (which lacks accented characters).
 *
 * NOTE: Most programmatic text already uses window.UI_HELPERS.MSDF_FONT.
 *       This component is a safety net for hand-authored HTML <a-text> tags.
 *
 * Usage:
 *   <a-scene text-font-setup>
 */

(function () {
  "use strict";

  var FONT_PATH = "/assets/fonts/Exo2-Regular-msdf.json";
  var FONT_IMAGE = "/assets/fonts/Exo2-Regular.png";

  function applyMsdf(el) {
    if (!el || el.tagName !== "A-TEXT") return;
    el.setAttribute("font", FONT_PATH);
    el.setAttribute("font-image", FONT_IMAGE);
    el.setAttribute("negate", "false");
  }

  AFRAME.registerComponent("text-font-setup", {
    init: function () {
      // Apply to self if it is an <a-text>
      applyMsdf(this.el);

      // Observe subtree for dynamically added <a-text> nodes
      this._observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var added = mutations[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var node = added[j];
            if (node.nodeType !== 1) continue;
            applyMsdf(node);
            var children = node.querySelectorAll && node.querySelectorAll("a-text");
            if (children) {
              for (var k = 0; k < children.length; k++) applyMsdf(children[k]);
            }
          }
        }
      });

      this._observer.observe(this.el, { childList: true, subtree: true });

      // Catch any existing <a-text> nodes already in the DOM
      var existing = this.el.querySelectorAll("a-text");
      for (var i = 0; i < existing.length; i++) applyMsdf(existing[i]);
    },

    remove: function () {
      if (this._observer) this._observer.disconnect();
    },
  });
})();

