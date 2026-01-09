AFRAME.registerComponent('hand-rotatable', {
  schema: {
    enabled: { type: 'boolean', default: true },
    rotationSpeed: { type: 'number', default: 2.0 },
    axis: { type: 'string', default: 'y' }
  },

  init: function () {
    this.rotatableObject = null;
    this.isRotating = false;
    this.grabbingHand = null;
    this.lastHandPosition = new THREE.Vector3();
    this.rotationAxis = new THREE.Vector3();
    this.lastUpdateTime = 0;
    
    this.rightHand = document.querySelector('#right-hand-tracking');
    this.leftHand = document.querySelector('#left-hand-tracking');
    
    this.onGrabStart = this.onGrabStart.bind(this);
    this.onGrabEnd = this.onGrabEnd.bind(this);
    this.onHandMove = this.onHandMove.bind(this);
    
    this.el.addEventListener('grab-start', this.onGrabStart);
    this.el.addEventListener('grab-end', this.onGrabEnd);
    
    this.setupRotationAxis();
  },

  setupRotationAxis: function () {
    const axis = this.data.axis.toLowerCase();
    this.rotationAxis.set(0, 0, 0);
    
    if (axis.includes('x')) this.rotationAxis.x = 1;
    if (axis.includes('y')) this.rotationAxis.y = 1;
    if (axis.includes('z')) this.rotationAxis.z = 1;
    
    if (this.rotationAxis.length() === 0) {
      this.rotationAxis.y = 1;
    }
  },

  onGrabStart: function (evt) {
    if (!this.data.enabled) return;
    
    const hand = evt.detail.hand;
    const handEntity = hand === 'right' ? this.rightHand : this.leftHand;
    
    if (!handEntity) return;
    
    this.rotatableObject = this.el;
    this.isRotating = true;
    this.grabbingHand = handEntity;
    
    handEntity.object3D.getWorldPosition(this.lastHandPosition);
    
    this.el.emit('hand-rotate-start', { hand: hand });
  },

  onGrabEnd: function (evt) {
    if (!this.isRotating) return;
    
    const hand = this.grabbingHand === this.rightHand ? 'right' : 'left';
    
    this.rotatableObject = null;
    this.isRotating = false;
    this.grabbingHand = null;
    
    this.el.emit('hand-rotate-end', { hand: hand });
  },

  onHandMove: function () {
    if (!this.isRotating || !this.rotatableObject || !this.grabbingHand) return;
    
    const currentHandPosition = new THREE.Vector3();
    this.grabbingHand.object3D.getWorldPosition(currentHandPosition);
    
    const delta = new THREE.Vector3();
    delta.subVectors(currentHandPosition, this.lastHandPosition);
    
    let rotationDelta = 0;
    
    if (this.rotationAxis.y === 1) {
      rotationDelta = delta.x * this.data.rotationSpeed;
      this.rotatableObject.object3D.rotation.y += rotationDelta;
    }
    
    if (this.rotationAxis.x === 1) {
      rotationDelta = delta.y * this.data.rotationSpeed;
      this.rotatableObject.object3D.rotation.x += rotationDelta;
    }
    
    if (this.rotationAxis.z === 1) {
      rotationDelta = (delta.x + delta.y) * 0.5 * this.data.rotationSpeed;
      this.rotatableObject.object3D.rotation.z += rotationDelta;
    }
    
    this.lastHandPosition.copy(currentHandPosition);
  },

  tick: function (time, timeDelta) {
    if (!this.isRotating || !this.rotatableObject || !this.grabbingHand) {
      return;
    }
    
    if (!this.lastUpdateTime) {
      this.lastUpdateTime = time;
    }
    
    const timeSinceLastUpdate = time - this.lastUpdateTime;
    if (timeSinceLastUpdate < 16) {
      return;
    }
    
    this.lastUpdateTime = time;
    this.onHandMove();
  },

  update: function () {
    this.setupRotationAxis();
  },

  remove: function () {
    this.el.removeEventListener('grab-start', this.onGrabStart);
    this.el.removeEventListener('grab-end', this.onGrabEnd);
    
    if (this.isRotating) {
      this.onGrabEnd({});
    }
  }
});

