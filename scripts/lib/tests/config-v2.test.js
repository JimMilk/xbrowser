#!/usr/bin/env node
'use strict';

/**
 * config-v2.test.js — edge case tests for config-v2.js
 *
 * Run: node scripts/lib/tests/config-v2.test.js
 */

const { DEFAULT_CONFIG, CAPABILITIES, migrateV1ToV2, mergeConfig, validateConfig } = require('../config-v2.js');

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label}`); }
}

function assertEq(actual, expected, label) {
  if (actual === expected) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label}`); console.log(`    expected: ${JSON.stringify(expected)}`); console.log(`    actual:   ${JSON.stringify(actual)}`); }
}

function assertDeepEq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ FAIL: ${label}`); console.log('    expected:', b); console.log('    actual:', a); }
}

// ====== DEFAULT_CONFIG ======
console.log('\n-- DEFAULT_CONFIG --');
assertEq(DEFAULT_CONFIG.version, 2, 'version = 2');
assertEq(DEFAULT_CONFIG.browser.name, 'cft', 'browser.name = cft');
assertEq(DEFAULT_CONFIG.browser.mode, 'persistent', 'browser.mode = persistent');
assertEq(DEFAULT_CONFIG.browser.headed, true, 'browser.headed = true');
assert(Array.isArray(DEFAULT_CONFIG.capabilities), 'capabilities is array');
assertEq(DEFAULT_CONFIG.capabilities[0], 'core', 'default cap = core');
assertEq(DEFAULT_CONFIG.timeouts.action, 5000, 'timeout.action = 5000');
assertEq(DEFAULT_CONFIG.timeouts.navigation, 30000, 'timeout.navigation = 30000');
assertEq(DEFAULT_CONFIG.output.dir, null, 'output.dir = null');
assertEq(DEFAULT_CONFIG.output.maxSize, null, 'output.maxSize = null');
assertEq(DEFAULT_CONFIG.shield.enabled, true, 'shield.enabled = true');

// ====== CAPABILITIES ======
console.log('\n-- CAPABILITIES --');
assertEq(Object.keys(CAPABILITIES).length, 6, '6 capability groups');
assert(CAPABILITIES.core.includes('open'), 'core includes open');
assert(CAPABILITIES.core.includes('snapshot'), 'core includes snapshot');
assert(CAPABILITIES.core.includes('click'), 'core includes click');
assert(CAPABILITIES.network.includes('route'), 'network includes route');
assert(CAPABILITIES.pdf.includes('pdf'), 'pdf includes pdf');
assert(CAPABILITIES.vision.includes('screenshot'), 'vision includes screenshot');
assert(CAPABILITIES.devtools.includes('console'), 'devtools includes console');
assert(CAPABILITIES.storage.includes('cookies'), 'storage includes cookies');

// ====== migrateV1ToV2 ======
console.log('\n-- migrateV1ToV2 --');
const v1 = { browser: 'chrome', headed: false, profiles: { chrome: { migrated: true } }, created_at: '2025-01-01' };
const v2 = migrateV1ToV2(v1);
assertEq(v2.version, 2, 'migrate: version = 2');
assertEq(v2.browser.name, 'chrome', 'migrate: browser name preserved');
assertEq(v2.browser.headed, false, 'migrate: headed preserved');
assertEq(v2.capabilities[0], 'core', 'migrate: default capabilities');

const nullV2 = migrateV1ToV2(null);
assertEq(nullV2.version, 2, 'migrate null: version = 2');
assertEq(nullV2.browser.name, 'cft', 'migrate null: defaults to cft');

const undefV2 = migrateV1ToV2(undefined);
assertEq(undefV2.version, 2, 'migrate undefined: version = 2');

// ====== mergeConfig ======
console.log('\n-- mergeConfig --');
const merged = mergeConfig(DEFAULT_CONFIG, { timeouts: { action: 10000 } });
assertEq(merged.timeouts.action, 10000, 'merge: timeouts.action = 10000');
assertEq(merged.timeouts.navigation, 30000, 'merge: timeouts.navigation unchanged');

const nullMerge = mergeConfig(DEFAULT_CONFIG, null);
assertDeepEq(nullMerge, DEFAULT_CONFIG, 'merge null: returns base unchanged');

const nullOverride = mergeConfig(DEFAULT_CONFIG, { output: { dir: null } });
assertEq(nullOverride.output.dir, null, 'merge: null overrides existing value');

const arrayOverride = mergeConfig(DEFAULT_CONFIG, { capabilities: ['core', 'network'] });
assertEq(arrayOverride.capabilities.length, 2, 'merge: array replaced (not concatenated)');
assertEq(arrayOverride.capabilities[1], 'network', 'merge: array has right values');

// ====== validateConfig ======
console.log('\n-- validateConfig --');
const validResult = validateConfig(DEFAULT_CONFIG);
assert(validResult.valid, 'validate: DEFAULT_CONFIG is valid');
assertEq(validResult.errors.length, 0, 'validate: no errors');

const badVersion = validateConfig({ version: 1 });
assert(!badVersion.valid, 'validate: version=1 invalid');
assert(badVersion.errors.length > 0, 'validate: version=1 has errors');

const badBrowser = validateConfig({ version: 2, browser: { name: 'firefox' } });
assert(!badBrowser.valid, 'validate: firefox is invalid browser');

const badCap = validateConfig({ version: 2, capabilities: ['core', 'imaginary'] });
assert(!badCap.valid, 'validate: unknown capability rejected');

const badTimeout = validateConfig({ version: 2, timeouts: { action: 'slow' } });
assert(!badTimeout.valid, 'validate: non-number timeout rejected');

const missingVersion = validateConfig({ browser: { name: 'cft' } });
assert(!missingVersion.valid, 'validate: missing version rejected');

const nullConfig = validateConfig(null);
assert(!nullConfig.valid, 'validate: null rejected');

// ====== mergeConfig edge cases ======
console.log('\n-- mergeConfig edge cases --');

// Merge into object that has null field
const base2 = { a: { b: null } };
const override2 = { a: { b: { c: 1 } } };
const merged2 = mergeConfig(base2, override2);
assertEq(merged2.a.b.c, 1, 'merge: override null with object works');

// Merge with empty override
const emptyMerge = mergeConfig(DEFAULT_CONFIG, {});
assertDeepEq(emptyMerge, DEFAULT_CONFIG, 'merge: empty override returns clone of base');

// DEEP: ensure original is not mutated
const original = { foo: 'bar' };
const originalCopy = JSON.stringify(original);
mergeConfig(original, { foo: 'baz' });
assertEq(JSON.stringify(original), originalCopy, 'merge: does not mutate base');

// ====== validateConfig edge cases ======
console.log('\n-- validateConfig edge cases --');

const arrayBrowser = validateConfig({ version: 2, browser: [] });
assert(!arrayBrowser.valid, 'validate: array browser rejected');

const badShield = validateConfig({ version: 2, shield: { enabled: 'yes' } });
assert(!badShield.valid, 'validate: non-boolean shield rejected');

const badOutput = validateConfig({ version: 2, output: 'string' });
assert(!badOutput.valid, 'validate: string output rejected');

// ====== Summary ======
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);

process.exitCode = failed > 0 ? 1 : 0;
