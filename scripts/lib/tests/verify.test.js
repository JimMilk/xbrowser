#!/usr/bin/env node
'use strict';

/**
 * verify.test.js — tests for verify.js
 *
 * Run: node scripts/lib/tests/verify.test.js
 */

const { verifyCommand, assertResult } = require('../verify.js');

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

// ====== Test: verifyCommand — valid ======
console.log('\n-- verifyCommand: valid --');
const textPlan = verifyCommand(['text', 'hello world']);
assert(textPlan.ok, 'text: ok');
assertEq(textPlan.assertion.type, 'text', 'text: type = text');
assertEq(textPlan.assertion.expected, 'hello world', 'text: expected preserved');
assertEq(textPlan.assertion.getCommand, 'get text', 'text: getCommand = get text');
assert(typeof textPlan.assertion.compare === 'function', 'text: compare is function');

const urlPlan = verifyCommand(['url', 'https://example.com']);
assert(urlPlan.ok, 'url: ok');
assertEq(urlPlan.assertion.type, 'url', 'url: type = url');
assertEq(urlPlan.assertion.getCommand, 'get url', 'url: getCommand = get url');

const titlePlan = verifyCommand(['title', 'Dashboard']);
assert(titlePlan.ok, 'title: ok');

// ====== Test: verifyCommand — edge cases ======
console.log('\n-- verifyCommand: edge cases --');
const empty = verifyCommand([]);
assert(!empty.ok, 'empty args: fail');

const noValue = verifyCommand(['text']);
assert(!noValue.ok, 'no value: fail');

const unknown = verifyCommand(['element', 'something']);
assert(!unknown.ok, 'unknown subcommand: fail');

// ====== Test: assertResult — text ======
console.log('\n-- assertResult: text --');
const textMatch = assertResult('text', 'hello', '<html>hello world</html>');
assert(textMatch.ok, 'text match: ok');

const textNoMatch = assertResult('text', 'goodbye', '<html>hello world</html>');
assert(!textNoMatch.ok, 'text mismatch: fail');

const textNull = assertResult('text', 'hello', null);
assert(!textNull.ok, 'text null result: fail');

const textUndefined = assertResult('text', 'hello', undefined);
assert(!textUndefined.ok, 'text undefined result: fail');

// ====== Test: assertResult — url ======
console.log('\n-- assertResult: url --');
const urlMatch = assertResult('url', 'https://example.com', 'https://example.com');
assert(urlMatch.ok, 'url exact match: ok');

const urlTrailing = assertResult('url', 'https://example.com', 'https://example.com/');
assert(urlTrailing.ok, 'url trailing slash normalized: ok');

const urlMismatch = assertResult('url', 'https://a.com', 'https://b.com');
assert(!urlMismatch.ok, 'url mismatch: fail');

// ====== Test: assertResult — title ======
console.log('\n-- assertResult: title --');
const titleMatch = assertResult('title', 'Dash', 'Dashboard - My App');
assert(titleMatch.ok, 'title contains match: ok');

const titleNoMatch = assertResult('title', 'Profile', 'Dashboard - My App');
assert(!titleNoMatch.ok, 'title no match: fail');

// ====== Test: assertResult — unknown ======
console.log('\n-- assertResult: unknown --');
const unknownSub = assertResult('unknown', 'x', 'x');
assert(!unknownSub.ok, 'unknown subcommand: fail');

// ====== Summary ======
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);

process.exitCode = failed > 0 ? 1 : 0;
