'use strict';

/**
 * Verify — post-action assertion wrappers for browser automation.
 *
 * Exports:
 *   verifyCommand(args) → { ok, error?, hint? }
 *
 * Supported verify subcommands:
 *   verify text  <expected>    — page body contains expected text
 *   verify url   <expected>    — current URL matches expected
 *   verify title <expected>    — page title contains expected
 *
 * This module generates the agent-browser command sequence needed to
 * perform the verification. Actual execution is handled by the caller
 * (typically xb-v2.mjs or the run pipeline).
 *
 * Returns the command list and assertion metadata so the caller can:
 *   1. Execute `get text` / `get url` / `get title`
 *   2. Compare result against expected
 *   3. Return { ok, error, hint }
 */

// ---------------------------------------------------------------------------
// verifyCommand
// ---------------------------------------------------------------------------
/**
 * Analyze verify args and return command plan + assertion.
 *
 * @param {string[]} args — e.g. ['verify', 'text', 'hello']
 * @returns {{ ok: boolean, error?: string, hint?: string, assertion?: object }}
 */
function verifyCommand(args) {
  if (!args || args.length < 2) {
    return {
      ok: false,
      error: 'verify requires a subcommand and value',
      hint: 'Usage: verify <text|url|title> <expected>'
    };
  }

  const subcommand = String(args[0] || '').toLowerCase();
  const expected = args.slice(1).join(' ');

  if (!expected) {
    return {
      ok: false,
      error: `verify ${subcommand} requires an expected value`,
      hint: `Usage: verify ${subcommand} "<expected value>"`
    };
  }

  switch (subcommand) {
    case 'text':
      return buildTextVerify(expected);
    case 'url':
      return buildUrlVerify(expected);
    case 'title':
      return buildTitleVerify(expected);
    default:
      return {
        ok: false,
        error: `Unknown verify subcommand: "${subcommand}"`,
        hint: 'Valid subcommands: text, url, title'
      };
  }
}

/**
 * Execute a verify assertion against actual result.
 *
 * @param {string} subcommand — 'text' | 'url' | 'title'
 * @param {string} expected
 * @param {string} actual
 * @returns {{ ok: boolean, error?: string, hint?: string }}
 */
function assertResult(subcommand, expected, actual) {
  if (actual === null || actual === undefined) {
    return {
      ok: false,
      error: `verify ${subcommand}: no result returned from browser`,
      hint: 'Ensure the page has loaded before running verify'
    };
  }

  const actualStr = String(actual);

  switch (subcommand) {
    case 'text':
    case 'title':
      if (!actualStr.includes(expected)) {
        const preview = actualStr.length > 200
          ? actualStr.slice(0, 200) + '...'
          : actualStr;
        return {
          ok: false,
          error: `verify ${subcommand}: expected "${expected}" not found in page`,
          hint: `Actual content: ${preview}`
        };
      }
      return { ok: true };

    case 'url':
      // Normalize trailing slashes for comparison
      const normActual = actualStr.replace(/\/$/, '');
      const normExpected = expected.replace(/\/$/, '');
      if (normActual !== normExpected) {
        return {
          ok: false,
          error: `verify url: expected "${expected}", got "${actualStr}"`,
          hint: 'Check for redirects or URL parameters'
        };
      }
      return { ok: true };

    default:
      return {
        ok: false,
        error: `Unknown verify subcommand: "${subcommand}"`
      };
  }
}

// ---------------------------------------------------------------------------
// Builders — return the agent-browser get command for each type
// ---------------------------------------------------------------------------
function buildTextVerify(expected) {
  return {
    ok: true,
    assertion: {
      type: 'text',
      expected,
      getCommand: 'get text',
      compare: (actual) => assertResult('text', expected, actual)
    }
  };
}

function buildUrlVerify(expected) {
  return {
    ok: true,
    assertion: {
      type: 'url',
      expected,
      getCommand: 'get url',
      compare: (actual) => assertResult('url', expected, actual)
    }
  };
}

function buildTitleVerify(expected) {
  return {
    ok: true,
    assertion: {
      type: 'title',
      expected,
      getCommand: 'get title',
      compare: (actual) => assertResult('title', expected, actual)
    }
  };
}

// ---------------------------------------------------------------------------
module.exports = { verifyCommand, assertResult };
