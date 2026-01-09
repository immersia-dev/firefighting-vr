AFRAME.registerComponent('hand-scalable', {
  schema: {
    enabled: { type: 'boolean', default: true },
    scaleSpeed: { type: 'number', default: 0.5 },
    minScale: { type: 'number', default: 0.1 },
    maxScale: { type: 'number', default: 10.0 },
    uniform: { type: 'boolean', default: true }
  },

  init: function () {
    this.scalableObject = null;
    this.isScaling = false;
    this.initialDistance = 0;
    this.initialScale = new THREE.Vector3();
    this.leftHandGrabbing = false;
    this.rightHandGrabbing = false;
    this.lastUpdateTime = 0;
    this.lastEventTime = 0;
    
    this.rightHand = document.querySelector('#right-hand-tracking');
    this.leftHand = document.querySelector('#left-hand-tracking');
    
    this.onGrabStart = this.onGrabStart.bind(this);
    this.onGrabEnd = this.onGrabEnd.bind(this);
    
    this.el.addEventListener('grab-start', this.onGrabStart);
    this.el.addEventListener('grab-end', this.onGrabEnd);
  },

  onGrabStart: function (evt) {
    if (!this.data.enabled) return;
    
    const hand = evt.detail.hand;
    
    if (hand === 'left') {
      this.leftHandGrabbing = true;
    } else if (hand === 'right') {
      this.rightHandGrabbing = true;
    }
    
    if (this.leftHandGrabbing && this.rightHandGrabbing) {
      this.startScaling();
    }
  },

  onGrabEnd: function (evt) {
    const hand = evt.detail.hand;
    
    if (hand === 'left') {
      this.leftHandGrabbing = false;
    } else if (hand === 'right') {
      this.rightHandGrabbing = false;
    }
    
    if (this.isScaling && (!this.leftHandGrabbing || !this.rightHandGrabbing)) {
      this.stopScaling();
    }
  },

  startScaling: function () {
    if (!this.leftHand || !this.rightHand) return;
    
    this.scalableObject = this.el;
    this.isScaling = true;
    
    this.initialScale.copy(this.scalableObject.object3D.scale);
    
    this.initialDistance = this.calculateHandsDistance();
    
    this.el.emit('hand-scale-start');
  },

  stopScaling: function () {
    if (!this.isScaling) return;
    
    this.scalableObject = null;
    this.isScaling = false;
    this.initialDistance = 0;
    
    this.el.emit('hand-scale-end');
  },

  calculateHandsDistance: function () {
    if (!this.leftHand || !this.rightHand) return 0;
    
    const leftPos = new THREE.Vector3();
    const rightPos = new THREE.Vector3();
    
    this.leftHand.object3D.getWorldPosition(leftPos);
    this.rightHand.object3D.getWorldPosition(rightPos);
    
    return leftPos.distanceTo(rightPos);
  },

  tick: function (time, timeDelta) {
    if (!this.isScaling || !this.scalableObject) return;
    if (!this.leftHandGrabbing || !this.rightHandGrabbing) return;
    
    if (!this.lastUpdateTime) {
      this.lastUpdateTime = time;
    }
    
    const timeSinceLastUpdate = time - this.lastUpdateTime;
    if (timeSinceLastUpdate < 16) {
      return;
    }
    
    this.lastUpdateTime = time;
    
    const currentDistance = this.calculateHandsDistance();
    
    if (this.initialDistance === 0) {
      this.initialDistance = currentDistance;
      return;
    }
    
    const distanceDelta = currentDistance - this.initialDistance;
    const scaleFactor = 1 + (distanceDelta * this.data.scaleSpeed);
    
    if (this.data.uniform) {
      const newScale = this.initialScale.x * scaleFactor;
      const clampedScale = Math.max(this.data.minScale, Math.min(this.data.maxScale, newScale));
      this.scalableObject.object3D.scale.set(clampedScale, clampedScale, clampedScale);
    } else {
      const newScaleX = this.initialScale.x * scaleFactor;
      const newScaleY = this.initialScale.y * scaleFactor;
      const newScaleZ = this.initialScale.z * scaleFactor;
      
      this.scalableObject.object3D.scale.set(
        Math.max(this.data.minScale, Math.min(this.data.maxScale, newScaleX)),
        Math.max(this.data.minScale, Math.min(this.data.maxScale, newScaleY)),
        Math.max(this.data.minScale, Math.min(this.data.maxScale, newScaleZ))
      );
    }
    
    if (!this.lastEventTime || time - this.lastEventTime > 100) {
      this.lastEventTime = time;
      this.el.emit('hand-scale', { 
        scaleFactor: scaleFactor,
        currentScale: this.scalableObject.object3D.scale.clone()
      });
    }
  },

  remove: function () {
    this.el.removeEventListener('grab-start', this.onGrabStart);
    this.el.removeEventListener('grab-end', this.onGrabEnd);
    
    if (this.isScaling) {
      this.stopScaling();
    }
  }
});

