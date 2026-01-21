/**
 * Training Manager - Orquestra todo o fluxo de treinamento
 * Controla: Painéis Interativos → Liberação de Movimento → Tutorial HUD
 */

AFRAME.registerComponent('training-manager', {
  schema: {
    enabled: { type: 'boolean', default: true }
  },

  init: function () {
    console.log('[TrainingManager] Initializing');

    this.scene = this.el.sceneEl;
    this.currentPhase = 'intro';
    this.phases = ['intro', 'movement_select', 'training'];
    this.currentTrainingStep = 0;
    this.trainingSteps = ['sizeup', 'approach', 'suppress', 'overhaul', 'done'];

    if (!this.schema.enabled) return;

    // Aguardar scene estar pronta
    this.scene.addEventListener('loaded', () => {
      setTimeout(() => this.startTraining(), 500);
    });
  },

  startTraining: function () {
    console.log('[TrainingManager] Starting training flow');
    this.showIntroPanel();
  },

  showIntroPanel: function () {
    const panelComponent = document.querySelector('[interactive-panels]');
    if (!panelComponent) {
      console.warn('[TrainingManager] Interactive panels component not found');
      return;
    }

    panelComponent.components['interactive-panels'].showPanel('intro', {
      toMovement: () => this.showMovementSelectPanel()
    });
  },

  showMovementSelectPanel: function () {
    const panelComponent = document.querySelector('[interactive-panels]');

    panelComponent.components['interactive-panels'].showPanel('movement_select', {
      analogMovement: () => this.startMainTraining(),
      teleportMovement: () => this.startMainTraining()
    });
  },

  startMainTraining: function () {
    console.log('[TrainingManager] Starting main training phase');

    const panelComponent = document.querySelector('[interactive-panels]');
    const hudComponent = document.querySelector('[tutorial-hud]');

    // Limpar painel
    panelComponent.components['interactive-panels'].clearPanel();

    // Liberar movimento
    panelComponent.components['interactive-panels'].unlockMovement();

    // Mostrar primeira mensagem
    if (hudComponent && hudComponent.components['tutorial-hud']) {
      setTimeout(() => {
        hudComponent.components['tutorial-hud'].show('Pegue o extintor para começar o treinamento', 5000);
      }, 500);
    }

    this.currentPhase = 'training';
    this.showTrainingHud();
  },

  showTrainingHud: function () {
    const hudComponent = document.querySelector('[tutorial-hud]');
    if (!hudComponent || !hudComponent.components['tutorial-hud']) return;

    const messages = [
      'Observe o incêndio antes de agir',
      'Aborde com segurança, mantendo distância',
      'Use a técnica PASS: Pressione, Aponte, Varre, Segue',
      'Verifique se há focos secundários',
      'Treinamento concluído com sucesso!'
    ];

    const hud = hudComponent.components['tutorial-hud'];

    // Mostrar mensagens em sequência
    messages.forEach((msg, idx) => {
      setTimeout(() => {
        hud.show(msg, 4000);
      }, idx * 5000 + 2000);
    });
  }
});
