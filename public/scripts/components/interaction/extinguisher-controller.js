/**
 * Extinguisher Controller Component
 * 
 * Gerencia interação realista com extintor:
 * - Lacre pode ser removido (desaparece)
 * - Corpo segue a mão que segura
 * - Mangueira segue dinâmicamente entre nozzle e ponta
 */

AFRAME.registerComponent('extinguisher-controller', {
  schema: {
    bodyModel: { type: 'selector' },      // #extintor_body
    sealModel: { type: 'selector' },      // #extintor_seal (remove on interact)
    hoseModel: { type: 'selector' },      // #extintor_hose
    sealRemovalDistance: { type: 'number', default: 0.3 }, // distance to trigger removal
    enabled: { type: 'boolean', default: true }
  },

  init: function () {
    this.sealRemoved = false;
    this.isGripped = false;
    this.isSprayingActive = false;
    this.hoseEndWorldPos = new THREE.Vector3();
    this.bodyWorldPos = new THREE.Vector3();
    
    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_CONTROLS) {
      window.debugLog('ExtinguisherController', 'Initialized');
    }

    this.setupGripDetection();
    this.setupSealInteraction();
    this.setupHoseVisuals();
  },

  setupGripDetection: function () {
    const el = this.el;
    const scene = el.sceneEl;

    // Grip button - segurar extintor
    scene.addEventListener('gripdown', (e) => {
      if (!this.data.enabled || !e.detail) return;
      
      this.isGripped = true;
      const hand = e.detail.hand; // 'left' ou 'right'
      
      if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_CONTROLS) {
        window.debugLog('ExtinguisherController', 'Grip detected:', hand);
      }

      // Marcar para seguir a mão no tick
      this.gripHand = hand;
    });

    scene.addEventListener('gripup', (e) => {
      if (!e.detail || !e.detail.hand) return;
      if (e.detail.hand === this.gripHand) {
        this.isGripped = false;
        this.gripHand = null;
      }
    });

    // Trigger - disparar foam
    scene.addEventListener('triggerdown', (e) => {
      if (!this.isGripped || !this.data.enabled || !e.detail) return;
      
      this.isSprayingActive = true;
      this.startSpraying();
      
      if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_CONTROLS) {
        window.debugLog('ExtinguisherController', 'Trigger: START SPRAYING');
      }
    });

    scene.addEventListener('triggerup', (e) => {
      if (!e.detail) return;
      this.isSprayingActive = false;
      this.stopSpraying();
      
      if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_CONTROLS) {
        window.debugLog('ExtinguisherController', 'Trigger: STOP SPRAYING');
      }
    });
  },

  setupSealInteraction: function () {
    const seal = this.data.sealModel;
    if (!seal) return;

    // Botão de ação (A/X no Quest) para remover lacre
    document.addEventListener('buttonadown', () => {
      if (!this.data.enabled || this.sealRemoved) return;
      
      this.removeSeal();
    });

    document.addEventListener('buttonxdown', () => {
      if (!this.data.enabled || this.sealRemoved) return;
      
      this.removeSeal();
    });
  },

  removeSeal: function () {
    const seal = this.data.sealModel;
    if (!seal) return;

    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_CONTROLS) {
      window.debugLog('ExtinguisherController', 'Seal removed');
    }

    // Animar desaparecimento (fade out)
    seal.setAttribute('animation__fadeout', {
      property: 'scale',
      from: '1 1 1',
      to: '0.1 0.1 0.1',
      dur: 300,
      easing: 'easeInQuad',
      direction: 'normal'
    });

    seal.setAttribute('animation__opacity', {
      property: 'material.opacity',
      from: 1,
      to: 0,
      dur: 300,
      easing: 'easeInQuad'
    });

    // Desabilitar após animação
    setTimeout(() => {
      seal.setAttribute('visible', 'false');
      this.sealRemoved = true;
      
      // Emitir evento para training state
      this.el.sceneEl.emit('extinguisher-seal-removed');
    }, 300);
  },

  setupHoseVisuals: function () {
    const hose = this.data.hoseModel;
    if (!hose) {
      // Se não tiver modelo de mangueira, criar uma visualmente
      const hoseGeometry = new THREE.TubeGeometry(
        new THREE.LineCurve3(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, 0.5)
        ),
        8, 0.015, 6, false
      );

      const hoseMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFAA00,
        metalness: 0.2,
        roughness: 0.8
      });

      this.hoseMesh = new THREE.Mesh(hoseGeometry, hoseMaterial);
      this.el.object3D.add(this.hoseMesh);
    } else {
      this.hoseMesh = hose.object3D;
    }
  },

  tick: function (time, timeDelta) {
    if (!this.data.enabled) return;

    // 1. Corpo segue mão se gripado
    if (this.isGripped && this.gripHand) {
      this.followHand();
    }

    // 2. Atualizar mangueira (sempre)
    if (this.hoseMesh && this.sealRemoved) {
      this.updateHoseDynamics();
    }
  },

  followHand: function () {
    const hand = document.querySelector(`#${this.gripHand}-hand-controller`);
    if (!hand) return;

    // Corpo segue a posição e rotação da mão
    this.el.object3D.position.copy(hand.object3D.position);
    this.el.object3D.quaternion.copy(hand.object3D.quaternion);

    // Ajustar posição relativa (como se estivesse na mão)
    const offset = new THREE.Vector3(0, -0.1, -0.05);
    offset.applyQuaternion(this.el.object3D.quaternion);
    this.el.object3D.position.add(offset);
  },

  updateHoseDynamics: function () {
    if (!this.hoseMesh) return;

    // Ponto de início: nozzle do corpo
    const nozzleOffset = new THREE.Vector3(0, -0.05, 0.3);
    nozzleOffset.applyQuaternion(this.el.object3D.quaternion);
    this.bodyWorldPos.copy(this.el.object3D.position).add(nozzleOffset);

    // Ponto de fim: posição da outra mão (ou câmera se só uma mão)
    const otherHand = this.gripHand === 'right' ? 'left' : 'right';
    const otherHandController = document.querySelector(`#${otherHand}-hand-controller`);

    if (otherHandController) {
      this.hoseEndWorldPos.copy(otherHandController.object3D.position);
    } else {
      // Se não tiver outra mão, apontar para frente
      const camera = document.querySelector('[camera]');
      if (camera) {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(camera.object3D.quaternion);
        forward.multiplyScalar(2);
        this.hoseEndWorldPos.copy(camera.object3D.position).add(forward);
      }
    }

    // Criar curva com sag natural (gravidade)
    const midPoint = new THREE.Vector3()
      .addVectors(this.bodyWorldPos, this.hoseEndWorldPos)
      .multiplyScalar(0.5);
    
    midPoint.y -= 0.15; // Sag pela gravidade

    const curve = new THREE.CatmullRomCurve3([
      this.bodyWorldPos,
      midPoint,
      this.hoseEndWorldPos
    ]);

    // Atualizar geometria (descartar anterior)
    if (this.hoseMesh.geometry) {
      this.hoseMesh.geometry.dispose();
    }

    this.hoseMesh.geometry = new THREE.TubeGeometry(curve, 10, 0.015, 6, false);
  },

  startSpraying: function () {
    const foam = document.querySelector('#foam-nozzle');
    if (!foam || !foam.components.foam) return;

    // Atualizar posição do foam para ponta da mangueira
    foam.object3D.position.copy(this.hoseEndWorldPos);

    // Disparar foam
    if (!foam.components.foam.emitting) {
      foam.components.foam.start();
    }
  },

  stopSpraying: function () {
    const foam = document.querySelector('#foam-nozzle');
    if (!foam || !foam.components.foam) return;

    foam.components.foam.stop();
  },

  setEnabled: function (enabled) {
    this.data.enabled = enabled;
    
    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_CONTROLS) {
      window.debugLog('ExtinguisherController', 'Enabled:', enabled);
    }
  }
});
