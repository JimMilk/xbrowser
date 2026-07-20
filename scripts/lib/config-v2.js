'use strict';

/**
 * Config V2 Schema — xbrowser configuration module.
 *
 * Exports:
 *   DEFAULT_CONFIG   — canonical V2 default config
 *   CAPABILITIES     — capability → tool-category mapping
 *   migrateV1ToV2    — convert V1 config shape to V2
 *   mergeConfig      — deep merge (override wins)
 *   validateConfig   — { valid, errors[] }
 */

// ---------------------------------------------------------------------------
// Default V2 config
// ---------------------------------------------------------------------------
const DEFAULT_CONFIG = Object.freeze({
  version: 2,

  browser: {
    name: 'cft',         // cft | chrome | edge | qqbrowser
    mode: 'persistent',  // persistent | isolated
    headed: true
  },

  capabilities: ['core'],

  timeouts: {
    action: 5000,
    navigation: 30000
  },

  output: {
    dir: null,           // null = no file output
    maxSize: null        // null = unlimited
  },

  shield: {
    enabled: true
  }
});

// ---------------------------------------------------------------------------
// Capability groups → tool categories
// ---------------------------------------------------------------------------
const CAPABILITIES = Object.freeze({
  core:    ['open', 'snapshot', 'click', 'fill', 'type', 'press', 'wait', 'get', 'close'],
  network: ['route', 'requests', 'har', 'unroute', 'request'],
  pdf:     ['pdf'],
  vision:  ['screenshot', 'mouse', 'highlight'],
  devtools:['console', 'errors', 'trace', 'profiler', 'inspect'],
  storage: ['cookies', 'state', 'storage']
});

// All known capability names (used for validation)
const KNOWN_CAPABILITIES = Object.keys(CAPABILITIES);

// ---------------------------------------------------------------------------
// V1 → V2 migration
// ---------------------------------------------------------------------------
/**
 * Convert a V1 config object into V2 format.
 *
 * V1 shape (from xb.cjs config module):
 *   { browser: string, headed: boolean, profiles: object, ... }
 *
 * @param {object} v1Config
 * @returns {object} V2 config
 */
function migrateV1ToV2(v1Config) {
  if (!v1Config || typeof v1Config !== 'object') {
    return deepClone(DEFAULT_CONFIG);
  }

  const v2 = deepClone(DEFAULT_CONFIG);

  // browser name
  if (v1Config.browser && ['cft', 'chrome', 'edge', 'qqbrowser'].includes(v1Config.browser)) {
    v2.browser.name = v1Config.browser;
  }

  // headed
  if (typeof v1Config.headed === 'boolean') {
    v2.browser.headed = v1Config.headed;
  }

  return v2;
}

// ---------------------------------------------------------------------------
// Deep merge — override wins, nested objects merged recursively
// ---------------------------------------------------------------------------
/**
 * Deep-merge two config objects. `override` values win.
 * Arrays are replaced (not concatenated).
 * `null` explicitly sets a value to null.
 *
 * @param {object} base
 * @param {object} override
 * @returns {object}
 */
function mergeConfig(base, override) {
  if (!override || typeof override !== 'object') {
    return deepClone(base);
  }

  const result = deepClone(base);

  for (const key of Object.keys(override)) {
    const srcVal = override[key];
    const dstVal = result[key];

    if (srcVal === null) {
      // Explicit null override
      result[key] = null;
    } else if (
      isPlainObject(srcVal) &&
      isPlainObject(dstVal)
    ) {
      // Recursively merge nested objects
      result[key] = mergeConfig(dstVal, srcVal);
    } else {
      // Primitives & arrays: override directly
      result[key] = deepClone(srcVal);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
/**
 * Validate a V2 config object.
 *
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['config must be an object'] };
  }

  // version
  if (config.version !== 2) {
    errors.push(`version must be 2, got ${config.version}`);
  }

  // browser
  if (config.browser) {
    if (typeof config.browser !== 'object' || Array.isArray(config.browser)) {
      errors.push('browser must be an object');
    } else {
      const validBrowsers = ['cft', 'chrome', 'edge', 'qqbrowser'];
      if (config.browser.name && !validBrowsers.includes(config.browser.name)) {
        errors.push(`browser.name must be one of: ${validBrowsers.join(', ')}`);
      }
      if (config.browser.mode && !['persistent', 'isolated'].includes(config.browser.mode)) {
        errors.push('browser.mode must be "persistent" or "isolated"');
      }
      if (config.browser.headed !== undefined && typeof config.browser.headed !== 'boolean') {
        errors.push('browser.headed must be a boolean');
      }
    }
  }

  // capabilities
  if (config.capabilities) {
    if (!Array.isArray(config.capabilities)) {
      errors.push('capabilities must be an array');
    } else {
      for (const cap of config.capabilities) {
        if (!KNOWN_CAPABILITIES.includes(cap)) {
          errors.push(`unknown capability "${cap}". Valid: ${KNOWN_CAPABILITIES.join(', ')}`);
        }
      }
    }
  }

  // timeouts
  if (config.timeouts) {
    if (typeof config.timeouts !== 'object') {
      errors.push('timeouts must be an object');
    } else {
      if (config.timeouts.action !== undefined && typeof config.timeouts.action !== 'number') {
        errors.push('timeouts.action must be a number');
      }
      if (config.timeouts.navigation !== undefined && typeof config.timeouts.navigation !== 'number') {
        errors.push('timeouts.navigation must be a number');
      }
    }
  }

  // output
  if (config.output) {
    if (typeof config.output !== 'object') {
      errors.push('output must be an object');
    } else {
      if (config.output.dir !== undefined && config.output.dir !== null && typeof config.output.dir !== 'string') {
        errors.push('output.dir must be a string or null');
      }
      if (config.output.maxSize !== undefined && config.output.maxSize !== null && typeof config.output.maxSize !== 'number') {
        errors.push('output.maxSize must be a number or null');
      }
    }
  }

  // shield
  if (config.shield) {
    if (typeof config.shield !== 'object') {
      errors.push('shield must be an object');
    } else {
      if (config.shield.enabled !== undefined && typeof config.shield.enabled !== 'boolean') {
        errors.push('shield.enabled must be a boolean');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepClone(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(deepClone);
  const o = {};
  for (const k of Object.keys(v)) o[k] = deepClone(v[k]);
  return o;
}

// ---------------------------------------------------------------------------
module.exports = {
  DEFAULT_CONFIG,
  CAPABILITIES,
  KNOWN_CAPABILITIES,
  migrateV1ToV2,
  mergeConfig,
  validateConfig
};
