import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Tests for the 4.1 behaviors: keyed lw-for, parent->child update
// propagation, park-as-pause lifecycle, and real expression Errors.

function setupDOM() {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', { url: 'http://localhost' });
  const win = dom.window;

  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.Node = win.Node;
  globalThis.NodeFilter = win.NodeFilter;
  globalThis.CSSStyleSheet = class CSSStyleSheet { replaceSync() {} };
  globalThis.location = win.location;
  globalThis.addEventListener = win.addEventListener.bind(win);
  globalThis.customElements = win.customElements;

  delete globalThis.leanweb;

  return dom;
}

function makeAST(overrides = {}) {
  return {
    runtimeVersion: '1.0.0',
    builderVersion: '1.0.0',
    componentFullName: 'app-root',
    html: '',
    css: '',
    shadowDom: false,
    ...overrides,
  };
}

async function loadLWElement() {
  const mod = await import(`../templates/lib/lw-element.js?t=${Date.now()}-${Math.random()}`);
  return mod.default;
}

function createInstance(LWElement, root, ast) {
  const instance = Object.create(LWElement.prototype);
  instance._root = root;
  instance.ast = ast;
  instance._ifPlaceholders = new Set();
  for (const method of ['update', 'updateEval', 'updateIf', 'updateClass', 'updateBind', 'updateModel', 'updateFor', '_bindModels', '_bindEvents', '_bindInputs', '_getNodeContext', '_restoreIfPlaceholders', '_removeIfNode', '_restoreIfNode', '_applyIfRemovals', '_teardownParked']) {
    if (LWElement.prototype[method]) {
      instance[method] = LWElement.prototype[method].bind(instance);
    }
  }
  return instance;
}

const expr = e => ({ type: 'ExpressionStatement', expression: e });
const ident = name => ({ type: 'Identifier', name });
const member = (objName, propName) => ({ type: 'MemberExpression', computed: false, object: ident(objName), property: ident(propName) });

describe('keyed lw-for', () => {
  function setupKeyedFor({ keyed = true } = {}) {
    const doc = globalThis.document;
    const root = doc.createElement('div');
    const container = doc.createElement('div');
    const forNode = doc.createElement('div');
    forNode.setAttribute('lw-elem', '');
    forNode.setAttribute('lw-for', 'kFor');
    if (keyed) forNode.setAttribute('lw-key', 'kKey');
    forNode.setAttribute('lw', 'kText');
    container.appendChild(forNode);
    root.appendChild(container);
    doc.body.appendChild(root);

    const ast = makeAST({
      componentFullName: 'app-rows',
      'kFor': { astItems: [expr(ident('items'))], itemExpr: 'item', indexExpr: 'index', loc: {} },
      'kKey': { ast: [expr(member('item', 'id'))], loc: {} },
      'kText': { ast: [expr(member('item', 'name'))], loc: {} },
    });
    return { root, container, ast };
  }
  const rowsOf = container => [...container.querySelectorAll('[lw-for-parent]')];

  it('should move nodes with their items on reorder', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const { root, container, ast } = setupKeyedFor();
    globalThis.leanweb.componentPrefix = 'app-';
    const instance = createInstance(LWElement, root, ast);
    const [a, b, c] = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }];
    instance.items = [a, b, c];
    instance.update();

    const rows = rowsOf(container);
    assert.deepEqual(rows.map(n => n.innerText), ['a', 'b', 'c']);
    rows[0]._marker = 'row-of-a';

    instance.items = [b, c, a];
    instance.update();
    const after = rowsOf(container);
    assert.deepEqual(after.map(n => n.innerText), ['b', 'c', 'a'], 'render order follows the data');
    assert.equal(after[2], rows[0], 'the SAME node moved with its item');
    assert.equal(after[2]._marker, 'row-of-a', 'node-bound state traveled with the item');
  });

  it('should reuse nodes across insert and remove, creating only for new keys', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const { root, container, ast } = setupKeyedFor();
    globalThis.leanweb.componentPrefix = 'app-';
    const instance = createInstance(LWElement, root, ast);
    const [a, b, c] = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }];
    instance.items = [a, c];
    instance.update();
    const [rowA, rowC] = rowsOf(container);

    instance.items = [a, b, c];
    instance.update();
    const rows = rowsOf(container);
    assert.deepEqual(rows.map(n => n.innerText), ['a', 'b', 'c']);
    assert.equal(rows[0], rowA, 'existing node for id 1 reused');
    assert.equal(rows[2], rowC, 'existing node for id 3 reused');
    assert.notEqual(rows[1], rowA, 'the inserted item got a fresh node');

    instance.items = [a, c];
    instance.update();
    const final = rowsOf(container);
    assert.deepEqual(final.map(n => n.innerText), ['a', 'c']);
    assert.equal(final[0], rowA);
    assert.equal(final[1], rowC);
    assert.equal(rowsOf(container).length, 2, 'removed key\'s node is gone');
  });

  it('should keep positional reuse when lw-key is absent', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const { root, container, ast } = setupKeyedFor({ keyed: false });
    globalThis.leanweb.componentPrefix = 'app-';
    const instance = createInstance(LWElement, root, ast);
    const [a, b] = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
    instance.items = [a, b];
    instance.update();
    const rows = rowsOf(container);

    instance.items = [b, a];
    instance.update();
    const after = rowsOf(container);
    assert.deepEqual(after.map(n => n.innerText), ['b', 'a']);
    assert.equal(after[0], rows[0], 'without lw-key the node stays at its position');
  });
});

