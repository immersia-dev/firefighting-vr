AFRAME.registerComponent('hand-color-manager', {
  schema: {
    originalColor: { type: 'string', default: '#ffffff' },
    hoverColor: { type: 'string', default: '#00ff00' }
  },

  init: function () {
    const grabControls = this.el.components['hand-tracking-grab-controls'];
    if (grabControls && grabControls.data) {
      this.data.originalColor = grabControls.data.color || this.data.originalColor;
      this.data.hoverColor = grabControls.data.hoverColor || this.data.hoverColor;
    }
    
    this.onHoverStart = this.onHoverStart.bind(this);
    this.onHoverEnd = this.onHoverEnd.bind(this);
    this.onGrabStart = this.onGrabStart.bind(this);
    this.onGrabEnd = this.onGrabEnd.bind(this);
    
    this.el.addEventListener('hover-start', this.onHoverStart);
    this.el.addEventListener('hover-end', this.onHoverEnd);
    this.el.addEventListener('grab-start', this.onGrabStart);
    this.el.addEventListener('grab-end', this.onGrabEnd);
    
    this.el.addEventListener('pinchstarted', (evt) => {
    });
    
    this.el.addEventListener('pinchended', (evt) => {
      this.resetColor();
    });
  },

  onHoverStart: function (evt) {
  },

  onHoverEnd: function (evt) {
    this.resetColor();
  },

  onGrabStart: function (evt) {
  },

  onGrabEnd: function (evt) {
    this.resetColor();
  },

  resetColor: function () {
    const grabControls = this.el.components['hand-tracking-grab-controls'];
    if (grabControls) {
    }
  },

  remove: function () {
    this.el.removeEventListener('hover-start', this.onHoverStart);
    this.el.removeEventListener('hover-end', this.onHoverEnd);
    this.el.removeEventListener('grab-start', this.onGrabStart);
    this.el.removeEventListener('grab-end', this.onGrabEnd);
  }
});

