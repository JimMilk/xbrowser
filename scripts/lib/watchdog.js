'use strict';

/**
 * Watchdog — process signal handler with graceful cleanup.
 *
 * Exports:
 *   setupWatchdog(cleanupFn)
 *   clearWatchdog()
 *
 * Behaviour:
 *   - Registers SIGINT / SIGTERM / SIGQUIT handlers.
 *   - On first signal: calls cleanupFn (should do `xb cleanup` equivalent).
 *   - 15-second hard timeout: if cleanup hasn't finished, force exit(1).
 *   - Logs cleanup status to stderr.
 */

const HARD_TIMEOUT_MS = 15000;

let _cleanupFn = null;
let _sigintHandler = null;
let _sigtermHandler = null;
let _sigquitHandler = null;
let _cleanupDone = false;
let _hardTimer = null;

// ---------------------------------------------------------------------------
// setupWatchdog
// ---------------------------------------------------------------------------
/**
 * @param {() => (void | Promise<void>)} cleanupFn — called on signal
 */
function setupWatchdog(cleanupFn) {
  if (typeof cleanupFn !== 'function') {
    throw new Error('setupWatchdog: cleanupFn must be a function');
  }

  // If already set up, remove old handlers first
  clearWatchdog();

  _cleanupFn = cleanupFn;
  _cleanupDone = false;

  _sigintHandler = createSignalHandler('SIGINT');
  _sigtermHandler = createSignalHandler('SIGTERM');
  _sigquitHandler = createSignalHandler('SIGQUIT');

  process.on('SIGINT', _sigintHandler);
  process.on('SIGTERM', _sigtermHandler);
  process.on('SIGQUIT', _sigquitHandler);
}

// ---------------------------------------------------------------------------
// clearWatchdog
// ---------------------------------------------------------------------------
function clearWatchdog() {
  if (_sigintHandler) {
    process.removeListener('SIGINT', _sigintHandler);
    _sigintHandler = null;
  }
  if (_sigtermHandler) {
    process.removeListener('SIGTERM', _sigtermHandler);
    _sigtermHandler = null;
  }
  if (_sigquitHandler) {
    process.removeListener('SIGQUIT', _sigquitHandler);
    _sigquitHandler = null;
  }
  if (_hardTimer) {
    clearTimeout(_hardTimer);
    _hardTimer = null;
  }
  _cleanupFn = null;
  _cleanupDone = false;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------
/**
 * Create a signal handler that:
 *   1. Removes all handlers (to prevent re-entrance)
 *   2. Starts the 15s hard-timeout
 *   3. Calls cleanupFn
 *   4. Exits with appropriate code
 */
function createSignalHandler(signalName) {
  let _fired = false;

  return async function handler() {
    if (_fired) {
      // Second signal — hard exit immediately
      process.stderr.write(`[xb-watchdog] second signal received, forcing exit\n`);
      process.exit(128 + getSignalNumber(signalName));
    }
    _fired = true;

    // Remove all handlers so we don't loop
    clearWatchdog();

    process.stderr.write(`[xb-watchdog] received ${signalName}, starting cleanup...\n`);

    // Start hard-timeout
    _hardTimer = setTimeout(() => {
      process.stderr.write(`[xb-watchdog] cleanup timed out after ${HARD_TIMEOUT_MS / 1000}s, forcing exit\n`);
      process.exit(1);
    }, HARD_TIMEOUT_MS);

    // Prevent the timer from keeping the process alive
    if (_hardTimer.unref) {
      _hardTimer.unref();
    }

    try {
      const result = _cleanupFn();
      if (result && typeof result.then === 'function') {
        await result;
      }
      _cleanupDone = true;
      process.stderr.write('[xb-watchdog] cleanup completed\n');
    } catch (err) {
      process.stderr.write(`[xb-watchdog] cleanup error: ${err.message}\n`);
    } finally {
      if (_hardTimer) {
        clearTimeout(_hardTimer);
        _hardTimer = null;
      }
      process.exit(_cleanupDone ? 0 : 1);
    }
  };
}

function getSignalNumber(name) {
  const map = { SIGINT: 2, SIGTERM: 15, SIGQUIT: 3 };
  return map[name] || 0;
}

// ---------------------------------------------------------------------------
module.exports = { setupWatchdog, clearWatchdog, HARD_TIMEOUT_MS };
