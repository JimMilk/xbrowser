#!/usr/bin/env node
'use strict';

/**
 * mode.test.js — tests for mode.js
 *
 * Run: node scripts/lib/tests/mode.test.js
 */

const { resolveMode, VALID_MODES, DEFAULT_MODE } = require('../mode.js');
const os = require('os');
const fs = require('fs');

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label}`); }
}

function assertEq(actual, expected, label) {
  if (actual === expected) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label}`); console.log(`    expected: ${expected}`); console.log(`    actual:   ${actual}`); }
}

function assertContains(arr, val, label) {
  if (arr.includes(val)) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label} — ${val} not in array`); console.log(`    array: ${JSON.stringify(arr)}`); }
}

function assertGt(actual, min, label) {
  if (actual > min) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label} — expected > ${min}`); }
}

// ====== Test: VALID_MODES and DEFAULT_MODE ======
console.log('\n-- constants --');
assertEq(DEFAULT_MODE, 'persistent', 'DEFAULT_MODE = persistent');
assert(Array.isArray(VALID_MODES), 'VALID_MODES is array');
assertContains(VALID_MODES, 'persistent', 'persistent is valid');
assertContains(VALID_MODES, 'isolated', 'isolated is valid');

// ====== Test: resolveMode — persistent (default) ======
console.log('\n-- resolveMode: persistent --');

(function testPersistentDefault() {
  const config = { browser: { mode: 'persistent' } };
  const args = ['open', 'https://example.com'];
  const result = resolveMode(config, args);
  assertEq(result.mode, 'persistent', 'persistent: mode from config');
  assertEq(result.modifiedArgs.length, 2, 'persistent: args unchanged');
  assertEq(result.modifiedArgs[0], 'open', 'persistent: first arg preserved');
})();

(function testPersistentNullConfig() {
  const args = ['open', 'https://example.com'];
  const result = resolveMode(null, args);
  assertEq(result.mode, 'persistent', 'persistent: null config defaults to persistent');
})();

// ====== Test: resolveMode — isolated ======
console.log('\n-- resolveMode: isolated --');

(function testIsolatedModeOnly() {
  const config = { browser: { mode: 'isolated' } };
  const args = ['open', 'https://example.com'];
  const result = resolveMode(config, args);
  assertEq(result.mode, 'isolated', 'isolated: mode from config');
  assert(result.tempDir, 'isolated: tempDir created');
  assert(fs.existsSync(result.tempDir), 'isolated: tempDir exists on disk');
  assertContains(result.modifiedArgs, '--profile', 'isolated: --profile injected');
  assertContains(result.modifiedArgs, '--cleanup-on-exit', 'isolated: --cleanup-on-exit injected');
  assertContains(result.modifiedArgs, 'open', 'isolated: original args preserved');
  // Cleanup
  try { fs.rmdirSync(result.tempDir); } catch(e) {}
})();

// ====== Test: resolveMode — explicit --mode flag ======
console.log('\n-- resolveMode: explicit --mode flag --');

(function testExplicitModeOverridesConfig() {
  const config = { browser: { mode: 'persistent' } };
  const args = ['--mode', 'isolated', 'open', 'https://example.com'];
  const result = resolveMode(config, args);
  assertEq(result.mode, 'isolated', 'explicit --mode isolated overrides config persistent');
  assert(result.tempDir, 'explicit --mode: tempDir created');
  assertContains(result.modifiedArgs, '--profile', 'explicit --mode: --profile injected');
  // Cleanup
  try { fs.rmdirSync(result.tempDir); } catch(e) {}
})();

(function testExplicitModeOnCmdLine() {
  const config = { browser: { mode: 'isolated' } };
  const args = ['--mode', 'persistent', 'open', 'https://example.com'];
  const result = resolveMode(config, args);
  assertEq(result.mode, 'persistent', 'explicit --mode persistent overrides config isolated');
  assert(!result.tempDir, 'explicit persistent: no tempDir');
  assert(!result.modifiedArgs.includes('--profile'), 'explicit persistent: no --profile injected');
})();

// ====== Test: resolveMode — invalid mode ======
console.log('\n-- resolveMode: invalid --');

(function testInvalidMode() {
  const args = ['--mode', 'nonsense', 'open'];
  const result = resolveMode({ browser: { mode: 'persistent' } }, args);
  assertEq(result.mode, 'nonsense', 'invalid mode: passed through');
  assert(result.invalidMode, 'invalid mode: invalidMode=true');
})();

// ====== Test: resolveMode — no args ======
console.log('\n-- resolveMode: edge cases --');

(function testNullArgs() {
  const result = resolveMode({ browser: { mode: 'persistent' } }, null);
  assertEq(result.mode, 'persistent', 'null args: defaults to persistent');
  assertEq(result.modifiedArgs.length, 0, 'null args: empty modifiedArgs');
})();

(function testEmptyArgs() {
  const result = resolveMode({ browser: { mode: 'isolated' } }, []);
  assertEq(result.mode, 'isolated', 'empty args: mode from config');
})();

// ====== Summary ======
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);

process.exitCode = failed > 0 ? 1 : 0;
