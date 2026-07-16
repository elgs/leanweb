# Changelog

## 4.3.0 — 2026-07-15

### Added

- **Content projection without shadow DOM: `lw-slot`.** A component template
  may contain `<lw-slot>`s; markup the parent writes between the
  component's tags is re-homed into them at construction while remaining the
  parent's — parent context, parent expressions, parent updates, parent
  event handlers. Distribution mirrors native slots: `slot="name"` children
  land in `<lw-slot name="name">`, everything else in the unnamed default
  slot (unmatched names fall back to the default slot, then to ahead of the
  template). A slot's template children are fallback content — component-
  owned, kept only when nothing is projected into that slot. The receiving
  component's walker skips projected content (`lw-projected`), so its own
  AST never sees it. All directives work inside projected markup, including
  `lw-if` (parks/restores through the slot) and `lw-for` (extraction and
  re-renders driven by the parent). Build-time validation: at most one slot
  per name (one unnamed default), and never inside an `lw-for`.
  Components without a slot keep their initial children in place, untouched —
  existing templates are unaffected. `lw-slot` gets `display: contents` in
  the injected stylesheet. Docs: `docs/rendering.md`.
- A projected placeholder or `lw-for` anchor riding inside a subtree that the
  *receiving* component parks (its own `lw-if` over the slot) now stays
  dormant instead of being swept as dead, and returns when the child restores
  it; truly removed subtrees still purge.

## 4.2.0 — 2026-07-13

### Changed

- **`lw-for` templates leave the DOM after their first render.** The template
  element is swapped for a comment anchor (like `lw-if` placeholders) that
  carries it for cloning and drives later renders. Templates no longer
  pollute `querySelector` results, row counts, CSS matching or the
  accessibility tree — test selectors like `tr:not([lw-for])` are no longer
  necessary — and component instances that only ever existed inside a
  template release their subscriptions. Anchors park and restore with their
  ancestors like every other placeholder.

### Added

- **`lw upgrade --diff`.** A dry run for upgrades: per-file unified diffs of
  the project's `lib/` against the CLI's runtime, flagging project-only files
  (which upgrades keep). Upgrading previously overwrote local modifications —
  vendored bug fixes, experiments — with no warning of what was lost.


## 4.1.0 — 2026-07-13

### Added

- **Keyed `lw-for`.** `lw-key="item.id"` on an `lw-for` element matches rows
  to items by identity instead of position: node-bound state (focus, hover,
  CSS transitions, half-typed inputs) travels with its item through reorders,
  insertions and removals. Without `lw-key`, behavior is unchanged.
- **Parent → child update propagation.** A parent's update now hands each
  child component it reaches an `update()` after refreshing its bound
  attributes — host state flows into children without manual
  `leanweb.updateComponents()` plumbing.
- **`leanweb.debug`.** Logs `updateComponents` dispatches and every `lw-if`
  park/restore with the owning component.
- `docs/rendering.md` — the complete rendering model (every place the
  runtime calls `update()` for you) and the `lw-if` park lifecycle.

### Changed

- **Parking is now a pause, not a teardown.** A component hidden by `lw-if`
  keeps its event-bus and hash subscriptions while parked, so pokes sent
  while it is hidden still reach it; subscriptions are released on real
  removal, and parked subtrees whose return position is destroyed are swept
  on the next update.
- **Template expression failures throw real `Error`s** naming the component
  and template line (previously a plain object surfaced as
  "Uncaught [object Object]"). The raw location/AST/context ride along on
  the error.


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
