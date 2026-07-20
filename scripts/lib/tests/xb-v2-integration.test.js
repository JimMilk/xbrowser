#!/usr/bin/env node
'use strict';

/**
 * xb-v2-integration.test.js — integration tests for xb-v2.mjs's resolve pipeline.
 *
 * Tests the key functions from xb-v2.mjs that wire modules together.
 * We don't import xb-v2.mjs directly (it's ESM + has side effects),
 * so we test the integration logic by re-implementing the critical path.
 *
 * Run: node scripts/lib/tests/xb-v2-integration.test.js
 */

const modeLib = require('../mode.js');
const timeoutLib = require('../timeout.js');
const snapshotA11y = require('../snapshot-a11y.js');

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
  else { failed++; console.log(`  ✗ FAIL: ${label} — ${val} not in`); console.log(`    array: ${JSON.stringify(arr)}`); }
}

function assertNotContains(arr, val, label) {
  if (!arr.includes(val)) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label} — ${val} should NOT be in`); console.log(`    array: ${JSON.stringify(arr)}`); }
}

// ====== Bug reproduction: --mode isolated is dropped by xb-v2.mjs ======
// 
// xb-v2.mjs extracts --mode from rawArgs, strips it, then calls
// resolveRunArgs(subArgs, mode) where:
//   - subArgs are the stripped args (no --mode)
//   - mode is the extracted value (e.g. 'isolated')
//
// But resolveRunArgs does NOT pass mode back into modeLib.resolveMode()!
// Mode.js only scans args for --mode (not present after stripping).
//
// RESULT: --mode isolated → mode.js falls back to config → always 'persistent'
//
// FIX: resolveRunArgs must re-inject --mode into args before calling modeLib

console.log('\n-- BUG: --mode isolated dropped by xb-v2.mjs --');

// Simulate xb-v2.mjs extraction
console.log('\n  Step 1: xb-v2.mjs extracts --mode from CLI rawArgs');
const rawArgs = ['--mode', 'isolated', 'run', 'open', 'https://example.com'];
const modeIdx = rawArgs.indexOf('--mode');
const explicitMode = modeIdx >= 0 ? rawArgs[modeIdx + 1] : null;
const argsAfterMode = rawArgs.slice(2); // strips '--mode isolated'
assertEq(explicitMode, 'isolated', 'extracted mode = isolated');
assertEq(argsAfterMode[0], 'run', 'after extraction: command = run');
assertNotContains(argsAfterMode, '--mode', 'after extraction: --mode stripped');
assertNotContains(argsAfterMode, 'isolated', 'after extraction: isolated stripped');

console.log('\n  Step 2: resolveRunArgs(subArgs, mode) is called');
const subcommand = argsAfterMode[0]; // 'run'
const subArgs = argsAfterMode.slice(1); // ['open', 'https://example.com']
assertEq(subcommand, 'run', 'subcommand = run');
assertEq(subArgs[0], 'open', 'subArgs[0] = open');
assertEq(subArgs[1], 'https://example.com', 'subArgs[1] = url');

console.log('\n  Step 3: resolveRunArgs calls modeLib.resolveMode(config, subArgs)');
console.log('  BUT subArgs has no --mode (was stripped in step 1)!');
const bugResult = modeLib.resolveMode(
  { browser: { mode: 'persistent' } },
  subArgs  // ❌ BUG: no --mode in subArgs!
);
assertEq(bugResult.mode, 'persistent', 'BUG CONFIRMED: mode falls back to config → persistent (should be isolated)');
assert(!bugResult.tempDir, 'BUG CONFIRMED: no tempDir created (should exist for isolated)');

console.log('\n  Step 4: FIX — re-inject --mode into args before modeLib call');
const fixedArgs = ['--mode', explicitMode, ...subArgs];
const fixedResult = modeLib.resolveMode(
  { browser: { mode: 'persistent' } },
  fixedArgs  // ✅ --mode isolated is now in args
);
assertEq(fixedResult.mode, 'isolated', 'FIXED: mode = isolated');
assert(fixedResult.tempDir, 'FIXED: tempDir created');
assertContains(fixedResult.modifiedArgs, '--profile', 'FIXED: --profile injected');
assertContains(fixedResult.modifiedArgs, '--cleanup-on-exit', 'FIXED: --cleanup-on-exit injected');
assertContains(fixedResult.modifiedArgs, 'open', 'FIXED: original args preserved');
// Cleanup
try { require('fs').rmdirSync(fixedResult.tempDir); } catch(e) {}

// ====== Test: --mode persistent should NOT inject profile ======
console.log('\n-- Test: --mode persistent (should not inject profile) --');
const persistentArgs = ['--mode', 'persistent', 'open', 'https://example.com'];
const persistentResult = modeLib.resolveMode(
  { browser: { mode: 'persistent' } },
  persistentArgs
);
assertEq(persistentResult.mode, 'persistent', 'persistent: mode = persistent');
assert(!persistentResult.tempDir, 'persistent: no tempDir');
assertNotContains(persistentResult.modifiedArgs, '--profile', 'persistent: no --profile');

// ====== Test: --mode without explicit mode (uses config) ======
console.log('\n-- Test: config-driven mode (no --mode in args) --');
const configArgs = ['open', 'https://example.com'];
const configResult = modeLib.resolveMode(
  { browser: { mode: 'isolated' } },
  configArgs
);
assertEq(configResult.mode, 'isolated', 'config: mode = isolated from config');
assert(configResult.tempDir, 'config: tempDir created');
// Cleanup
try { require('fs').rmdirSync(configResult.tempDir); } catch(e) {}

// ====== Test: timeout resolver pipeline ======
console.log('\n-- Test: timeout resolution in run pipeline --');
const clickTimeout = timeoutLib.resolveTimeout('click', null, null);
assertEq(clickTimeout, 5000, 'click timeout = 5000ms (default)');

const openTimeout = timeoutLib.resolveTimeout('open', null, null);
assertEq(openTimeout, 30000, 'open timeout = 30000ms (default)');

const explicitTimeout = timeoutLib.resolveTimeout('click', null, 10000);
assertEq(explicitTimeout, 10000, 'click with --timeout 10000 = 10000');

// ====== Test: a11y flag detection in snapshot pipeline ======
console.log('\n-- Test: a11y flag detection --');
const snapA11yArgs = ['snapshot', '--a11y'];
assertEq(snapshotA11y.FULL_SNAPSHOT_VERBS.has('snapshot'), true, 'snapshot supports a11y');
assertEq(snapshotA11y.FULL_SNAPSHOT_VERBS.has('screenshot'), true, 'screenshot supports a11y');
assertEq(snapshotA11y.FULL_SNAPSHOT_VERBS.has('click'), false, 'click does NOT support a11y');

// ====== Summary ======
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);

process.exitCode = failed > 0 ? 1 : 0;
