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
    this.stateKeys = Object.keys(this.states);
    this.current = this.states[this.data.initial] ? this.data.initial : this.stateKeys[0];
    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_TRAINING) {
      window.debugLog('Training', 'Initialized with states:', this.stateKeys);
    }
    this._enter(this.current);

    // Expose API
    this.el.emit('training-ready', { state: this.current });
    this.el.trainingState = {
      /** Advance via named event (e.g. 'start', 'proceed') */
      next: (event) => this._advance(event),
      /** Go to the next state in sequence (index-based, ignores event names) */
      forward: () => this._forward(),
      /** Go to the previous state in sequence */
      back: () => this._back(),
      /** Jump directly to a named state */
      goTo: (state) => this._goTo(state),
      /** Reset to initial state */
      reset: () => this._reset(),
      /** Get current state name */
      get: () => this.current,
      /** Get current state index */
      getIndex: () => this.stateKeys.indexOf(this.current),
      /** Get array of all state names */
      getAll: () => [...this.stateKeys],
      /** Get state description */
      getDesc: (state) => {
        const s = state || this.current;
        return this.states[s] ? this.states[s].desc || '' : '';
      },
      /** Check if current state is the last one */
      isLast: () => this.stateKeys.indexOf(this.current) === this.stateKeys.length - 1,
      /** Check if current state is the first one */
      isFirst: () => this.stateKeys.indexOf(this.current) === 0,
    };
  },

  remove() {
    // cleanup
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
      window.debugLog('Training', `State transition: ${prevState} → ${state} (${this.stateKeys.indexOf(state) + 1}/${this.stateKeys.length})`);
    }
    this.el.emit('training-state-enter', { state, prev: prevState, index: this.stateKeys.indexOf(state) });
  },

  /** Advance via named event (event-driven transitions) */
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

  /** Move to next state by index (sequential) */
  _forward() {
    const idx = this.stateKeys.indexOf(this.current);
    if (idx < this.stateKeys.length - 1) {
      this._enter(this.stateKeys[idx + 1]);
      return true;
    }
    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_TRAINING) {
      window.debugWarn('Training', `Already at last state: '${this.current}'`);
    }
    return false;
  },

  /** Move to previous state by index (sequential) */
  _back() {
    const idx = this.stateKeys.indexOf(this.current);
    if (idx > 0) {
      this._enter(this.stateKeys[idx - 1]);
      return true;
    }
    if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_TRAINING) {
      window.debugWarn('Training', `Already at first state: '${this.current}'`);
    }
    return false;
  },

  /** Jump directly to a named state */
  _goTo(state) {
    if (!this.states[state]) {
      if (window.DEBUG_CONFIG && window.DEBUG_CONFIG.LOG_TRAINING) {
        window.debugWarn('Training', `State not found: '${state}'`);
      }
      return false;
    }
    this._enter(state);
    return true;
  },

  _reset() {
    const initial = this.data.initial;
    if (this.states[initial]) {
      this._enter(initial);
    }
  },
});
