/**
 * Interactive Panels Component
 *
 * Creates modal VR panels with raycaster-driven buttons.
 * Locks player movement while a panel is visible.
 *
 * Depends on: ui-helpers.js (window.UI_HELPERS)
 *
 * Usage:
 *   const panels = document.querySelector("[interactive-panels]")
 *                          .components["interactive-panels"];
 *   panels.showPanel("intro", { toMovement: () => { … } });
 */

const PANEL_STYLE = {
  width: 2.4,
  height: 1.2,
  position: { x: 0, y: 0, z: -2 },
  borders: [
    { w: 2.46, h: 1.26, c: "#A855F7", o: 0.35, z: -0.01 },
    { w: 2.44, h: 1.24, c: "#2A2CFF", o: 0.15, z: -0.015 },
    { w: 2.4, h: 1.2, c: "#FFFFFF", o: 0.08, z: -0.02 },
  ],
  contentWidth: 2.0,
};

AFRAME.registerComponent("interactive-panels", {
  schema: { enabled: { type: "boolean", default: true } },

  init: function () {
    window.debugLog("InteractivePanels", "Initializing");
    this.scene = this.el.sceneEl;
    this.currentPanel = null;
    this.panels = {};
    this.callbacks = {};
    this.isLocked = false;
    this._setupPanels();
    this._setupControllerListeners();
  },

  /**
   * Defines panel content for intro and movement selection screens.
   * Each panel has title, subtitle, description, and action buttons.
   */
  _setupPanels: function () {
    this.panels = {
      intro: {
        title: "TREINAMENTO DE COMBATE A INCÊNDIO",
        subtitle: "Bem-vindo ao Simulador VR",
        description:
          "Este treinamento irá guiá-lo através dos passos essenciais para combater um incêndio com segurança.",
        buttons: [{ text: "COMEÇAR", action: "toMovement", color: "#A855F7" }],
      },
      movement_select: {
        title: "SELECIONE O MODO DE MOVIMENTO",
        subtitle: "Como você prefere se mover?",
        description: "",
        buttons: [
          { text: "🎮  ANALÓGICO", action: "analogMovement", color: "#3B82F6" },
          {
            text: "📍  TELEPORTE",
            action: "teleportMovement",
            color: "#10B981",
          },
        ],
      },
    };
  },

  /**
   * Attaches click event listeners to left and right hand controllers.
   * When controller triggers click, passes intersected element to click handler.
   */
  _setupControllerListeners: function () {
    const self = this;
    ["#right-hand-controller", "#left-hand-controller"].forEach((selector) => {
      const ctrl = document.querySelector(selector);
      if (ctrl)
        ctrl.addEventListener("click", (e) =>
          self._handleClick(e.detail.intersectedEl),
        );
    });
  },

  /**
   * Processes button clicks by reading data-panel-action attribute.
   * Executes corresponding callback function if registered.
   */
  _handleClick: function (element) {
    if (!element) return;
    const action = element.getAttribute("data-panel-action");
    if (action && this.callbacks[action]) {
      window.debugLog("InteractivePanels", "Action:", action);
      this.callbacks[action]();
    }
  },

  /**
   * Displays a modal panel and registers button action callbacks.
   * Clears any existing panel, locks movement, and builds visual structure.
   *
   * @param {string} panelId - Panel identifier (intro, movement_select)
   * @param {Object} callbacks - Map of action names to callback functions
   */
  showPanel: function (panelId, callbacks) {
    const panel = this.panels[panelId];
    if (!panel) {
      console.warn("[InteractivePanels] Panel not found:", panelId);
      return;
    }
    window.debugLog("InteractivePanels", "Showing:", panelId);
    this.callbacks = callbacks || {};
    this.clearPanel();
    this.lockMovement();
    const camera = document.querySelector("#camera");
    const container = document.createElement("a-entity");
    container.id = "interactive-panel";
    container.setAttribute(
      "position",
      `${PANEL_STYLE.position.x} ${PANEL_STYLE.position.y} ${PANEL_STYLE.position.z}`,
    );
    this._buildVisuals(container);
    this._buildContent(container, panel);
    camera.appendChild(container);
    this.currentPanel = container;
  },

  /**
   * Constructs panel background and multi-layered borders.
   * Creates glassmorphism effect with 3 border layers and accent lines.
   */
  _buildVisuals: function (container) {
    const _p = window.UI_HELPERS.createPlane;

    // Main background
    container.appendChild(_p(PANEL_STYLE.width, PANEL_STYLE.height, "#070615", { o: 0.75 }));

    // Borders
    PANEL_STYLE.borders.forEach((b) => {
      container.appendChild(_p(b.w, b.h, b.c, { o: b.o, z: b.z }));
    });

    // Accent lines
    container.appendChild(_p(2.4, 0.02, "#A855F7", { o: 0.5, z: 0.01, y: 0.55 }));
    container.appendChild(_p(2.4, 0.015, "#2A2CFF", { o: 0.3, z: 0.01, y: -0.55 }));
  },

  /**
   * Adds title, subtitle, description, and buttons to panel.
   * Text is constrained to 85% of panel width with proper wrapping.
   */
  _buildContent: function (container, panel) {
    this._text(container, panel.title, 0.38, 32, "#FFFFFF");
    if (panel.subtitle)
      this._text(container, panel.subtitle, 0.2, 22, "#A855F7");
    if (panel.description)
      this._text(container, panel.description, 0, 18, "#E5E7EB");
    const btnCount = panel.buttons.length;
    const spacing = btnCount > 1 ? 0.7 : 0;
    const startX = ((btnCount - 1) * spacing) / 2;
    panel.buttons.forEach((btn, i) =>
      this._button(container, btn, startX - i * spacing, -0.38),
    );
  },

  /**
   * Creates an interactive button with hover effects.
   * Adds .interactable class for raycaster detection.
   *
   * @param {Element} parent - Parent container element
   * @param {Object} cfg - Button config (text, action, color)
   * @param {number} x - X position offset
   * @param {number} y - Y position offset
   */
  _button: function (parent, cfg, x, y) {
    const btn = document.createElement("a-plane");
    btn.setAttribute("width", "0.6");
    btn.setAttribute("height", "0.15");
    btn.setAttribute("color", cfg.color);
    btn.setAttribute("position", `${x} ${y} 0.02`);
    btn.setAttribute(
      "material",
      "transparent: true; opacity: 0.8; side: double",
    );
    btn.classList.add("interactable");
    btn.setAttribute("data-panel-action", cfg.action);
    btn.appendChild(window.UI_HELPERS.createPlane(0.63, 0.18, "#FFFFFF", { o: 0.15, z: -0.01 }));
    const txt = document.createElement("a-entity");
    txt.setAttribute(
      "text",
      `value: ${cfg.text}; align: center; fontSize: 16; color: #FFFFFF; width: 1.5; anchor: center; ${window.UI_HELPERS.MSDF_FONT}`,
    );
    txt.setAttribute("position", "0 0 0.02");
    txt.setAttribute("pointer-events", "none");
    btn.appendChild(txt);
    btn.addEventListener("mouseenter", () => {
      btn.setAttribute("material", "opacity: 1");
      btn.setAttribute("scale", "1.05 1.05 1");
    });
    btn.addEventListener("mouseleave", () => {
      btn.setAttribute("material", "opacity: 0.8");
      btn.setAttribute("scale", "1 1 1");
    });
    parent.appendChild(btn);
  },

  /**
   * Creates a text entity with specified styling and position.
   * Text automatically wraps to stay within 85% of panel width.
   *
   * @param {Element} container - Parent element
   * @param {string} text - Text content
   * @param {number} y - Vertical position
   * @param {number} size - Font size in pixels
   * @param {string} color - Hex color code
   */
  _text: function (container, text, y, size, color) {
    const entity = document.createElement("a-entity");
    // Width 0.85 ensures text stays within 85% of panel (0.85 units)
    entity.setAttribute(
      "text",
      `value: ${text}; align: center; width: ${PANEL_STYLE.contentWidth}; fontSize: ${size}; color: ${color}; wrapCount: 45; anchor: center; ${window.UI_HELPERS.MSDF_FONT}`,
    );
    entity.setAttribute("position", `0 ${y} 0.02`);
    container.appendChild(entity);
  },

  /**
   * Disables player movement by setting enabled:false on movement components.
   * Affects both movement-controller and movement-controls on rig.
   */
  lockMovement: function () {
    window.debugLog("InteractivePanels", "Locking movement");
    this.isLocked = true;
    const movCtrl = document.querySelector("[movement-controller]");
    if (movCtrl) movCtrl.setAttribute("movement-controller", "enabled: false");
    const rig = document.querySelector("#rig");
    if (rig && rig.hasAttribute("movement-controls"))
      rig.setAttribute("movement-controls", "enabled: false");
  },

  /**
   * Re-enables player movement by setting enabled:true on movement components.
   */
  unlockMovement: function () {
    window.debugLog("InteractivePanels", "Unlocking movement");
    this.isLocked = false;
    const movCtrl = document.querySelector("[movement-controller]");
    if (movCtrl) movCtrl.setAttribute("movement-controller", "enabled: true");
    const rig = document.querySelector("#rig");
    if (rig && rig.hasAttribute("movement-controls"))
      rig.setAttribute("movement-controls", "enabled: true");
  },

  /**
   * Removes current panel element from DOM and clears reference.
   */
  clearPanel: function () {
    if (this.currentPanel) {
      this.currentPanel.parentNode.removeChild(this.currentPanel);
      this.currentPanel = null;
    }
  },

  remove: function () {
    this.clearPanel();
    this.unlockMovement();
  },
});
