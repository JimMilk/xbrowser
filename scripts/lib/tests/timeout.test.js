#!/usr/bin/env node
'use strict';

/**
 * timeout.test.js — tests for timeout.js
 *
 * Run: node scripts/lib/tests/timeout.test.js
 */

const { ACTION_TIMEOUTS, DEFAULTS, resolveTimeout } = require('../timeout.js');

let passed = 0;
let failed = 0;

function assertEq(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${label}`);
    console.log(`    expected: ${expected}`);
    console.log(`    actual:   ${actual}`);
  }
}

function assertGt(actual, min, label) {
  if (actual > min) {
    passed++;
    console.log(`  ✓ ${label} (${actual} > ${min})`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${label} — expected > ${min}, got ${actual}`);
  }
}

// ====== Test: ACTION_TIMEOUTS mapping ======
console.log('\n-- ACTION_TIMEOUTS --');

(function testNavigationVerbs() {
  assertEq(ACTION_TIMEOUTS.open, 'navigation', 'open → navigation');
  assertEq(ACTION_TIMEOUTS.back, 'navigation', 'back → navigation');
  assertEq(ACTION_TIMEOUTS.forward, 'navigation', 'forward → navigation');
  assertEq(ACTION_TIMEOUTS.reload, 'navigation', 'reload → navigation');
})();

(function testActionVerbs() {
  assertEq(ACTION_TIMEOUTS.click, 'action', 'click → action');
  assertEq(ACTION_TIMEOUTS.fill, 'action', 'fill → action');
  assertEq(ACTION_TIMEOUTS.type, 'action', 'type → action');
  assertEq(ACTION_TIMEOUTS.press, 'action', 'press → action');
  assertEq(ACTION_TIMEOUTS.hover, 'action', 'hover → action');
  assertEq(ACTION_TIMEOUTS.select, 'action', 'select → action');
  assertEq(ACTION_TIMEOUTS.check, 'action', 'check → action');
  assertEq(ACTION_TIMEOUTS.uncheck, 'action', 'uncheck → action');
  assertEq(ACTION_TIMEOUTS.focus, 'action', 'focus → action');
  assertEq(ACTION_TIMEOUTS.keydown, 'action', 'keydown → action');
  assertEq(ACTION_TIMEOUTS.keyup, 'action', 'keyup → action');
  assertEq(ACTION_TIMEOUTS.scroll, 'action', 'scroll → action');
  assertEq(ACTION_TIMEOUTS.scrollintoview, 'action', 'scrollintoview → action');
  assertEq(ACTION_TIMEOUTS.drag, 'action', 'drag → action');
  assertEq(ACTION_TIMEOUTS.upload, 'action', 'upload → action');
})();

(function testSnapshotVerbs() {
  assertEq(ACTION_TIMEOUTS.snapshot, 'snapshot', 'snapshot → snapshot');
  assertEq(ACTION_TIMEOUTS.screenshot, 'snapshot', 'screenshot → snapshot');
  assertEq(ACTION_TIMEOUTS.pdf, 'snapshot', 'pdf → snapshot');
})();

(function testCustomVerb() {
  assertEq(ACTION_TIMEOUTS.wait, 'custom', 'wait → custom');
})();

// ====== Test: resolveTimeout — default (no config, no cli) ======
console.log('\n-- resolveTimeout: defaults --');

(function testNavigationDefault() {
  const t = resolveTimeout('open', null);
  assertEq(t, 30000, 'open: default = 30000ms');
})();

(function testActionDefault() {
  const t = resolveTimeout('click', null);
  assertEq(t, 5000, 'click: default = 5000ms');
})();

(function testSnapshotDefault() {
  const t = resolveTimeout('screenshot', null);
  assertEq(t, 15000, 'screenshot: default = 15000ms');
})();

(function testCustomDefault() {
  const t = resolveTimeout('wait', null);
  assertEq(t, 5000, 'wait: default = 5000ms');
})();

// ====== Test: resolveTimeout — config overrides ======
console.log('\n-- resolveTimeout: config --');

const CUSTOM_CONFIG = {
  timeouts: {
    action: 8000,
    navigation: 45000
  }
};

