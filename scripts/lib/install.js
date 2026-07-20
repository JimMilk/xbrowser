'use strict';

/**
 * Install — install Chrome for Testing or system dependencies.
 *
 * Exports:
 *   installCommand(args) → { ok, error?, hint?, data? }
 *
 * Usage:
 *   xb install chrome      → install Chrome for Testing
 *   xb install deps        → install system dependencies (Linux only)
 */

const { execFileSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Path constants — mirrors xb.cjs constants module
const homeDir = os.homedir();
const stateDir = (process.env.OPENCLAW_STATE_DIR || '').trim() || path.join(homeDir, '.openclaw');
const XBROWSER_DIR = path.join(stateDir, 'tools', 'xbrowser');

function findAgentBrowserBin() {
  const platform = os.platform();
  const arch = os.arch();
  const map = {
    'darwin-x64': 'agent-browser-darwin-x64',
    'darwin-arm64': 'agent-browser-darwin-arm64',
    'linux-x64': 'agent-browser-linux-x64',
    'linux-arm64': 'agent-browser-linux-arm64',
    'win32-x64': 'agent-browser-win32-x64.exe',
    'win32-arm64': 'agent-browser-win32-arm64.exe'
  };
  const key = `${platform}-${arch}`;
  const binName = map[key];
  if (!binName) return null;
  return path.join(XBROWSER_DIR, 'node_modules', 'agent-browser', 'bin', binName);
}

// ---------------------------------------------------------------------------
// installCommand
// ---------------------------------------------------------------------------
/**
 * @param {string[]} args — e.g. ['chrome'] or ['deps']
 * @returns {{ ok: boolean, error?: string, hint?: string }}
 */
function installCommand(args) {
  if (!args || args.length === 0) {
    return {
      ok: false,
      error: 'Missing install target',
      hint: 'Usage: xb install <chrome|deps>'
    };
  }

  const target = String(args[0]).toLowerCase();

  switch (target) {
    case 'chrome':
      return installChrome();
    case 'deps':
      return installDeps();
    default:
      return {
        ok: false,
        error: `Unknown install target: "${target}"`,
        hint: 'Valid targets: chrome, deps'
      };
  }
}

// ---------------------------------------------------------------------------
// installChrome
// ---------------------------------------------------------------------------
function installChrome() {
  const bin = findAgentBrowserBin();

  if (!bin) {
    // Fallback: try the JS wrapper
    const jsBin = path.join(XBROWSER_DIR, 'node_modules', 'agent-browser', 'bin', 'agent-browser.js');
    if (fs.existsSync(jsBin)) {
      return installWithBin('node', [jsBin, '--json', 'install']);
    }
    return {
      ok: false,
      error: 'agent-browser binary not found',
      hint: 'Run xb setup first to install agent-browser'
    };
  }

  if (!fs.existsSync(bin)) {
    return {
      ok: false,
      error: `agent-browser binary not found at: ${bin}`,
      hint: 'Run xb setup first to install agent-browser'
    };
  }

  return installWithBin(bin, ['--json', 'install']);
}

function installWithBin(bin, args) {
  try {
    const platform = os.platform();
    // On Linux, also install system deps
    if (platform === 'linux') {
      args.push('--with-deps');
    }

    const output = execFileSync(bin, args, {
      encoding: 'utf8',
      timeout: 300000, // 5 min for download
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let parsed;
    try {
      parsed = JSON.parse(output);
    } catch {
      parsed = { raw: output };
    }

    return {
      ok: true,
      data: { installed: true, ...parsed }
    };
  } catch (err) {
    const stderr = err.stderr || '';
    const message = err.message || 'Unknown error';

    return {
      ok: false,
      error: `Chrome installation failed: ${message}`,
      hint: stderr
        ? `Details: ${stderr.slice(0, 500)}`
        : 'Check network connectivity or proxy settings'
    };
  }
}

// ---------------------------------------------------------------------------
// installDeps
// ---------------------------------------------------------------------------
function installDeps() {
  if (os.platform() !== 'linux') {
    return {
      ok: true,
      data: {
        installed: false,
        message: 'System dependencies are only needed on Linux. Nothing to do.'
      }
    };
  }

  const bin = findAgentBrowserBin();
  if (!bin || !fs.existsSync(bin)) {
    return {
      ok: false,
      error: 'agent-browser binary not found',
      hint: 'Run xb setup first to install agent-browser'
    };
  }

  try {
    const output = execFileSync(bin, ['--json', 'install', '--with-deps'], {
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return {
      ok: true,
      data: { installed: true, output: output.trim().slice(0, 1000) }
    };
  } catch (err) {
    return {
      ok: false,
      error: `Dependency installation failed: ${err.message}`,
      hint: 'You may need to install manually: sudo apt-get install -y libnss3 libgbm1 libasound2'
    };
  }
}

// ---------------------------------------------------------------------------
module.exports = { installCommand };
