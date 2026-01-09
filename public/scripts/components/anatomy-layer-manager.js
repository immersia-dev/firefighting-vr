AFRAME.registerComponent('anatomy-layer-manager', {
  schema: {
    currentLayer: { type: 'number', default: 0 },
    autoAdvance: { type: 'boolean', default: false },
    autoAdvanceDelay: { type: 'number', default: 5000 }
  },

  init: function () {
    this.layers = [
      { 
        name: 'inicial', 
        visible: [],
        description: 'Bem-vindo',
        detail: 'Use os controles para navegar entre as camadas anatômicas',
        color: '#FFFFFF'
      },
      { 
        name: 'esqueleto', 
        visible: ['bones'],
        description: 'Sistema Esquelético',
        detail: 'Estrutura de suporte do corpo - Forma e proteção dos órgãos internos',
        color: '#E8E8E8'
      },
      { 
        name: 'circulatorio', 
        visible: ['bones', 'circulatory-blue', 'circulatory-red'],
        description: 'Sistema Circulatório',
        detail: 'Artérias (vermelho) transportam sangue rico em oxigênio | Veias (azul) retornam sangue ao coração',
        color: '#FF6B6B'
      },
      { 
        name: 'orgaos', 
        visible: ['bones', 'circulatory-blue', 'circulatory-red', 'heart', 'lungs', 'liver', 'guts', 'brain', 'testicles'],
        description: 'Órgãos Internos',
        detail: 'Coração, Pulmões, Fígado, Intestinos, Cérebro, Testículos - Sistemas vitais do organismo',
        color: '#4ECDC4'
      },
      { 
        name: 'muscular', 
        visible: ['bones', 'circulatory-blue', 'circulatory-red', 'heart', 'lungs', 'liver', 'guts', 'brain', 'testicles', 'muscle'],
        description: 'Sistema Muscular',
        detail: 'Músculos que envolvem a estrutura - Responsáveis pelo movimento e sustentação',
        color: '#FFE66D'
      },
      { 
        name: 'pele', 
        visible: ['bones', 'circulatory-blue', 'circulatory-red', 'heart', 'lungs', 'liver', 'guts', 'brain', 'testicles', 'muscle', 'skin'],
        description: 'Pele',
        detail: 'Camada externa protetora - Primeira barreira de defesa do organismo',
        color: '#FFA07A'
      }
    ];
    
    this.models = {
      'bones': document.querySelector('#bones'),
      'circulatory-blue': document.querySelector('#circulatory-blue'),
      'circulatory-red': document.querySelector('#circulatory-red'),
      'heart': document.querySelector('#heart'),
      'lungs': document.querySelector('#lungs'),
      'liver': document.querySelector('#liver'),
      'guts': document.querySelector('#guts'),
      'brain': document.querySelector('#brain'),
      'testicles': document.querySelector('#testicles'),
      'muscle': document.querySelector('#muscle'),
      'skin': document.querySelector('#skin')
    };
    
    const missing = Object.entries(this.models).filter(([key, value]) => !value);
    
    this.centerPosition = { x: 0, y: 1.7401, z: -2.5 };
    this.modelScale = 1.8;
    this.repositionAllModels();
    
    this.updateLayer(this.data.currentLayer);
    
    this.onNextLayer = this.onNextLayer.bind(this);
    this.onPreviousLayer = this.onPreviousLayer.bind(this);
    this.onLayerChange = this.onLayerChange.bind(this);
    
    this.rightHand = document.querySelector('#right-hand-tracking');
    this.leftHand = document.querySelector('#left-hand-tracking');
    this.rightController = document.querySelector('#right-hand-controller');
    this.leftController = document.querySelector('#left-hand-controller');
    
    this.setupHandGestures();
    this.setupControllerButtons();
    
    this.onInteractionModeChanged = this.onInteractionModeChanged.bind(this);
    this.el.addEventListener('interaction-mode-changed', this.onInteractionModeChanged);
    
    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'ArrowRight' || evt.key === 'd' || evt.key === 'D') {
        this.nextLayer();
      } else if (evt.key === 'ArrowLeft' || evt.key === 'a' || evt.key === 'A') {
        this.previousLayer();
      } else if (evt.key === 'r' || evt.key === 'R') {
        this.reset();
      } else if (evt.key === 'h' || evt.key === 'H') {
        if (this.el.setInteractionMode) {
          this.el.setInteractionMode('hand-tracking');
        }
      } else if (evt.key === 'c' || evt.key === 'C') {
        if (this.el.setInteractionMode) {
          this.el.setInteractionMode('controllers');
        }
      }
    });
    
    this.createControlUI();
  },

  setupControllerButtons: function () {
    this.lastThumbstickAction = { right: 0, left: 0 };
    this.thumbstickCooldown = 500;
    
    if (this.rightController) {
      this.rightController.addEventListener('abuttondown', () => {
        this.nextLayer();
      });
      this.rightController.addEventListener('xbuttondown', () => {
        this.nextLayer();
      });
      
      this.rightController.addEventListener('thumbstickmoved', (evt) => {
        const now = Date.now();
        if (now - this.lastThumbstickAction.right < this.thumbstickCooldown) {
          return;
        }
        
        if (evt.detail.y > 0.7) {
          this.lastThumbstickAction.right = now;
          this.nextLayer();
        }
      });
    }
    
    if (this.leftController) {
      this.leftController.addEventListener('bbuttondown', () => {
        this.previousLayer();
      });
      this.leftController.addEventListener('ybuttondown', () => {
        this.previousLayer();
      });
      
      this.leftController.addEventListener('thumbstickmoved', (evt) => {
        const now = Date.now();
        if (now - this.lastThumbstickAction.left < this.thumbstickCooldown) {
          return;
        }
        
        if (evt.detail.y > 0.7) {
          this.lastThumbstickAction.left = now;
          this.previousLayer();
        }
      });
    }
  },

  setupHandGestures: function () {
    this.lastGestureTime = { left: 0, right: 0 };
    this.gestureCooldown = 500;
    this.modelsContainerPos = new THREE.Vector3();
    
    if (this.rightHand) {
      this.rightHand.addEventListener('pinchstarted', (evt) => {
        const now = Date.now();
        if (now - this.lastGestureTime.right < this.gestureCooldown) {
          return;
        }
        
        const rightHandPos = new THREE.Vector3();
        this.rightHand.object3D.getWorldPosition(rightHandPos);
        
        if (this.modelsContainer) {
          this.modelsContainer.object3D.getWorldPosition(this.modelsContainerPos);
          const distance = rightHandPos.distanceTo(this.modelsContainerPos);
          
          if (distance > 0.4) {
            this.lastGestureTime.right = now;
            this.nextLayer();
          }
        }
      });
    }
    
    if (this.leftHand) {
      this.leftHand.addEventListener('pinchstarted', (evt) => {
        const now = Date.now();
        if (now - this.lastGestureTime.left < this.gestureCooldown) {
          return;
        }
        
        const leftHandPos = new THREE.Vector3();
        this.leftHand.object3D.getWorldPosition(leftHandPos);
        
        if (this.modelsContainer) {
          this.modelsContainer.object3D.getWorldPosition(this.modelsContainerPos);
          const distance = leftHandPos.distanceTo(this.modelsContainerPos);
          
          if (distance > 0.4) {
            this.lastGestureTime.left = now;
            this.previousLayer();
          }
        }
      });
    }
  },

  repositionAllModels: function () {
    const pos = this.centerPosition;
    
    let modelsContainer = document.querySelector('#anatomy-models-container');
    if (!modelsContainer) {
      modelsContainer = document.createElement('a-entity');
      modelsContainer.setAttribute('id', 'anatomy-models-container');
      this.el.appendChild(modelsContainer);
      this.modelsContainer = modelsContainer;
    }
    
    modelsContainer.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    modelsContainer.setAttribute('rotation', '0 45 0');
    
    Object.values(this.models).forEach(model => {
      if (model) {
        if (model.parentNode) {
          model.parentNode.removeChild(model);
        }
        
        model.setAttribute('position', '0 0 0');
        model.setAttribute('rotation', '0 0 0');
        model.setAttribute('scale', `${this.modelScale} ${this.modelScale} ${this.modelScale}`);
        
        modelsContainer.appendChild(model);
      }
    });
  },

  updateLayer: function (layerIndex) {
    if (layerIndex < 0 || layerIndex >= this.layers.length) {
      return;
    }
    
    const layer = this.layers[layerIndex];
    const previousLayer = this.layers[this.data.currentLayer];
    
    const newModels = layer.visible.filter(key => !previousLayer.visible.includes(key));
    
    Object.keys(this.models).forEach(key => {
      const model = this.models[key];
      if (model && !layer.visible.includes(key)) {
        model.setAttribute('scale', `${this.modelScale} ${this.modelScale} ${this.modelScale}`);
        model.setAttribute('visible', false);
      }
    });
    
    const hasSkin = layer.visible.includes('skin');
    
    layer.visible.forEach((key, index) => {
      const model = this.models[key];
      if (model) {
        const isNew = newModels.includes(key);
        
        model.setAttribute('scale', `${this.modelScale} ${this.modelScale} ${this.modelScale}`);
        model.removeAttribute('animation__show');
        model.removeAttribute('animation__hide');
        model.removeAttribute('animation__pulse');
        
        if (hasSkin && key !== 'skin') {
          model.setAttribute('visible', false);
        } else {
          model.setAttribute('visible', true);
        }
        
        if (isNew) {
          setTimeout(() => {
            this.highlightNewModel(model, layer.color || '#FFFFFF');
          }, 300);
        }
      }
    });
    
    Object.keys(this.models).forEach(key => {
      const model = this.models[key];
      if (model) {
        model.setAttribute('scale', `${this.modelScale} ${this.modelScale} ${this.modelScale}`);
        
        if (hasSkin && key !== 'skin') {
          model.setAttribute('visible', false);
        }
      }
    });
    
    if (this.modelsContainer) {
      this.modelsContainer.setAttribute('visible', true);
    }
    
    this.data.currentLayer = layerIndex;
    
    this.updateLighting(layer);
    
    this.el.emit('layer-changed', {
      layer: layerIndex,
      layerName: layer.name,
      description: layer.description,
      detail: layer.detail,
      visibleModels: layer.visible,
      newModels: newModels
    });
    
    this.updateControlUI(layer);
    
    if (this.data.autoAdvance && layerIndex < this.layers.length - 1) {
      clearTimeout(this.autoAdvanceTimeout);
      this.autoAdvanceTimeout = setTimeout(() => {
        this.nextLayer();
      }, this.data.autoAdvanceDelay);
    }
  },
  
  highlightNewModel: function (model, color) {
  },
  
  updateLighting: function (layer) {
    const ambientLight = document.querySelector('[light][type="ambient"]');
    if (ambientLight) {
      ambientLight.setAttribute('animation__intensity', {
        property: 'light.intensity',
        from: ambientLight.getAttribute('light').intensity,
        to: 0.7,
        dur: 500,
        easing: 'easeInOutQuad'
      });
    }
  },

  nextLayer: function () {
    if (this.data.currentLayer < this.layers.length - 1) {
      this.updateLayer(this.data.currentLayer + 1);
    }
  },

  previousLayer: function () {
    if (this.data.currentLayer > 0) {
      this.updateLayer(this.data.currentLayer - 1);
    }
  },

  reset: function () {
    this.updateLayer(0);
  },

  onNextLayer: function () {
    this.nextLayer();
  },

  onPreviousLayer: function () {
    this.previousLayer();
  },

  onLayerChange: function (evt) {
    const layerIndex = evt.detail?.layer;
    if (layerIndex !== undefined) {
      this.updateLayer(layerIndex);
    }
  },

  createControlUI: function () {
    const uiContainer = document.createElement('a-entity');
    uiContainer.setAttribute('id', 'layer-control-ui');
    const uiPosition = `${this.centerPosition.x} ${this.centerPosition.y + 2.5} ${this.centerPosition.z - 1.0}`;
    uiContainer.setAttribute('position', uiPosition);
    uiContainer.setAttribute('look-at', '#rig');
    
    const background = document.createElement('a-plane');
    background.setAttribute('width', '5');
    background.setAttribute('height', '1.3');
    background.setAttribute('position', '0 0 0.01');
    background.setAttribute('color', '#000000');
    background.setAttribute('opacity', '0.7');
    background.setAttribute('side', 'double');
    uiContainer.appendChild(background);
    
    const titleText = document.createElement('a-text');
    titleText.setAttribute('id', 'layer-title-text');
    titleText.setAttribute('value', 'Sistema Esquelético');
    titleText.setAttribute('align', 'center');
    titleText.setAttribute('position', '0 0.4 0.02');
    titleText.setAttribute('color', '#4ECDC4');
    titleText.setAttribute('width', '10');
    titleText.setAttribute('scale', '0.7 0.7 0.7');
    if (window.setupTextFont) {
      window.setupTextFont(titleText);
    } else {
      titleText.setAttribute('font', '../assets/fonts/Exo2-Regular-msdf.json');
      titleText.setAttribute('font-image', '../assets/fonts/Exo2-Regular.png');
      titleText.setAttribute('negate', false);
    }
    uiContainer.appendChild(titleText);
    
    const detailText = document.createElement('a-text');
    detailText.setAttribute('id', 'layer-detail-text');
    detailText.setAttribute('value', '');
    detailText.setAttribute('align', 'center');
    detailText.setAttribute('position', '0 0 0.02');
    detailText.setAttribute('color', '#CCCCCC');
    detailText.setAttribute('width', '10');
    detailText.setAttribute('scale', '0.4 0.4 1');
    detailText.setAttribute('wrap-count', '45');
    if (window.setupTextFont) {
      window.setupTextFont(detailText);
    } else {
      detailText.setAttribute('font', '../assets/fonts/Exo2-Regular-msdf.json');
      detailText.setAttribute('font-image', '../assets/fonts/Exo2-Regular.png');
      detailText.setAttribute('negate', false);
    }
    uiContainer.appendChild(detailText);
    
    const progressBarBg = document.createElement('a-plane');
    progressBarBg.setAttribute('width', '4');
    progressBarBg.setAttribute('height', '0.1');
    progressBarBg.setAttribute('position', '0 -0.35 0.02');
    progressBarBg.setAttribute('color', '#333333');
    progressBarBg.setAttribute('opacity', '0.8');
    uiContainer.appendChild(progressBarBg);
    
    const progressBar = document.createElement('a-plane');
    progressBar.setAttribute('id', 'layer-progress-bar');
    progressBar.setAttribute('width', '0.8');
    progressBar.setAttribute('height', '0.1');
    progressBar.setAttribute('position', '-1.6 -0.35 0.03');
    progressBar.setAttribute('color', '#4ECDC4');
    progressBar.setAttribute('opacity', '1');
    uiContainer.appendChild(progressBar);
    
    const instructionText = document.createElement('a-text');
    instructionText.setAttribute('id', 'layer-instruction-text');
    instructionText.setAttribute('value', 'Controles: Botão A = próximo | Botão Y = anterior | Teclado: D/→ = próximo | A/← = anterior');
    instructionText.setAttribute('align', 'center');
    instructionText.setAttribute('position', '0 -0.5 0.02');
    instructionText.setAttribute('color', '#999999');
    instructionText.setAttribute('width', '10');
    instructionText.setAttribute('scale', '0.2 0.2 1');
    if (window.setupTextFont) {
      window.setupTextFont(instructionText);
    } else {
      instructionText.setAttribute('font', '../assets/fonts/Exo2-Regular-msdf.json');
      instructionText.setAttribute('font-image', '../assets/fonts/Exo2-Regular.png');
      instructionText.setAttribute('negate', false);
    }
    uiContainer.appendChild(instructionText);
    
    this.el.appendChild(uiContainer);
    this.uiContainer = uiContainer;
    this.titleText = titleText;
    this.detailText = detailText;
    this.progressBar = progressBar;
    this.instructionText = instructionText;
    
    this.updateInstructionText();
    
    const initialLayer = this.layers[this.data.currentLayer];
    if (initialLayer) {
      this.updateControlUI(initialLayer);
    }
  },

  onInteractionModeChanged: function (evt) {
    this.updateInstructionText();
  },

  updateInstructionText: function () {
    if (!this.instructionText) return;
    
    const scene = this.el;
    const modeManager = scene.components['interaction-mode-manager'];
    const currentMode = modeManager ? modeManager.data.mode : 'controllers';
    
    let instructionValue = '';
    if (currentMode === 'hand-tracking') {
      instructionValue = 'Pinça esquerda: anterior  |  Pinça direita: próximo';
    } else {
      instructionValue = 'Botão A = próximo | Botão Y = anterior | Teclado: D/→ = próximo | A/← = anterior';
    }
    
    this.instructionText.setAttribute('value', instructionValue);
  },

  updateControlUI: function (layer) {
    if (!this.titleText || !this.detailText || !this.progressBar) return;
    
    layer = layer || this.layers[this.data.currentLayer];
    const totalLayers = this.layers.length - 1;
    const displayNum = this.data.currentLayer;
    
    this.updateInstructionText();
    
    this.titleText.setAttribute('value', layer.description || layer.name);
    this.titleText.setAttribute('color', layer.color || '#4ECDC4');
    
    if (this.titleText.getAttribute('material')) {
      this.titleText.setAttribute('animation__fade', {
        property: 'material.opacity',
        from: 0.5,
        to: 1,
        dur: 200,
        easing: 'easeOutQuad'
      });
    }
    
    this.detailText.setAttribute('value', layer.detail || layer.description || '');
    
    const progress = displayNum / totalLayers;
    const barWidth = 4 * progress;
    const barPosition = -2 + (barWidth / 2);
    
    this.progressBar.setAttribute('animation__width', {
      property: 'width',
      from: this.progressBar.getAttribute('width'),
      to: barWidth,
      dur: 300,
      easing: 'easeOutQuad'
    });
    
    this.progressBar.setAttribute('animation__position', {
      property: 'position',
      from: this.progressBar.getAttribute('position'),
      to: `${barPosition} -0.35 0.03`,
      dur: 300,
      easing: 'easeOutQuad'
    });
    
    this.progressBar.setAttribute('animation__color', {
      property: 'color',
      from: this.progressBar.getAttribute('color'),
      to: layer.color || '#4ECDC4',
      dur: 300,
      easing: 'easeOutQuad'
    });
  },

  remove: function () {
    if (this.autoAdvanceTimeout) {
      clearTimeout(this.autoAdvanceTimeout);
    }
    if (this.uiContainer) {
      this.uiContainer.remove();
    }
  }
});

