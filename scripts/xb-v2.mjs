#!/usr/bin/env node

/**
 * xb-v2 — Next-generation entry point for xbrowser.
 *
 * Wraps the existing xb.cjs CLI with V2 config, --mode resolution,
 * watchdog protection, verify assertions, and install commands.
 *
 * Usage:
 *   node xb-v2.mjs [--mode isolated|persistent] <command> [args...]
 *
 * V2-only commands:
 *   xb install chrome    — install Chrome for Testing
 *   xb install deps      — install system deps (Linux)
 *
 * V2 mode semantics:
 *   --mode isolated       — temp profile, cleanup on exit
 *   --mode persistent     — reuse profiles/cookies (default)
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Internal require for loading CJS modules
const require = createRequire(import.meta.url);

// --------------------------------------------------------------------------
// Load V2 modules
// --------------------------------------------------------------------------
const configV2     = require('./lib/config-v2.js');
const modeLib      = require('./lib/mode.js');
const watchdog     = require('./lib/watchdog.js');
const verifyLib    = require('./lib/verify.js');
const installLib   = require('./lib/install.js');
const timeoutLib   = require('./lib/timeout.js');
// Path to the legacy xb.cjs
const XB_CJS_PATH = join(__dirname, 'xb.cjs');
const NODE_BIN = process.env.QCLAW_CLI_NODE_BINARY || 'node';

// --------------------------------------------------------------------------
// Output helpers (match xb.cjs format for compatibility)
// --------------------------------------------------------------------------
function ok(command, data, warnings) {
  const result = { ok: true, command };
  if (data !== undefined) result.data = data;
  if (warnings && warnings.length > 0) result.warnings = warnings;
  return result;
}

function fail(command, error, hint, data, warnings) {
  const result = { ok: false, command, error };
  if (hint) result.hint = hint;
  if (data !== undefined) result.data = data;
  if (warnings && warnings.length > 0) result.warnings = warnings;
  return result;
}

function output(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

// --------------------------------------------------------------------------
// Delegate to legacy xb.cjs
// --------------------------------------------------------------------------
function delegateToV1(args) {
  const result = spawnSync(NODE_BIN, [XB_CJS_PATH, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000
  });

  if (result.error) {
    return fail('xb', `Failed to execute xb.cjs: ${result.error.message}`);
  }

  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    return fail('xb', 'No output from xb.cjs');
  }

  try {
    return JSON.parse(stdout);
  } catch {
    // If not JSON, just pass through raw text
    return { ok: true, command: 'xb', raw: stdout };
  }
}

// --------------------------------------------------------------------------
// Run argument resolution (V2: mode + timeout + a11y)
// --------------------------------------------------------------------------
/**
 * Resolve run args through V2 pipeline:
 *   1. --mode → inject isolated/persistent args
 *   2. --timeout → resolveTimeout for the action verb
 *   3. snapshot --a11y / -i / -c → rewrite args for a11y formatting
 *
 * @param {string[]} subArgs — args after 'run'
 * @param {string|null} mode — from --mode flag
 * @returns {{ args: string[], a11yMode: string|null, tempDir: string|null, error?: string, hint?: string }}
 */
function resolveRunArgs(subArgs, mode) {
  // --- 1. Mode resolution ---
  // Re-inject --mode flag so modeLib can detect it.
  // xb-v2.mjs strips --mode from rawArgs at dispatch time;
  // modeLib.resolveMode scans args for the flag, so we must put it back.
  let args = mode ? ['--mode', mode, ...subArgs] : [...subArgs];

  const { modifiedArgs, invalidMode, tempDir } = modeLib.resolveMode(
    { browser: { mode: 'persistent' } },
    args
  );

  if (invalidMode) {
    return { args: [], error: `Invalid --mode value: "${mode}"`, hint: 'Valid modes: persistent, isolated' };
  }

  args = modifiedArgs;

  // --- 2. Timeout resolution ---
  // Extract existing --timeout from args (for --timeout injection if needed)
  const timeoutIdx = args.indexOf('--timeout');
  let cliTimeout = null;
  if (timeoutIdx >= 0 && timeoutIdx + 1 < args.length) {
    cliTimeout = parseInt(args[timeoutIdx + 1], 10);
    // Remove so we can re-inject computed timeout at the end
    args.splice(timeoutIdx, 2);
  }

  // Determine the action verb (first non-flag arg)
  const verb = args.length > 0 ? args[0] : null;

  // --- 3. A11y snapshot flag detection ---
  const a11yMode = detectA11yMode(args);
  if (a11yMode) {
    // Strip the a11y/snapshot flags we added, pass cleaned args to agent-browser
    args = stripA11yFlags(args);
  }

  // --- Resolve timeout ---
  if (verb) {
    const effectiveTimeout = timeoutLib.resolveTimeout(verb, null, isNaN(cliTimeout) ? null : cliTimeout);
    // Inject --timeout before the verb
    args.unshift('--timeout', String(effectiveTimeout));
  }

  return { args, a11yMode, tempDir: tempDir || null };
}

