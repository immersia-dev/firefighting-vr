/**
 * Tutorial HUD Component
 *
 * Displays non-interactive tutorial messages at bottom of screen.
 * Messages are queued and displayed sequentially with configurable duration.
 * HUD is attached to player rig and follows camera movement.
 *
 * Usage:
 *   const hud = document.querySelector('[tutorial-hud]').components['tutorial-hud'];
 *   hud.show('Your message here', 5000);
 */

const HUD_MSDF_FONT = "font: /assets/fonts/Exo2-Regular-msdf.json; shader: msdf; negate: false";

const HUD_CONFIG = {
  size: { w: 1, h: 0.22 },
  pos: { x: 0, y: -0.5, z: -2.5 },
  colors: {
    bg: "#070615",
    borderOuter: "#A855F7",
    borderMid: "#2A2CFF",
    borderInner: "#FFFFFF",
  },
  // Text constrained to 85% of HUD width
  contentWidth: 0.85,
};

AFRAME.registerComponent("tutorial-hud", {
  schema: { enabled: { type: "boolean", default: true } },

  init: function () {
    console.log("[TutorialHUD] Initializing");
    this.scene = this.el.sceneEl;
    this.hudEntity = null;
    this.messageText = null;
    this.messages = [];
    this.currentMessage = null;
    this.messageTimeout = null;
    this._buildHUD();
  },

  /**
   * Constructs HUD container with background, borders, and text element.
   * Attached to player rig to follow camera movement.
   */
  _buildHUD: function () {
    const camera = document.querySelector("#camera");
    if (!camera) return;

    const container = document.createElement("a-entity");
    container.id = "tutorial-hud-container";
    container.setAttribute(
      "position",
      `${HUD_CONFIG.pos.x} ${HUD_CONFIG.pos.y} ${HUD_CONFIG.pos.z}`,
    );

    // Main background
    container.appendChild(
      this._plane(HUD_CONFIG.size.w, HUD_CONFIG.size.h, HUD_CONFIG.colors.bg, {
        o: 0.8,
      }),
    );

    // Borders for depth effect
    container.appendChild(
      this._plane(1.04, 0.26, HUD_CONFIG.colors.borderOuter, {
        o: 0.35,
        z: -0.01,
      }),
    );
    container.appendChild(
      this._plane(1.02, 0.24, HUD_CONFIG.colors.borderMid, {
        o: 0.15,
        z: -0.015,
      }),
    );
    container.appendChild(
      this._plane(1.0, 0.22, HUD_CONFIG.colors.borderInner, {
        o: 0.08,
        z: -0.02,
      }),
    );

    // Top accent line
    container.appendChild(
      this._plane(1.0, 0.015, HUD_CONFIG.colors.borderOuter, {
        o: 0.5,
        z: 0.01,
        y: 0.095,
      }),
    );

    // Message text element
    const textEl = document.createElement("a-entity");
    textEl.id = "tutorial-message";
    // Width 0.85 ensures text stays within 85% of HUD width
    textEl.setAttribute(
      "text",
      `value: ; align: center; width: 0.85; fontSize: 20; color: #FFFFFF; wrapCount: 30; anchor: center; ${HUD_MSDF_FONT}`,
    );
    textEl.setAttribute("position", "0 0 0.02");
    container.appendChild(textEl);

    camera.appendChild(container);
    this.hudEntity = container;
    this.messageText = textEl;
    this.hideHUD();
  },

  /**
   * Helper to create a-plane elements with optional positioning.
   *
   * @param {number} w - Width in meters
   * @param {number} h - Height in meters
   * @param {string} c - Hex color code
   * @param {Object} opts - Options: o (opacity), z (z-offset), y (y-offset)
   * @returns {Element} Configured a-plane element
   */
  _plane: function (w, h, c, opts = {}) {
    const p = document.createElement("a-plane");
    p.setAttribute("width", w.toString());
    p.setAttribute("height", h.toString());
    p.setAttribute("color", c);
    p.setAttribute(
      "material",
      `transparent: true; opacity: ${opts.o || 1}; side: double`,
    );
    if (opts.z !== undefined || opts.y !== undefined) {
      p.setAttribute("position", `0 ${opts.y || 0} ${opts.z || 0}`);
    }
    return p;
  },

  /**
   * Adds a message to the queue for sequential display.
   * If no message is currently showing, displays immediately.
   *
   * @param {string} message - Text content to display
   * @param {number} duration - Display duration in milliseconds (default: 5000)
   */
  show: function (message, duration = 5000) {
    console.log("[TutorialHUD] Queued:", message);
    this.messages.push({ text: message, duration });
    this._processQueue();
  },

  /**
   * Dequeues and displays next message if none is currently showing.
   */
  _processQueue: function () {
    if (this.currentMessage || this.messages.length === 0) return;
    this.currentMessage = this.messages.shift();
    this._displayMessage(
      this.currentMessage.text,
      this.currentMessage.duration,
    );
  },

  /**
   * Updates text element and shows HUD for specified duration.
   * After timeout, hides HUD and processes next queued message.
   */
  _displayMessage: function (text, duration) {
    if (!this.messageText) return;
    this.messageText.setAttribute("text", "value", text);
    this.showHUD();
    console.log("[TutorialHUD] Displaying:", text);

    if (this.messageTimeout) clearTimeout(this.messageTimeout);
    this.messageTimeout = setTimeout(() => {
      this.hideHUD();
      this.currentMessage = null;
      this._processQueue();
    }, duration);
  },

  /**
   * Makes HUD visible by setting visible attribute to true.
   */
  showHUD: function () {
    if (this.hudEntity) this.hudEntity.setAttribute("visible", true);
  },

  /**
   * Hides HUD by setting visible attribute to false.
   */
  hideHUD: function () {
    if (this.hudEntity) this.hudEntity.setAttribute("visible", false);
  },

  remove: function () {
    if (this.messageTimeout) clearTimeout(this.messageTimeout);
    if (this.hudEntity && this.hudEntity.parentNode) {
      this.hudEntity.parentNode.removeChild(this.hudEntity);
    }
  },
});