(function testNavigationConfig() {
  const t = resolveTimeout('open', CUSTOM_CONFIG);
  assertEq(t, 45000, 'open: config.navigation = 45000ms');
})();

(function testActionConfig() {
  const t = resolveTimeout('click', CUSTOM_CONFIG);
  assertEq(t, 8000, 'click: config.action = 8000ms');
})();

(function testSnapshotConfig() {
  // snapshot falls back to config.action first, then DEFAULTS.snapshot
  const t = resolveTimeout('screenshot', CUSTOM_CONFIG);
  assertEq(t, 8000, 'screenshot: config.action = 8000ms (before snapshot default)');
})();

(function testCustomConfig() {
  const t = resolveTimeout('wait', CUSTOM_CONFIG);
  assertEq(t, 8000, 'wait: config.action = 8000ms');
})();

// ====== Test: resolveTimeout — CLI timeout takes priority ======
console.log('\n-- resolveTimeout: cliTimeout --');

(function testCliNavigation() {
  const t = resolveTimeout('open', CUSTOM_CONFIG, 60000);
  assertEq(t, 60000, 'open: cliTimeout=60000 > config=45000');
})();

(function testCliAction() {
  const t = resolveTimeout('click', CUSTOM_CONFIG, 10000);
  assertEq(t, 10000, 'click: cliTimeout=10000 > config=8000');
})();

(function testCliSnapshot() {
  const t = resolveTimeout('screenshot', CUSTOM_CONFIG, 20000);
  assertEq(t, 20000, 'screenshot: cliTimeout=20000 > config=8000');
})();

(function testCliBelowConfig() {
  const t = resolveTimeout('click', CUSTOM_CONFIG, 3000);
  assertEq(t, 3000, 'click: cliTimeout=3000 < config=8000 — CLI wins anyway');
})();

// ====== Test: resolveTimeout — custom (wait) with cap ======
console.log('\n-- resolveTimeout: custom wait cap --');

(function testWaitCliUnderCap() {
  const t = resolveTimeout('wait', CUSTOM_CONFIG, 5000);
  assertEq(t, 5000, 'wait: cliTimeout=5000 ≤ cap=8000 → 5000');
})();

(function testWaitCliOverCap() {
  const t = resolveTimeout('wait', CUSTOM_CONFIG, 30000);
  assertEq(t, 8000, 'wait: cliTimeout=30000 > cap=8000 → capped at 8000');
})();

(function testWaitNoCli() {
  const t = resolveTimeout('wait', CUSTOM_CONFIG);
  assertEq(t, 8000, 'wait: no cliTimeout → config.action=8000');
})();

(function testWaitNoCliNoConfig() {
  const t = resolveTimeout('wait', null);
  assertEq(t, 5000, 'wait: no cli, no config → default action=5000');
})();

// ====== Test: resolveTimeout — unknown verb falls back to action ======
console.log('\n-- resolveTimeout: unknown verb --');

(function testUnknownVerb() {
  const t = resolveTimeout('echo', null);
  assertEq(t, 5000, 'echo (unknown): default action = 5000ms');
})();

// ====== Test: resolveTimeout — zero/negative cliTimeout ignored ======
console.log('\n-- resolveTimeout: edge cases --');

(function testZeroCliTimeout() {
  const t = resolveTimeout('click', null, 0);
  assertEq(t, 5000, 'click: cliTimeout=0 ignored → default 5000');
})();

(function testNegativeCliTimeout() {
  const t = resolveTimeout('click', null, -1);
  assertEq(t, 5000, 'click: cliTimeout=-1 ignored → default 5000');
})();

(function testNullCliTimeout() {
  const t = resolveTimeout('open', CUSTOM_CONFIG, null);
  assertEq(t, 45000, 'open: cliTimeout=null → config.navigation=45000');
})();

// ====== Test: DEFAULTS ======
console.log('\n-- DEFAULTS --');

(function testDefaults() {
  assertEq(DEFAULTS.navigation, 30000, 'DEFAULTS.navigation = 30000');
  assertEq(DEFAULTS.action, 5000, 'DEFAULTS.action = 5000');
  assertEq(DEFAULTS.snapshot, 15000, 'DEFAULTS.snapshot = 15000');
})();

// ====== Summary ======
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);

process.exitCode = failed > 0 ? 1 : 0;
