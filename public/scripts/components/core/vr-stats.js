AFRAME.registerComponent('vr-stats', {
  schema: {
    updateInterval: { type: 'number', default: 0.5 }, // seconds
    position: { type: 'vec3', default: { x: 0, y: -0.32, z: -1.05 } },
  },

  init() {
    // Only initialize if debug mode is enabled
    if (!window.DEBUG_CONFIG || !window.DEBUG_CONFIG.SHOW_STATS) {
      return;
    }

    this.scene = this.el.sceneEl;
    this.renderer = this.scene.renderer;
    this._accum = 0;
    this._frames = 0;
    this._last = performance.now();
    this._textEl = null;
    this._hud = null;

    const setupHUD = () => {
      const camEl = this.scene.camera && this.scene.camera.el;
      if (!camEl) return;

      // Create a small HUD fixed to the camera
      const hud = document.createElement('a-entity');
      hud.setAttribute('position', `${this.data.position.x} ${this.data.position.y} ${this.data.position.z}`);
      hud.setAttribute('rotation', '0 0 0');

      const bg = document.createElement('a-plane');
      bg.setAttribute('width', 0.62);
      bg.setAttribute('height', 0.18);
      bg.setAttribute('material', 'shader: flat; color: #000; transparent: true; opacity: 0.55');
      bg.setAttribute('position', '0 0 0');
      hud.appendChild(bg);

      const text = document.createElement('a-entity');
      text.setAttribute('text', [
        'value: …',
        'align: center',
        'anchor: center',
        'color: #FFFFFF',
        'width: 1.2',
        'font: #font-msdf',
        'fontImage: #font-image',
      ].join('; '));
      text.setAttribute('position', '0 0 0.001');
      hud.appendChild(text);

      camEl.appendChild(hud);
      this._textEl = text;
      this._hud = hud;
    };

    if (this.scene.hasLoaded) {
      setupHUD();
    } else {
      this.scene.addEventListener('loaded', setupHUD);
    }
  },

  remove() {
    if (this._hud && this._hud.parentElement) {
      this._hud.parentElement.removeChild(this._hud);
    }
    this._hud = null;
    this._textEl = null;
  },

  tick() {
    if (!window.DEBUG_CONFIG || !window.DEBUG_CONFIG.SHOW_STATS || !this._textEl) {
      return;
    }

    const now = performance.now();
    const dt = (now - this._last) / 1000;
    this._last = now;
    this._accum += dt;
    this._frames++;

    if (this._accum < this.data.updateInterval) return;

    const fps = Math.round(this._frames / this._accum);
    this._accum = 0;
    this._frames = 0;

    const info = this.renderer && this.renderer.info ? this.renderer.info : null;
    const calls = info && info.render ? info.render.calls : 0;
    const triangles = info && info.render ? info.render.triangles : 0;

    if (this._textEl) {
      const isVR = this.scene.is('vr-mode');
      const msg = `FPS: ${fps}  |  Draw Calls: ${calls}  |  Tris: ${triangles}`;
      // In VR show if allowed by config; outside VR always show if enabled
      if (!isVR || (isVR && window.DEBUG_CONFIG.SHOW_STATS_IN_VR)) {
        this._textEl.setAttribute('text', 'value: ' + msg + '; align: center; anchor: center; color: #FFFFFF; width: 1.2; font: #font-msdf; fontImage: #font-image');
        this._hud.setAttribute('visible', true);
      } else {
        this._hud.setAttribute('visible', false);
      }
    }
  }
});
