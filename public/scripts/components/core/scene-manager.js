/**
 * Scene Manager Component
 * 
 * Gerencia as transições entre:
 * - Tela de boas-vindas
 * - Seleção de movimento
 * - Treinamento ativo
 */

AFRAME.registerComponent('scene-manager', {
  schema: {
    autoStart: { type: 'boolean', default: false }
  },

  init: function () {
    this.currentScene = 'welcome';
    this.attachEventListeners();

    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_TRAINING) {
      window.debugLog('SceneManager', 'Initialized - Scene:', this.currentScene);
    }
  },

  attachEventListeners: function () {
    const scene = this.el.sceneEl;

    // Listener para início do treinamento
    scene.addEventListener('training-start', (e) => {
      this.startTraining(e.detail.mode);
    });

    // Listener para retorno à tela de boas-vindas
    scene.addEventListener('reset-to-welcome', () => {
      this.resetToWelcome();
    });

    // Listener para conclusão do treinamento
    scene.addEventListener('training-complete', () => {
      this.trainingComplete();
    });
  },

  startTraining: function (mode) {
    this.currentScene = 'training';

    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_TRAINING) {
      window.debugLog('SceneManager', 'Starting training with mode:', mode);
    }

    // Ativar movimento
    const rig = document.querySelector('#rig');
    if (rig && rig.components['movement-controller']) {
      rig.components['movement-controller'].setEnabled(true);
    }

    // Iniciar máquina de estados de treinamento
    const trainingEntity = document.querySelector('#training');
    if (trainingEntity && trainingEntity.components['training-state']) {
      trainingEntity.components['training-state'].reset();
      trainingEntity.components['training-state'].next();
    }
  },

  resetToWelcome: function () {
    this.currentScene = 'welcome';

    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_TRAINING) {
      window.debugLog('SceneManager', 'Resetting to welcome screen');
    }

    // Desativar movimento
    const rig = document.querySelector('#rig');
    if (rig && rig.components['movement-controller']) {
      rig.components['movement-controller'].setEnabled(false);
    }

    // Mostrar welcome screen
    const trainingEntity = document.querySelector('#training');
    if (trainingEntity && trainingEntity.components['welcome-screen']) {
      trainingEntity.components['welcome-screen'].show();
    }
  },

  trainingComplete: function () {
    this.currentScene = 'complete';

    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_TRAINING) {
      window.debugLog('SceneManager', 'Training completed');
    }

    // Mostrar mensagem de conclusão
    this.showCompletionScreen();
  },

  showCompletionScreen: function () {
    const scene = this.el.sceneEl;
    const trainingEntity = document.querySelector('#training');

    // Criar painel de conclusão
    const completionPanel = document.createElement('a-entity');
    completionPanel.setAttribute('id', 'completion-panel');
    completionPanel.setAttribute('position', '0 1.6 0');
    completionPanel.setAttribute('generic-hud-panel', {
      title: 'Treinamento Concluído!',
      text: 'Excelente trabalho! Você completou o treinamento de combate a incêndio.',
      width: 3.5,
      height: 1.5,
      bgColor: '#020617',
      bgOpacity: 0.7,
      borderColor: '#10B981',
      borderOpacity: 0.8,
      offsetZ: -3.5,
      offsetY: 0.5,
      entranceAnimation: true
    });

    scene.appendChild(completionPanel);

    // Botão de reiniciar
    const restartBtn = document.createElement('a-entity');
    restartBtn.setAttribute('id', 'restart-btn');
    restartBtn.setAttribute('generic-hud-panel', {
      text: '🔄  REINICIAR',
      width: 2.0,
      height: 0.7,
      offsetX: 0,
      offsetY: -1.2,
      offsetZ: -3.5,
      isButton: true,
      buttonAction: 'restartTraining',
      vibrateOnHover: true,
      vibrateIntensity: 0.4,
      vibrateDuration: 80,
      borderColor: '#10B981',
      borderOpacity: 0.8,
      hoverColor: '#059669',
      bgColor: '#10B981',
      bgOpacity: 0.3,
      cornerRadius: 0.15,
      entranceAnimation: true,
      textScale: 0.36
    });
    scene.appendChild(restartBtn);

    // Listener para reiniciar
    scene.addEventListener('restartTraining', () => {
      completionPanel.remove();
      restartBtn.remove();
      this.resetToWelcome();
    });
  },

  getCurrentScene: function () {
    return this.currentScene;
  }
});
