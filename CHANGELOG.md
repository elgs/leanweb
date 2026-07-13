# Changelog

## 4.0.8 — 2026-07-13

### Fixed

- **Nested `lw-if` elements were permanently lost once their ancestor was hidden.**
  When an `lw-if` element containing other `lw-if` elements turned off (e.g. a page
  card holding a dialog), the inner elements' tracking entries were dropped and they
  could never render again without a full page load. Hidden descendants now stay
  parked with their ancestor and reappear in the same update that restores it.
- **A hidden `lw-for` row whose `lw-if` references the loop item froze the whole
  component.** With `lw-for` and `lw-if` on the same element (e.g.
  `lw-if="item.visible"`), hiding a row made every subsequent `update()` throw,
  permanently — the restore check evaluated the condition without the loop context.
  Restores now use the row's captured item context.
- **A falsy middle item in an `lw-for` + `lw-if` list crashed `update()`.** Hiding a
  row mid-list left the insertion anchor detached, cascading into a `TypeError` that
  stopped all later rows from rendering. Rows now park in place behind their
  placeholder; following items keep rendering, and a row that reappears returns to
  its original position with the current item's data.
- **Hidden `lw-for` rows leaked DOM and memory on every update.** A row hidden by
  `lw-if` was invisible to the row scan, so each update cloned and parked a fresh
  copy, growing stray comment nodes and the internal registry without bound. Hidden
  rows are now recognized by their placeholder and reused.
- **Placeholder registry hygiene.** Entries inside subtrees removed for good (e.g.
  an `lw-for` shrink) are released in a single update instead of lingering; moving a
  parked element in a `turnedOff` hook (keep-alive pools) no longer orphans the
  `lw-if` elements inside it; entries whose element lost its `lw-if` attribute are
  dropped instead of rescanned forever.

### Changed

- `lw-if` park/restore bookkeeping moved to park time: descendant placeholders are
  stashed on their ancestor's placeholder and rejoin the sweep when it restores. The
  per-update sweep only iterates live placeholders and no longer allocates a
  snapshot set, and `update()` skips processing the subtree of a node it is about to
  hide, matching the tree walker's behavior for non-root nodes.

### Tests

- Added regression suites for nested `lw-if` park/restore and `lw-for` rows with
  `lw-if`: same-pass restore of nested content, dormant-entry survival, one-pass
  release of removed subtrees, `turnedOff` reparenting, loop-item conditions,
  mid-list hidden rows with order preservation, and registry/DOM stability.
