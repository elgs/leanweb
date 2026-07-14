# How rendering works

Leanweb has no reactivity system: a component's DOM changes when its
`update()` runs, and only then. What makes apps feel reactive is a small set
of places the runtime calls `update()` for you. This page lists all of them —
plus the component lifecycle around `lw-if` — so nothing about rendering is
"invisible machinery".

## When `update()` runs for you

1. **Sync event handlers.** An `lw-on:` handler whose expression does not
   return a Promise triggers `update()` on the owning component right after
   it runs.

2. **Async methods, on settle.** Every `async` method on a component is
   wrapped at construction (`_bindMethods`) so that when its promise settles
   — resolve or reject — the component updates. This is the main renderer in
   practice: a loader like `async loadUsers() { this.users = await ... }`
   needs no explicit `update()` call.

3. **URL hash changes.** Components implementing `urlHashChanged()` get it
   called, then updated, on every `hashchange`.

4. **The event bus.** Every component subscribes to two channels:
   `'update'` (fired by `leanweb.updateComponents()` with no arguments —
   updates everything) and its own tag name
   (`leanweb.updateComponents('web-pager')` — updates every instance of that
   component).

5. **Parent → child propagation** *(4.1)*. When a parent's update walk
   reaches a child component element, it refreshes the child's bound
   attributes and then calls the child's `update()`. Parent renders, child
   renders — host state flows into children without manual
   `updateComponents()` plumbing. (Children are still never *walked into*:
   their internal DOM belongs to their own AST.) A component that must not follow its
   parent's renders simply shouldn't live in that parent's template —
   siblings only hear from each other through the bus.

Everything else — mutating state outside a handler, `setTimeout` callbacks,
WebSocket messages — needs an explicit `this.update()` or a
`leanweb.updateComponents(...)`.

## `lw-if` parks; it does not destroy

When an `lw-if` condition turns false, the element is swapped for a comment
placeholder and kept — alive, detached — to return with its state when the
condition turns true again. Consequences:

- **Parking is a pause** *(4.1)*: a parked component keeps its event-bus and
  hash subscriptions, so a poke sent while it is hidden still reaches it and
  it re-renders in the background. (Before 4.1, `disconnectedCallback`
  dropped subscriptions on park, so components went deaf while hidden.)
- A **real removal** (the element leaves the document for good) still tears
  everything down. Parked subtrees whose return position is destroyed — for
  example inside a removed `lw-for` row — are swept on the next update and
  their components released.
- The optional `turnedOff()` / `turnedOn()` hooks fire (deferred) on park and
  restore.
- A parked element has **no parent chain**. A child component that needs its
  host while hidden (a page component doing work before it becomes visible)
  should capture the reference at construction rather than walking
  `parentElement` on demand.

## Keyed `lw-for` *(4.1)*

By default `lw-for` reuses row nodes by position: row 1 stays row 1 and gets
whatever item is first. Add `lw-key` to match rows to items by identity
instead:

```html
<tr lw-for="row in rows" lw-key="row.id">...</tr>
```

Node identity then follows the *data* through reorders, insertions and
removals — focus, hover, CSS transitions and half-typed inputs travel with
their item instead of sticking to a position. The key expression sees the
loop variable (and index, and component state) and must yield defined,
unique values; rows with duplicate or `undefined` keys fall back to being
recreated.

## Debugging

Set `leanweb.debug = true` to log `updateComponents` dispatches and every
`lw-if` park/restore with the owning component. Failed template expressions
throw real `Error`s naming the component and template line *(4.1)*, with the
raw AST/context attached for tooling.
