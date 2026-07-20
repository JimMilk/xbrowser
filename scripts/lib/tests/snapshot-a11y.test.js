#!/usr/bin/env node
'use strict';

/**
 * snapshot-a11y.test.js — tests for snapshot-a11y.js
 *
 * Run: node scripts/lib/tests/snapshot-a11y.test.js
 */

const { parseSnapshot, formatInteractive, formatA11y, formatCompact } = require('../snapshot-a11y.js');

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${label}`);
  }
}

function assertEq(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${label}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
  }
}

function assertContains(str, substr, label) {
  if (str.includes(substr)) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${label} — "${substr}" not found in output`);
    console.log(`    output: ${str.slice(0, 200)}`);
  }
}

function assertNotContains(str, substr, label) {
  if (!str.includes(substr)) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${label} — "${substr}" should NOT be in output`);
    console.log(`    output: ${str.slice(0, 200)}`);
  }
}

// ====== Sample agent-browser snapshot (simplified) ======
const SAMPLE_SNAPSHOT = {
  version: 2,
  elements: [
    { ref: '@e0', role: 'RootWebArea', name: 'Test Page', tag: 'html', children: ['@e1', '@e5'], visible: true, interactable: false, text: '' },
    { ref: '@e1', role: 'banner', name: '', tag: 'header', children: ['@e2'], visible: true, interactable: false, text: '' },
    { ref: '@e2', role: 'navigation', name: 'Main Nav', tag: 'nav', children: ['@e3', '@e4'], visible: true, interactable: false, text: '' },
    { ref: '@e3', role: 'link', name: 'Home', tag: 'a', children: [], visible: true, interactable: true, text: 'Home', attrs: { href: '/' } },
    { ref: '@e4', role: 'link', name: 'About', tag: 'a', children: [], visible: true, interactable: true, text: 'About', attrs: { href: '/about' } },
    { ref: '@e5', role: 'main', name: '', tag: 'main', children: ['@e6', '@e7', '@e8', '@e9'], visible: true, interactable: false, text: '' },
    { ref: '@e6', role: 'heading', name: 'Welcome', tag: 'h1', children: [], visible: true, interactable: false, text: 'Welcome to Test' },
    { ref: '@e7', role: 'button', name: 'Submit', tag: 'button', children: [], visible: true, interactable: true, text: 'Submit', attrs: { type: 'submit' } },
    { ref: '@e8', role: 'textbox', name: 'Username', tag: 'input', children: [], visible: true, interactable: true, text: '', attrs: { type: 'text' } },
    { ref: '@e9', role: 'paragraph', name: '', tag: 'p', children: [], visible: false, interactable: false, text: 'Hidden text here' }
  ]
};

// ====== Test: parseSnapshot ======
console.log('\n-- parseSnapshot --');

(function testParseObject() {
  const result = parseSnapshot(SAMPLE_SNAPSHOT);
  assertEq(result.version, 2, 'parseSnapshot: version from object');
  assertEq(result.elements.length, 10, 'parseSnapshot: 10 elements');
  assertEq(result.rootIdx, 0, 'parseSnapshot: rootIdx = 0');
})();

(function testParseString() {
  const json = JSON.stringify(SAMPLE_SNAPSHOT);
  const result = parseSnapshot(json);
  assertEq(result.version, 2, 'parseSnapshot: version from JSON string');
  assertEq(result.elements.length, 10, 'parseSnapshot: 10 elements from string');
})();

(function testParseArray() {
  const result = parseSnapshot(SAMPLE_SNAPSHOT.elements);
  assertEq(result.version, 2, 'parseSnapshot: version from array');
  assertEq(result.elements.length, 10, 'parseSnapshot: 10 elements from array');
  assertEq(result.rootIdx, 0, 'parseSnapshot: rootIdx=0 from array');
})();

(function testParseNull() {
  const result = parseSnapshot(null);
  assertEq(result.elements.length, 0, 'parseSnapshot: null → empty elements');
  assertEq(result.rootIdx, null, 'parseSnapshot: null → null rootIdx');
})();

(function testParseInvalidString() {
  const result = parseSnapshot('not json');
  assert(result.parseError === true, 'parseSnapshot: invalid JSON sets parseError');
  assertEq(result.elements.length, 0, 'parseSnapshot: invalid JSON → empty');
})();

// ====== Test: formatInteractive ======
console.log('\n-- formatInteractive --');

(function testFormatInteractive() {
  const snap = parseSnapshot(SAMPLE_SNAPSHOT);
  const output = formatInteractive(snap);
  const lines = output.split('\n');
  assertEq(lines.length, 4, 'formatInteractive: 4 interactive elements');
  assertContains(output, '@e3', 'formatInteractive: contains @e3');
  assertContains(output, '@e4', 'formatInteractive: contains @e4');
  assertContains(output, '@e7', 'formatInteractive: contains @e7');
  assertContains(output, '@e8', 'formatInteractive: contains @e8');
  assertNotContains(output, '@e6', 'formatInteractive: heading e6 excluded (not interactable)');
  assertNotContains(output, '@e9', 'formatInteractive: hidden paragraph e9 excluded');
})();

(function testFormatInteractiveEmpty() {
  const snap = parseSnapshot({ elements: [] });
  assertEq(formatInteractive(snap), '', 'formatInteractive: empty → empty string');
})();

// ====== Test: formatA11y ======
console.log('\n-- formatA11y --');

(function testFormatA11y() {
  const snap = parseSnapshot(SAMPLE_SNAPSHOT);
  const output = formatA11y(snap);
  const lines = output.split('\n');
  assert(lines.length >= 10, 'formatA11y: at least 10 lines');
  assertContains(output, 'RootWebArea "Test Page" (@e0)', 'formatA11y: root element');
  assertContains(output, '[interactive]', 'formatA11y: contains interactive state');
  assertContains(output, 'button "Submit" (@e7)', 'formatA11y: contains button');
  assertContains(output, 'textbox "Username" (@e8)', 'formatA11y: contains textbox');
  // Hidden element should be marked
  assertContains(output, 'hidden', 'formatA11y: hidden paragraph marked as hidden');
})();

(function testFormatA11yEmpty() {
  const snap = parseSnapshot({ elements: [] });
  assertEq(formatA11y(snap), '', 'formatA11y: empty → empty string');
})();

// ====== Test: formatCompact ======
console.log('\n-- formatCompact --');

(function testFormatCompact() {
  const snap = parseSnapshot(SAMPLE_SNAPSHOT);
  const output = formatCompact(snap);
  const lines = output.split('\n');
  assertEq(lines.length, 10, 'formatCompact: 10 elements');
  assertContains(output, '@e3', 'formatCompact: contains @e3');
  assertContains(output, '@e7', 'formatCompact: contains @e7');
  assertContains(output, '[I]', 'formatCompact: interactive flag');
  // Hidden element should have [h]
  assertContains(output, '[h]', 'formatCompact: hidden flag');
})();

(function testFormatCompactEmpty() {
  const snap = parseSnapshot({ elements: [] });
  assertEq(formatCompact(snap), '', 'formatCompact: empty → empty string');
})();

// ====== Test: FULL_SNAPSHOT_VERBS ======
console.log('\n-- FULL_SNAPSHOT_VERBS --');

(function testSnapshotVerbs() {
  const { FULL_SNAPSHOT_VERBS } = require('../snapshot-a11y.js');
  assert(FULL_SNAPSHOT_VERBS.has('snapshot'), 'FULL_SNAPSHOT_VERBS: snapshot');
  assert(FULL_SNAPSHOT_VERBS.has('screenshot'), 'FULL_SNAPSHOT_VERBS: screenshot');
  assert(FULL_SNAPSHOT_VERBS.has('pdf'), 'FULL_SNAPSHOT_VERBS: pdf');
  assert(!FULL_SNAPSHOT_VERBS.has('click'), 'FULL_SNAPSHOT_VERBS: NOT click');
})();

// ====== Summary ======
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);

process.exitCode = failed > 0 ? 1 : 0;
