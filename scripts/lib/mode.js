'use strict';

/**
 * Mode resolver — handles --mode isolated|persistent semantics.
 *
 * Exports:
 *   resolveMode(config, args) → { mode, modifiedArgs }
 *
 * "isolated"  → temp profile + cleanup-on-exit (no login-state reuse)
 * "persistent"→ existing CDP / profile behavior (default)
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

const VALID_MODES = ['persistent', 'isolated'];

// ---------------------------------------------------------------------------
// resolveMode
// ---------------------------------------------------------------------------
/**
 * Inspect args for --mode and transform for agent-browser.
 *
 * @param {object}   config       — V2 config (from config-v2.js)
 * @param {string[]} args         — raw CLI args (after the subcommand verb)
 * @returns {{ mode: string, modifiedArgs: string[] }}
 */
function resolveMode(config, args) {
  if (!args || !Array.isArray(args)) {
    return { mode: DEFAULT_MODE, modifiedArgs: args || [] };
  }

  // 1. Check if --mode is explicitly passed in args
  const modeIndex = args.indexOf('--mode');
  let explicitMode = null;
  let remaining = [...args];

  if (modeIndex >= 0 && modeIndex + 1 < args.length) {
    explicitMode = args[modeIndex + 1];
    // Remove --mode <value> from args
    remaining = [...args.slice(0, modeIndex), ...args.slice(modeIndex + 2)];
  }

  // 2. Fallback to config, then default
  const mode = explicitMode || (config && config.browser && config.browser.mode) || DEFAULT_MODE;

  if (!VALID_MODES.includes(mode)) {
    // Unknown mode — fall through but log a warning-like indicator by not modifying
    // (caller should handle validation)
    return { mode, modifiedArgs: remaining, invalidMode: true };
  }

  // 3. Apply mode semantics
  if (mode === 'isolated') {
    const tempDir = createTempProfileDir();
    const modified = applyIsolatedMode(remaining, tempDir);
    return { mode, modifiedArgs: modified, tempDir };
  }

  // persistent — passthrough
  return { mode, modifiedArgs: remaining };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DEFAULT_MODE = 'persistent';

function createTempProfileDir() {
  const prefix = path.join(os.tmpdir(), 'xb-isolated-');
  const dir = fs.mkdtempSync(prefix);
  return dir;
}

/**
 * Inject --profile <temp-dir> and --cleanup-on-exit into agent-browser args.
 */
function applyIsolatedMode(args, tempDir) {
  const hasProfile = args.some((a, i) =>
    (a === '--profile' || a === '-p') && i + 1 < args.length
  );
  const hasCleanup = args.includes('--cleanup-on-exit');

  const modified = [...args];

  if (!hasProfile) {
    modified.push('--profile', tempDir);
  }

  if (!hasCleanup) {
    modified.push('--cleanup-on-exit');
  }

  return modified;
}

// ---------------------------------------------------------------------------
module.exports = { resolveMode, VALID_MODES, DEFAULT_MODE };
