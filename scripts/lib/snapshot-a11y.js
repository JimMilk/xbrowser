'use strict';

/**
 * Snapshot A11y — parse and format agent-browser snapshot output.
 *
 * Exports:
 *   parseSnapshot(raw)        — parse agent-browser JSON snapshot output
 *   formatInteractive(snap)   — filter interactable=true, show ref+tag+name+text
 *   formatA11y(snap)          — full accessibility tree (role/name/state, indented)
 *   formatCompact(snap)       — compact one-liner per element
 *   FULL_SNAPSHOT_VERBS       — verbs that support --a11y / -i / -c flags
 */

// ---------------------------------------------------------------------------
// Verbs that support a11y/enhanced flags
// ---------------------------------------------------------------------------
const FULL_SNAPSHOT_VERBS = new Set([
  'snapshot', 'screenshot', 'pdf'
]);

// ---------------------------------------------------------------------------
// parseSnapshot
// ---------------------------------------------------------------------------
/**
 * Parse agent-browser JSON snapshot output into a structured element tree.
 *
 * agent-browser snapshot returns JSON like:
 *   { elements: [{ ref, role, name, tag, attrs, children, visible, interactable, text }] }
 *
 * This function handles:
 *   - Raw JSON string
 *   - Already-parsed object
 *   - array-only (just the elements)
 *
 * @param {string|object|Array} rawOutput
 * @returns {{ version: number, elements: array, rootIdx: number|null }}
 */
function parseSnapshot(rawOutput) {
  if (rawOutput === null || rawOutput === undefined) {
    return { version: 2, elements: [], rootIdx: null };
  }

  /** @type {*} */
  let parsed;

  if (typeof rawOutput === 'string') {
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      return { version: 2, elements: [], rootIdx: null, parseError: true };
    }
  } else {
    parsed = rawOutput;
  }

  // Handle array-only (just the elements list)
  if (Array.isArray(parsed)) {
    return { version: 2, elements: parsed, rootIdx: 0 };
  }

  // Handle { elements: [...] }
  if (parsed && Array.isArray(parsed.elements)) {
    return {
      version: parsed.version || 2,
      elements: parsed.elements,
      rootIdx: parsed.rootIdx !== undefined ? parsed.rootIdx : (parsed.elements.length > 0 ? 0 : null)
    };
  }

  return { version: 2, elements: [], rootIdx: null };
}

// ---------------------------------------------------------------------------
// formatInteractive
// ---------------------------------------------------------------------------
/**
 * Extract only interactive elements from a snapshot.
 * Interactive = interactable === true.
 *
 * Output format (one line per element):
 *   @ref <role|tag> "name" "text preview..."
 *
 * @param {object} snapshot — output of parseSnapshot()
 * @returns {string}
 */
function formatInteractive(snapshot) {
  const { elements } = snapshot;
  if (!elements || elements.length === 0) return '';

  const lines = [];

  for (const el of elements) {
    if (!el.interactable) continue;

    const ref = formatRef(el);
    const typeStr = el.role || el.tag || '';
    const name = el.name ? `"${el.name}"` : '';
    const text = el.text ? `"[text: ${truncateText(el.text, 80)}]"` : '';

    const parts = [ref, typeStr, name, text].filter(Boolean);
    lines.push(parts.join(' '));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// formatA11y
// ---------------------------------------------------------------------------
/**
 * Format full accessibility tree with role/name/state, indented by level.
 *
 * Output format:
 *   root (role) "name" [visible] [interactable]
 *     child (role) "name" [visible]
 *       leaf (role) "name" [interactable]
 *
 * @param {object} snapshot — output of parseSnapshot()
 * @returns {string}
 */
function formatA11y(snapshot) {
  const { elements } = snapshot;
  if (!elements || elements.length === 0) return '';

  // Build a lookup: ref → { el, children }
  const lookup = new Map();
  for (const el of elements) {
    lookup.set(el.ref, { el, childrenRefs: el.children || [] });
  }

  // Find root elements (elements not appearing as children of any other element)
  const childRefs = new Set();
  for (const el of elements) {
    if (el.children) {
      for (const r of el.children) childRefs.add(r);
    }
  }

  const roots = elements.filter(el => !childRefs.has(el.ref));

  const lines = [];
  for (const root of roots) {
    renderA11yNode(root, lookup, 0, lines);
  }

  return lines.join('\n');
}

function renderA11yNode(el, lookup, depth, lines) {
  const indent = '  '.repeat(depth);
  const role = el.role || el.tag || '(unknown)';
  const name = el.name ? ` "${el.name}"` : '';
  const states = [];

  if (el.visible === false) states.push('hidden');
  if (el.interactable) states.push('interactive');
  if (el.disabled) states.push('disabled');
  if (el.checked !== undefined) states.push(el.checked ? 'checked' : 'unchecked');
  if (el.selected) states.push('selected');
  if (el.expanded !== undefined) states.push(el.expanded ? 'expanded' : 'collapsed');

  const stateStr = states.length > 0 ? ` [${states.join(', ')}]` : '';
  const textPreview = el.text ? ` → ${truncateText(el.text, 60)}` : '';
  const refStr = el.ref ? ` (${formatRef(el)})` : '';

  lines.push(`${indent}${role}${name}${refStr}${stateStr}${textPreview}`);

  // Render children
  const childrenRefs = el.children || [];
  for (const childRef of childrenRefs) {
    const node = lookup.get(childRef);
    if (node) {
      renderA11yNode(node.el, lookup, depth + 1, lines);
    }
  }
}

// ---------------------------------------------------------------------------
// formatCompact
// ---------------------------------------------------------------------------
/**
 * Compact one-liner per element.
 *
 * Output format:
 *   @ref <role|tag> "name" [vis:hidden] [i:✓]
 *
 * @param {object} snapshot — output of parseSnapshot()
 * @returns {string}
 */
function formatCompact(snapshot) {
  const { elements } = snapshot;
  if (!elements || elements.length === 0) return '';

  const lines = [];

  for (const el of elements) {
    const ref = formatRef(el);
    const typeStr = el.role || el.tag || '?';
    const name = el.name ? `"${truncateText(el.name, 40)}"` : '';
    const flags = [];

    if (el.visible === false) flags.push('h');
    if (el.interactable) flags.push('I');
    if (el.disabled) flags.push('D');
    if (el.checked) flags.push('✓');
    if (el.selected) flags.push('S');

    const flagStr = flags.length > 0 ? `[${flags.join('')}]` : '';
    const parts = [ref, typeStr, name, flagStr].filter(Boolean);
    lines.push(parts.join(' '));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Format element ref with @ prefix.
 * If the ref already starts with @, use it as-is.
 * Falls back to @e{index} if no ref is available.
 */
function formatRef(el) {
  if (el.ref) {
    return el.ref.startsWith('@') ? el.ref : `@${el.ref}`;
  }
  return el.index !== undefined ? `@e${el.index}` : '?';
}

function truncateText(text, maxLen) {
  if (!text) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}

// ---------------------------------------------------------------------------
module.exports = {
  parseSnapshot,
  formatInteractive,
  formatA11y,
  formatCompact,
  FULL_SNAPSHOT_VERBS
};
