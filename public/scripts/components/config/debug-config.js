/**
 * Debug Configuration
 *
 * Centralised debug/logging system for the entire application.
 *
 * Usage:
 *   window.debugLog("Fire", "intensity:", value);   // only logs when LOG_PARTICLES is true
 *   window.debugWarn("MovCtrl", "mode invalid");     // same category gating for warnings
 *   window.debugError("Foam", "shader failed");      // errors ALWAYS log (never gated)
 *
 * Categories map prefixes to flags. Unknown prefixes fall back to VERBOSE_LOGGING.
 */

/* ── Configuration ─────────────────────────────────────────────────── */

window.DEBUG_CONFIG = {
  // Master toggle — enables ALL categories at once when true
  VERBOSE_LOGGING: false,

  // Developer mode — skips intro panel, unlocks movement, exposes trainingDev
  DEV_MODE: true,

  // Per-category flags (only checked when VERBOSE_LOGGING is false)
  LOG_HAND_TRACKING: false,
  LOG_CLICK_LISTENER: false,
  LOG_RENDERER: false,
  LOG_CONTROLS: false, // movement-controller, extinguisher-controller
  LOG_PARTICLES: false, // fire, foam
  LOG_TRAINING: false, // training-state, training-manager

  // Performance overlay
  SHOW_STATS: false,
  SHOW_STATS_IN_VR: false,
};

/* ── Prefix → Flag mapping ─────────────────────────────────────────── */

const _CATEGORY_MAP = {
  // Particles
  Fire: "LOG_PARTICLES",
  Foam: "LOG_PARTICLES",
  // Controls / interaction
  ExtinguisherCtrl: "LOG_CONTROLS",
  MovementController: "LOG_CONTROLS",
  // Training
  TrainingState: "LOG_TRAINING",
  TrainingManager: "LOG_TRAINING",
  SceneManager: "LOG_TRAINING",
  // UI
  InteractivePanels: "LOG_CLICK_LISTENER",
  TutorialHUD: "LOG_CLICK_LISTENER",
  // Renderer / stats
  VRStats: "LOG_RENDERER",
  // Hand tracking
  HandTracking: "LOG_HAND_TRACKING",
};

/* ── Helpers ───────────────────────────────────────────────────────── */

/**
 * Returns true when logging is allowed for the given prefix.
 * 1. VERBOSE_LOGGING → always allow
 * 2. Known prefix    → check its specific flag
 * 3. Unknown prefix  → deny (silent)
 */
function _shouldLog(prefix) {
  const cfg = window.DEBUG_CONFIG;
  if (!cfg) return false;
  if (cfg.VERBOSE_LOGGING) return true;

  const flag = _CATEGORY_MAP[prefix];
  return flag ? !!cfg[flag] : false;
}

/**
 * Conditional console.log gated by category.
 * @param {string} prefix - Log prefix (matched to category)
 * @param {...*} args     - Values to log
 */
window.debugLog = function (prefix, ...args) {
  if (_shouldLog(prefix)) {
    console.log(`[${prefix}]`, ...args);
  }
};

/**
 * Conditional console.warn gated by category.
 */
window.debugWarn = function (prefix, ...args) {
  if (_shouldLog(prefix)) {
    console.warn(`[${prefix}]`, ...args);
  }
};

/**
 * Always logs — errors are never gated.
 */
window.debugError = function (prefix, ...args) {
  console.error(`[${prefix}]`, ...args);
};
