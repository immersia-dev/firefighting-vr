AFRAME.registerComponent('lod-model', {
  schema: {
    high: { type: 'string' }, // e.g. #model-hangar
    low: { type: 'string' },  // e.g. /assets/hangar_low.glb
    quality: { type: 'string', default: 'auto' }, // 'high' | 'low' | 'auto'
  },

  init() {
    const choice = this._pickQuality();
    const src = choice === 'low' && this.data.low ? this.data.low : this.data.high;
    if (src) this.el.setAttribute('gltf-model', src);

    // Optional: toggle via URL ?quality=low|high
    const urlQ = new URLSearchParams(location.search).get('quality');
    if (urlQ === 'low' || urlQ === 'high') {
      const forced = urlQ;
      const forcedSrc = forced === 'low' && this.data.low ? this.data.low : this.data.high;
      if (forcedSrc) this.el.setAttribute('gltf-model', forcedSrc);
    }
  },

  _pickQuality() {
    const q = this.data.quality;
    if (q === 'high' || q === 'low') return q;

    // Auto heuristics: prefer LOW for mobile/VR/integrated GPUs; HIGH otherwise
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isVR = this.el.sceneEl && this.el.sceneEl.is('vr-mode');
    const rendererStr = this._getRendererString();
    const isIntegrated = rendererStr && /intel|iris|uhd|radeon\svega/i.test(rendererStr);

    if (isMobile || isVR || isIntegrated) return 'low';
    return 'high';
  },

  _getRendererString() {
    try {
      const gl = this.el.sceneEl.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return null;
      return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
    } catch (e) {
      return null;
    }
  }
});
