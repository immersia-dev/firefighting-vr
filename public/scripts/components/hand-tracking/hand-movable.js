AFRAME.registerComponent('hand-movable', {
  schema: {
    enabled: { type: 'boolean', default: true },
    constraint: { type: 'string', default: '' }
  },

  init: function () {
    this.movableObject = null;
    this.isGrabbed = false;
    this.grabbingHand = null;
    this.initialOffset = new THREE.Vector3();
    
    this.rightHand = document.querySelector('#right-hand-tracking');
    this.leftHand = document.querySelector('#left-hand-tracking');
    
    this.onGrabStart = this.onGrabStart.bind(this);
    this.onGrabEnd = this.onGrabEnd.bind(this);
    
    this.el.addEventListener('grab-start', this.onGrabStart);
    this.el.addEventListener('grab-end', this.onGrabEnd);
    
    if (this.rightHand) {
      this.rightHand.addEventListener('pinchstarted', (evt) => {
        this.checkAndGrab('right', this.rightHand, evt);
      });
      
      this.rightHand.addEventListener('pinchended', (evt) => {
        if (this.isGrabbed && this.grabbingHand === this.rightHand) {
          this.onGrabEnd(evt);
        }
      });
    }
    
    if (this.leftHand) {
      this.leftHand.addEventListener('pinchstarted', (evt) => {
        this.checkAndGrab('left', this.leftHand, evt);
      });
      
      this.leftHand.addEventListener('pinchended', (evt) => {
        if (this.isGrabbed && this.grabbingHand === this.leftHand) {
          this.onGrabEnd(evt);
        }
      });
    }
  },

  checkAndGrab: function (hand, handEntity, evt) {
    if (!this.data.enabled) return;
    if (this.isGrabbed) return;
    
    if (!this.el.hasAttribute('grabbable')) {
      return;
    }
    
    const handWorldPos = new THREE.Vector3();
    const objectWorldPos = new THREE.Vector3();
    
    handEntity.object3D.getWorldPosition(handWorldPos);
    this.el.object3D.getWorldPosition(objectWorldPos);
    
    const distance = handWorldPos.distanceTo(objectWorldPos);
    
    if (distance < 0.3) {
      this.onGrabStart({ detail: { hand: hand } });
    }
  },

  onGrabStart: function (evt) {
    if (!this.data.enabled) {
      return;
    }
    
    if (this.isGrabbed) {
      return;
    }
    
    let hand = evt.detail?.hand;
    let handEntity = null;
    
    if (hand) {
      handEntity = hand === 'right' ? this.rightHand : this.leftHand;
    } else {
      const rightHandPos = new THREE.Vector3();
      const leftHandPos = new THREE.Vector3();
      const objectPos = new THREE.Vector3();
      
      this.rightHand?.object3D.getWorldPosition(rightHandPos);
      this.leftHand?.object3D.getWorldPosition(leftHandPos);
      this.el.object3D.getWorldPosition(objectPos);
      
      const distToRight = rightHandPos.distanceTo(objectPos);
      const distToLeft = leftHandPos.distanceTo(objectPos);
      
      if (distToRight < distToLeft && distToRight < 0.5) {
        hand = 'right';
        handEntity = this.rightHand;
      } else if (distToLeft < 0.5) {
        hand = 'left';
        handEntity = this.leftHand;
      } else {
        return;
      }
    }
    
    if (!handEntity) {
      return;
    }
    
    this.movableObject = this.el;
    this.isGrabbed = true;
    this.grabbingHand = handEntity;
    
    const objectWorldPos = new THREE.Vector3();
    const objectWorldQuat = new THREE.Quaternion();
    const objectWorldScale = new THREE.Vector3();
    
    this.movableObject.object3D.getWorldPosition(objectWorldPos);
    this.movableObject.object3D.getWorldQuaternion(objectWorldQuat);
    this.movableObject.object3D.getWorldScale(objectWorldScale);
    
    const handWorldPos = new THREE.Vector3();
    handEntity.object3D.getWorldPosition(handWorldPos);
    
    this.initialOffset.subVectors(objectWorldPos, handWorldPos);
    
    const localPos = new THREE.Vector3();
    const localQuat = new THREE.Quaternion();
    const localScale = new THREE.Vector3();
    
    handEntity.object3D.worldToLocal(objectWorldPos.clone(), localPos);
    handEntity.object3D.worldToLocal(objectWorldQuat.clone(), localQuat);
    
    handEntity.object3D.attach(this.movableObject.object3D);
    
    this.movableObject.object3D.position.copy(this.initialOffset);
    this.movableObject.object3D.quaternion.copy(localQuat);
    this.movableObject.object3D.scale.copy(objectWorldScale);
    
    this.el.emit('hand-move-start', { hand: hand || 'unknown' });
  },

  onGrabEnd: function (evt) {
    if (!this.isGrabbed || !this.movableObject) {
      return;
    }
    
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    
    this.movableObject.object3D.getWorldPosition(worldPosition);
    this.movableObject.object3D.getWorldQuaternion(worldQuaternion);
    
    this.movableObject.sceneEl.object3D.attach(this.movableObject.object3D);
    
    this.movableObject.object3D.position.copy(worldPosition);
    this.movableObject.object3D.quaternion.copy(worldQuaternion);
    
    this.applyConstraints();
    
    const hand = this.grabbingHand === this.rightHand ? 'right' : 'left';
    
    if (this.grabbingHand) {
      const grabControls = this.grabbingHand.components['hand-tracking-grab-controls'];
      if (grabControls && grabControls.data) {
        const originalColor = grabControls.data.color || '#ffffff';
        this.grabbingHand.setAttribute('hand-tracking-grab-controls', 'hoverColor', originalColor);
      }
    }
    
    this.movableObject = null;
    this.isGrabbed = false;
    this.grabbingHand = null;
    
    this.el.emit('hand-move-end', { hand: hand });
  },

  applyConstraints: function () {
    if (!this.data.constraint || !this.movableObject) return;
    
    const pos = this.movableObject.object3D.position;
    const constraints = this.data.constraint.toLowerCase();
    
    if (!constraints.includes('x')) pos.x = 0;
    if (!constraints.includes('y')) pos.y = 0;
    if (!constraints.includes('z')) pos.z = 0;
  },

  remove: function () {
    this.el.removeEventListener('grab-start', this.onGrabStart);
    this.el.removeEventListener('grab-end', this.onGrabEnd);
    
    if (this.isGrabbed) {
      this.onGrabEnd({});
    }
  }
});