/**
 * Detect a11y mode flags from snapshot verb args.
 * Returns 'interactive' | 'a11y' | 'compact' | null
 */
function detectA11yMode(args) {
  const verb = args.length > 0 ? String(args[0]).toLowerCase() : '';
  // Only 'snapshot' verb supports a11y formatting. screenshot/pdf do not.
  if (verb !== 'snapshot') return null;

  // Check for --a11y flag
  if (args.includes('--a11y')) return 'a11y';
  // -c for compact
  if (args.includes('-c')) return 'compact';
  // -i for interactive (default)
  if (args.includes('-i')) return 'interactive';

  return null;
}

/**
 * Strip a11y/formatting flags from args, leaving only agent-browser args.
 */
function stripA11yFlags(args) {
  return args.filter(a => a !== '--a11y' && a !== '-c' && a !== '-i');
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
async function main() {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0) {
    // Delegate help to V1
    output(delegateToV1([]));
    return;
  }

  // --- Extract --mode early (before dispatch) ---
  const modeIdx = rawArgs.indexOf('--mode');
  let mode = null;
  let argsAfterMode = [...rawArgs];

  if (modeIdx >= 0 && modeIdx + 1 < rawArgs.length) {
    mode = rawArgs[modeIdx + 1];
    argsAfterMode = [
      ...rawArgs.slice(0, modeIdx),
      ...rawArgs.slice(modeIdx + 2)
    ];
  }

  // --- Dispatch ---
  const subcommand = argsAfterMode[0];
  const subArgs = argsAfterMode.slice(1);

  // V2-only commands
  if (subcommand === 'install') {
    const result = installLib.installCommand(subArgs);
    output(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (subcommand === 'verify') {
    // verify is a post-action; it can't run standalone in this model
    // Return the assertion plan for the caller to execute
    const result = verifyLib.verifyCommand(subArgs);
    output(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (subcommand === 'config-v2') {
    // Show V2 config schema (debug/development)
    const result = ok('config-v2', {
      default: configV2.DEFAULT_CONFIG,
      capabilities: configV2.CAPABILITIES,
      known_capabilities: configV2.KNOWN_CAPABILITIES
    });
    output(result);
    return;
  }

  // --- V2 mode injection for 'run' command ---
  let finalArgs = [...argsAfterMode];

  if (subcommand === 'run') {
    // Resolve run args (mode, timeout, a11y flags)
    const runResolved = resolveRunArgs(subArgs, mode);

    if (runResolved.error) {
      output(fail('run', runResolved.error, runResolved.hint));
      process.exitCode = 1;
      return;
    }

    // Register tempDir cleanup for isolated sessions
    if (runResolved.tempDir) {
      const temp = runResolved.tempDir;
      process.on('exit', () => {
        try { fs.rmSync(temp, { recursive: true, force: true }); } catch {}
      });
      process.stderr.write(`[xb-v2] isolated session, temp profile: ${temp}\n`);
    }

    finalArgs = ['run', ...runResolved.args];
  } else if (mode && subcommand !== 'install' && subcommand !== 'verify' && subcommand !== 'config-v2') {
    // Warn about --mode on non-run commands
    process.stderr.write(`[xb-v2] --mode is only meaningful for 'run'. Ignoring.\n`);
  }

  // --- Set up watchdog ---
  watchdog.setupWatchdog(() => {
    // Re-use existing cleanup behavior
    process.stderr.write('[xb-v2] watchdog: running cleanup...\n');
    delegateToV1(['cleanup']);
  });

  // --- Delegate everything else to V1 ---
  const result = delegateToV1(finalArgs);
  output(result);
  process.exitCode = result.ok ? 0 : 1;
}

// --------------------------------------------------------------------------
// Go
// --------------------------------------------------------------------------
main().catch((err) => {
  output(fail('xb-v2', `Internal error: ${err.message}`, 'xb help'));
  process.exitCode = 1;
});
