/**
 * Debug Configuration
 *
 * Set VERBOSE_LOGGING to true to enable detailed console logs
 * Set to false to disable and improve performance
 */

window.DEBUG_CONFIG = {
  VERBOSE_LOGGING: false, // Toggle detailed logs on/off
  LOG_HAND_TRACKING: false,
  LOG_CLICK_LISTENER: false,
  LOG_RENDERER: false,
  LOG_CONTROLS: false,
  LOG_PARTICLES: false, // Fire and foam particle systems
  LOG_TRAINING: false, // Training state machine
  SHOW_STATS: false, // Toggle performance stats (FPS, draw calls, triangles)
  SHOW_STATS_IN_VR: false, // Show stats HUD in VR mode
};

// Helper function to conditionally log
window.debugLog = function (prefix, ...args) {
  if (window.DEBUG_CONFIG.VERBOSE_LOGGING) {
    console.log(`[${prefix}]`, ...args);
  }
};

window.debugWarn = function (prefix, ...args) {
  if (window.DEBUG_CONFIG.VERBOSE_LOGGING) {
    console.warn(`[${prefix}]`, ...args);
  }
};

window.debugError = function (prefix, ...args) {
  // Always log errors, regardless of VERBOSE_LOGGING
  console.error(`[${prefix}]`, ...args);
};
