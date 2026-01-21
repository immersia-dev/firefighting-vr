// Generic finite-state machine for training flows
AFRAME.registerComponent('training-state', {
  schema: {
    // Name of initial state
    initial: { type: 'string', default: 'intro' },
    // Optional JSON string defining states and transitions
    config: { type: 'string', default: '' },
  },

  init() {
    this.states = this._loadConfig(this.data.config);
    this.current = this.states[this.data.initial] ? this.data.initial : Object.keys(this.states)[0];
    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_TRAINING) {
      window.debugLog('Training', 'Initialized with states:', Object.keys(this.states));
    }
    this._enter(this.current);

    // Expose API
    this.el.emit('training-ready', { state: this.current });
    this.el.trainingState = {
      next: (event) => this._advance(event),
      reset: () => this._reset(),
      get: () => this.current,
    };
  },

  remove() {
    if (this.timer) clearTimeout(this.timer);
  },

  _loadConfig(configStr) {
    if (!configStr) {
      return {
        intro: { on: { start: 'sizeup' }, desc: 'Apresentação / briefing' },
        sizeup: { on: { proceed: 'approach' }, desc: 'Avaliar cena / EPIs / rota' },
        approach: { on: { ready: 'suppress' }, desc: 'Aproximação segura com extintor/mangueira' },
        suppress: { on: { fire_out: 'overhaul' }, desc: 'Aplicar agente até extinção' },
        overhaul: { on: { done: 'done' }, desc: 'Rescaldo e checagem' },
        done: { desc: 'Treinamento concluído' },
      };
    }
    try {
      return JSON.parse(configStr);
    } catch (e) {
      console.warn('[training-state] invalid config, using default', e);
      return {};
    }
  },

  _enter(state) {
    const prevState = this.current;
    this.current = state;
    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_TRAINING) {
      window.debugLog('Training', `State transition: ${prevState} → ${state}`);
    }
    this.el.emit('training-state-enter', { state });
  },

  _advance(eventName) {
    const state = this.states[this.current] || {};
    const target = state.on && state.on[eventName];
    if (!target || !this.states[target]) {
      if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_TRAINING) {
        window.debugWarn('Training', `No transition from '${this.current}' on event '${eventName}'`);
      }
      return false;
    }
    this._enter(target);
    return true;
  },

  _reset() {
    const initial = this.data.initial;
    if (this.states[initial]) {
      this._enter(initial);
    }
  },
});
