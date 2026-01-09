AFRAME.registerComponent('interaction-mode-manager', {
  schema: {
    mode: { 
      type: 'string', 
      default: 'controllers',
      oneOf: ['controllers', 'hand-tracking']
    },
    autoDetect: { type: 'boolean', default: false }
  },

  init: function () {
    this.rightHandTracking = document.querySelector('#right-hand-tracking');
    this.leftHandTracking = document.querySelector('#left-hand-tracking');
    this.rightHandController = document.querySelector('#right-hand-controller');
    this.leftHandController = document.querySelector('#left-hand-controller');
    
    this.setMode(this.data.mode);
    
    this.onModeChange = this.onModeChange.bind(this);
    this.el.addEventListener('set-interaction-mode', this.onModeChange);
    
    if (this.data.autoDetect) {
      this.detectAndSetMode();
    }
    
    this.el.setInteractionMode = this.setMode.bind(this);
  },

  onModeChange: function (evt) {
    const newMode = evt.detail?.mode;
    if (newMode && (newMode === 'controllers' || newMode === 'hand-tracking')) {
      this.setMode(newMode);
    }
  },

  setMode: function (mode) {
    if (mode !== 'controllers' && mode !== 'hand-tracking') {
      return;
    }
    
    this.data.mode = mode;
    
    if (mode === 'controllers') {
      if (this.rightHandController) {
        this.rightHandController.setAttribute('raycaster', 'enabled', true);
        if (this.rightHandController.components.line) {
          this.rightHandController.setAttribute('line', 'opacity', 0.95);
        }
      }
      if (this.leftHandController) {
        this.leftHandController.setAttribute('raycaster', 'enabled', true);
        if (this.leftHandController.components.line) {
          this.leftHandController.setAttribute('line', 'opacity', 0.4);
        }
      }
      
      if (this.rightHandTracking) {
        this.rightHandTracking.setAttribute('raycaster', 'enabled', false);
        this.rightHandTracking.setAttribute('hand-tracking-grab-controls', 'enabled', false);
        this.rightHandTracking.setAttribute('visible', false);
      }
      if (this.leftHandTracking) {
        this.leftHandTracking.setAttribute('raycaster', 'enabled', false);
        this.leftHandTracking.setAttribute('hand-tracking-grab-controls', 'enabled', false);
        this.leftHandTracking.setAttribute('visible', false);
      }
    } else {
      if (this.rightHandTracking) {
        this.rightHandTracking.setAttribute('raycaster', 'enabled', true);
        this.rightHandTracking.setAttribute('hand-tracking-grab-controls', 'enabled', true);
        this.rightHandTracking.setAttribute('visible', true);
      }
      if (this.leftHandTracking) {
        this.leftHandTracking.setAttribute('raycaster', 'enabled', true);
        this.leftHandTracking.setAttribute('hand-tracking-grab-controls', 'enabled', true);
        this.leftHandTracking.setAttribute('visible', true);
      }
      
      if (this.rightHandController) {
        this.rightHandController.setAttribute('raycaster', 'enabled', false);
        if (this.rightHandController.components.line) {
          this.rightHandController.setAttribute('line', 'opacity', 0);
        }
      }
      if (this.leftHandController) {
        this.leftHandController.setAttribute('raycaster', 'enabled', false);
        if (this.leftHandController.components.line) {
          this.leftHandController.setAttribute('line', 'opacity', 0);
        }
      }
    }
    
    this.el.emit('interaction-mode-changed', { mode: mode });
  },

  detectAndSetMode: function () {
    this.setMode('controllers');
  },

  update: function () {
    if (this.oldData && this.oldData.mode !== this.data.mode) {
      this.setMode(this.data.mode);
    }
  },

  remove: function () {
    this.el.removeEventListener('set-interaction-mode', this.onModeChange);
  }
});

