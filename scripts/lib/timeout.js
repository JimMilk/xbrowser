'use strict';

/**
 * Timeout Configuration — action-type-aware timeout resolution.
 *
 * Exports:
 *   ACTION_TIMEOUTS   — verb → timeout category mapping
 *   resolveTimeout    — (verb, config, cliTimeout?) → number (ms)
 *
 * Resolution order:
 *   1. cliTimeout (explicit --timeout from user) wins if provided
 *   2. config.timeouts[category] from V2 config
 *   3. Hardcoded default per category
 *
 * Special case: wait (custom) — cliTimeout capped at config.timeouts.action; if
 * no cliTimeout, defaults to config.timeouts.action.
 */

// ---------------------------------------------------------------------------
// Default timeout values (ms)
// ---------------------------------------------------------------------------
const DEFAULTS = {
  navigation: 30000,
  action:     5000,
  snapshot:   15000
};

// ---------------------------------------------------------------------------
// Verb → timeout category mapping
// ---------------------------------------------------------------------------
const ACTION_TIMEOUTS = Object.freeze({
  // navigation
  open:   'navigation',
  back:   'navigation',
  forward:'navigation',
  reload: 'navigation',

  // action (interaction)
  click:        'action',
  dblclick:     'action',
  fill:         'action',
  type:         'action',
  press:        'action',
  hover:        'action',
  select:       'action',
  check:        'action',
  uncheck:      'action',
  focus:        'action',
  keydown:      'action',
  keyup:        'action',
  scroll:       'action',
  scrollintoview:'action',
  drag:         'action',
  upload:       'action',

  // snapshot / output
  snapshot:   'snapshot',
  screenshot: 'snapshot',
  pdf:        'snapshot',

  // custom (wait timeout flow)
  wait:       'custom'
});

// ---------------------------------------------------------------------------
// resolveTimeout
// ---------------------------------------------------------------------------
/**
 * Resolve the effective timeout (ms) for a given action verb.
 *
 * Priority: cliTimeout > config.timeouts[category] > hardcoded default.
 *
 * Special: for 'custom' (wait), cliTimeout is capped at config.timeouts.action.
 * If no cliTimeout is given, returns config.timeouts.action.
 *
 * @param {string}  verb       — action verb (e.g. 'open', 'click', 'snapshot')
 * @param {object}  config     — V2 config object (must have .timeouts shape)
 * @param {number}  [cliTimeout] — explicit --timeout value from CLI, if any
 * @returns {number} timeout in milliseconds
 */
function resolveTimeout(verb, config, cliTimeout) {
  const category = ACTION_TIMEOUTS[verb] || 'action';

  // --timeout from CLI always wins ... with one exception
  if (cliTimeout != null && cliTimeout > 0) {
    if (category === 'custom') {
      // wait: user timeout capped at action limit
      const cap = (config && config.timeouts && config.timeouts.action) || DEFAULTS.action;
      return Math.min(cliTimeout, cap);
    }
    return cliTimeout;
  }

  // Fall through to config defaults
  const timeouts = (config && config.timeouts) || {};

  switch (category) {
    case 'navigation':
      return timeouts.navigation || DEFAULTS.navigation;

    case 'snapshot':
      // snapshot category defaults to action timeout if not separately configured
      return timeouts.snapshot || timeouts.action || DEFAULTS.snapshot;

    case 'action':
    case 'custom':
    default:
      return timeouts.action || DEFAULTS.action;
  }
}

// ---------------------------------------------------------------------------
module.exports = {
  ACTION_TIMEOUTS,
  DEFAULTS,
  resolveTimeout
};