describe('parent -> child update propagation', () => {
  it('should call update() on child components reached by the walker', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const doc = globalThis.document;
    const root = doc.createElement('div');
    const child = doc.createElement('app-child');
    let childUpdates = 0;
    child.update = () => { childUpdates++; };
    const inner = doc.createElement('span');
    inner.setAttribute('lw-elem', '');
    inner.setAttribute('lw', 'kInner');
    child.appendChild(inner);
    root.appendChild(child);
    doc.body.appendChild(root);

    const ast = makeAST({
      componentFullName: 'app-parent',
      // Would throw if the parent walked INTO the child (no context value).
      'kInner': { ast: [expr(member('missing', 'deep'))], loc: {} },
    });
    globalThis.leanweb.componentPrefix = 'app-';
    const instance = createInstance(LWElement, root, ast);

    instance.update();
    assert.equal(childUpdates, 1, 'child updated once per parent update');
    instance.update();
    assert.equal(childUpdates, 2, 'and again on the next parent update');
  });

  it('should hand a directly-updated child component its own update', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const doc = globalThis.document;
    const root = doc.createElement('div');
    const child = doc.createElement('app-child');
    let childUpdates = 0;
    child.update = () => { childUpdates++; };
    root.appendChild(child);
    doc.body.appendChild(root);

    globalThis.leanweb.componentPrefix = 'app-';
    const instance = createInstance(LWElement, root, makeAST({ componentFullName: 'app-parent' }));
    instance.update(child); // the updateFor cloned-row path
    assert.equal(childUpdates, 1);
  });
});

describe('park-as-pause lifecycle', () => {
  async function setupRealComponents() {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    const tag = 'app-kid';
    class Kid extends LWElement {
      constructor() {
        super(makeAST({ componentFullName: tag }));
        this.renders = 0;
      }
      update(...a) {
        this.renders++;
        return super.update(...a);
      }
    }
    win.customElements.define(tag, Kid);
    return { LWElement, win, tag };
  }

  it('should keep bus subscriptions while parked and stay reachable', async () => {
    const { LWElement, win, tag } = await setupRealComponents();
    const doc = win.document;
    const root = doc.createElement('div');
    const wrapper = doc.createElement('div');
    const kid = doc.createElement(tag);
    wrapper.appendChild(kid);
    root.appendChild(wrapper);
    doc.body.appendChild(root);
    assert.ok(kid._eventBusListeners.length > 0, 'subscribed on connect');
    // Let the constructor's deferred initial update land before counting.
    await new Promise(r => setTimeout(r, 0));

    const parent = createInstance(LWElement, root, makeAST({ componentFullName: 'app-parent' }));
    parent._removeIfNode(wrapper); // park the subtree
    assert.equal(wrapper.parentNode, null, 'subtree is parked');
    assert.ok(kid._eventBusListeners.length > 0, 'parking kept the subscriptions');

    const before = kid.renders;
    globalThis.leanweb.eventBus.dispatchEvent(tag);
    await new Promise(r => setTimeout(r, 0));
    assert.equal(kid.renders, before + 1, 'a poke reaches the parked component');
  });

  it('should still tear down on real removal', async () => {
    const { win, tag } = await setupRealComponents();
    const doc = win.document;
    const kid = doc.createElement(tag);
    doc.body.appendChild(kid);
    assert.ok(kid._eventBusListeners.length > 0);
    kid.remove();
    assert.equal(kid._eventBusListeners.length, 0, 'real removal releases subscriptions');
  });

  it('should sweep parked components whose spot left the tree for good', async () => {
    const { LWElement, win, tag } = await setupRealComponents();
    const doc = win.document;
    const root = doc.createElement('div');
    const container = doc.createElement('div');
    const wrapper = doc.createElement('div');
    const kid = doc.createElement(tag);
    wrapper.appendChild(kid);
    container.appendChild(wrapper);
    root.appendChild(container);
    doc.body.appendChild(root);

    const parent = createInstance(LWElement, root, makeAST({ componentFullName: 'app-parent' }));
    parent._removeIfNode(wrapper);
    assert.ok(kid._eventBusListeners.length > 0, 'parked, still subscribed');

    container.remove(); // the placeholder's position is destroyed for good
    parent._restoreIfPlaceholders(); // the per-update sweep
    assert.equal(kid._eventBusListeners.length, 0, 'sweep released the parked component');
  });
});

describe('expression errors', () => {
  it('should throw real Errors carrying component and line', async () => {
    setupDOM();
    const parser = await import(`../templates/lib/lw-expr-parser.js?t=${Date.now()}-${Math.random()}`);
    parser.setErrorLabel('app-broken');
    let thrown;
    try {
      parser.evaluate([expr(member('missing', 'deep'))], [{}], { startLine: 7, endLine: 7 });
    } catch (e) {
      thrown = e;
    }
    assert.ok(thrown instanceof Error, 'a real Error, not a plain object');
    assert.match(thrown.message, /app-broken/, 'names the component');
    assert.match(thrown.message, /line 7/, 'names the line');
    assert.ok(thrown.location, 'raw location rides along');
    assert.ok(thrown.context, 'raw context rides along');
  });
});
