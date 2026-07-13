import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Helper: set up a jsdom window and patch globals so lw-element.js can load.
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

  // Reset leanweb global between tests.
  delete globalThis.leanweb;

  return dom;
}

// Minimal AST that satisfies the LWElement constructor.
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
  for (const method of ['update', 'updateEval', 'updateIf', 'updateClass', 'updateBind', 'updateModel', 'updateFor', '_bindModels', '_bindEvents', '_bindInputs', '_getNodeContext', '_restoreIfPlaceholders', '_removeIfNode', '_restoreIfNode', '_applyIfRemovals']) {
    if (LWElement.prototype[method]) {
      instance[method] = LWElement.prototype[method].bind(instance);
    }
  }
  return instance;
}

// Babel-style expression AST builders for interpolation entries.
const expr = e => ({ type: 'ExpressionStatement', expression: e });
const ident = name => ({ type: 'Identifier', name });
const member = (objName, propName) => ({ type: 'MemberExpression', computed: false, object: ident(objName), property: ident(propName) });
const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LWElement', () => {

  describe('componentPrefix', () => {
    it('should set leanweb.componentPrefix from the first component', async () => {
      setupDOM();
      const LWElement = await loadLWElement();

      class AppRoot extends LWElement {
        constructor() { super(makeAST({ componentFullName: 'app-root' })); }
      }
      globalThis.window.customElements.define('app-root', AppRoot);
      globalThis.document.createElement('app-root');

      assert.equal(globalThis.leanweb.componentPrefix, 'app-');
    });

    it('should not overwrite componentPrefix once set', async () => {
      setupDOM();
      const LWElement = await loadLWElement();

      class MyNav extends LWElement {
        constructor() { super(makeAST({ componentFullName: 'my-nav' })); }
      }
      class MyFooter extends LWElement {
        constructor() { super(makeAST({ componentFullName: 'my-footer' })); }
      }
      const win = globalThis.window;
      win.customElements.define('my-nav', MyNav);
      win.customElements.define('my-footer', MyFooter);

      globalThis.document.createElement('my-nav');
      globalThis.document.createElement('my-footer');

      assert.equal(globalThis.leanweb.componentPrefix, 'my-');
    });
  });

  // For the update() tests, we bypass the constructor's DOM-appending logic
  // (jsdom doesn't support appendChild in custom element constructors) by
  // manually wiring up _root, ast, and the DOM tree, then calling update().

  for (const shadowDom of [false, true]) {
    const mode = shadowDom ? 'shadow DOM' : 'light DOM';

    describe(`${mode}: boundary`, () => {
      it('should not descend into child component DOM during update', async () => {
        setupDOM();
        const LWElement = await loadLWElement();
        const doc = globalThis.document;

        // Build a DOM tree: <div id="root"><div lw-elem lw="k1"><app-child><span lw-elem lw="k2"></span></app-child></div></div>
        const root = doc.createElement('div');
        const parentDiv = doc.createElement('div');
        parentDiv.setAttribute('lw-elem', '');
        parentDiv.setAttribute('lw', 'k1');
        const child = doc.createElement('app-child');
        const innerSpan = doc.createElement('span');
        innerSpan.setAttribute('lw-elem', '');
        innerSpan.setAttribute('lw', 'k2');
        child.appendChild(innerSpan);
        parentDiv.appendChild(child);
        root.appendChild(parentDiv);
        doc.body.appendChild(root);

        const ast = makeAST({
          shadowDom,
          componentFullName: 'app-parent',
          'k1': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'parent' } }], loc: {} },
          // k2 belongs to the child component — parent shouldn't process it.
          'k2': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'SHOULD_NOT_APPEAR' } }], loc: {} },
        });

        globalThis.leanweb.componentPrefix = 'app-';
        const instance = createInstance(LWElement, root, ast);
        instance.update();

        assert.equal(parentDiv.innerText, 'parent');
        if (!shadowDom) {
          // In light DOM, the TreeWalker filter prevents walking into child components.
          assert.equal(innerSpan['lw-eval-value-k2'], undefined,
            'parent update should not walk into child component');
        }
        // In shadow DOM, jsdom doesn't support real shadow roots, so we only
        // verify the parent side was processed correctly.
      });

      it('should process lw-if on the child component element itself', async () => {
        setupDOM();
        const LWElement = await loadLWElement();
        const doc = globalThis.document;

        // <div id="root"><app-child lw-elem lw-if="k1"></app-child></div>
        const root = doc.createElement('div');
        const child = doc.createElement('app-child');
        child.setAttribute('lw-elem', '');
        child.setAttribute('lw-if', 'k1');
        root.appendChild(child);
        doc.body.appendChild(root);

        const ast = makeAST({
          shadowDom,
          componentFullName: 'app-parent',
          'k1': { ast: [{ type: 'ExpressionStatement', expression: { type: 'BooleanLiteral', value: false } }], loc: {} },
        });

        globalThis.leanweb.componentPrefix = 'app-';
        const instance = createInstance(LWElement, root, ast);
        instance.update();

        assert.equal(root.contains(child), false,
          'should remove child component element from DOM when lw-if is false');
        assert.equal(root.childNodes[0]?.nodeType, 8 /* Comment */,
          'should insert a comment placeholder');
      });

      it('should restore lw-if element when condition becomes true', async () => {
        setupDOM();
        const LWElement = await loadLWElement();
        const doc = globalThis.document;

        const root = doc.createElement('div');
        const elem = doc.createElement('div');
        elem.setAttribute('lw-elem', '');
        elem.setAttribute('lw-if', 'k1');
        elem.setAttribute('lw', 'k2');
        root.appendChild(elem);
        doc.body.appendChild(root);

        let conditionValue = false;
        const ast = makeAST({
          shadowDom,
          componentFullName: 'app-toggle',
          'k1': { get ast() { return [{ type: 'ExpressionStatement', expression: { type: 'BooleanLiteral', value: conditionValue } }]; }, loc: {} },
          'k2': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'hello' } }], loc: {} },
        });

        globalThis.leanweb.componentPrefix = 'app-';
        const instance = createInstance(LWElement, root, ast);

        // First update: condition false → element removed.
        instance.update();
        assert.equal(root.contains(elem), false, 'element removed when false');
        assert.equal(root.childNodes[0]?.nodeType, 8, 'comment placeholder exists');

        // Second update: condition true → element restored.
        conditionValue = true;
        instance.update();
        assert.equal(root.contains(elem), true, 'element restored when true');
        assert.equal(elem.innerText, 'hello', 'directives processed after restore');
      });

      it('should process all lw-if siblings even when earlier ones are false', async () => {
        setupDOM();
        const LWElement = await loadLWElement();
        const doc = globalThis.document;

        // Simulates a dashboard with multiple panels, only one visible at a time.
        const root = doc.createElement('div');
        const panelA = doc.createElement('div');
        panelA.setAttribute('lw-elem', '');
        panelA.setAttribute('lw-if', 'kA');
        panelA.setAttribute('lw', 'kText');
        const panelB = doc.createElement('div');
        panelB.setAttribute('lw-elem', '');
        panelB.setAttribute('lw-if', 'kB');
        panelB.setAttribute('lw', 'kText');
        const panelC = doc.createElement('div');
        panelC.setAttribute('lw-elem', '');
        panelC.setAttribute('lw-if', 'kC');
        panelC.setAttribute('lw', 'kText');
        root.appendChild(panelA);
        root.appendChild(panelB);
        root.appendChild(panelC);
        doc.body.appendChild(root);

        const ast = makeAST({
          shadowDom,
          componentFullName: 'app-dashboard',
          'kA': { ast: [{ type: 'ExpressionStatement', expression: { type: 'BooleanLiteral', value: false } }], loc: {} },
          'kB': { ast: [{ type: 'ExpressionStatement', expression: { type: 'BooleanLiteral', value: true } }], loc: {} },
          'kC': { ast: [{ type: 'ExpressionStatement', expression: { type: 'BooleanLiteral', value: false } }], loc: {} },
          'kText': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'content' } }], loc: {} },
        });

        globalThis.leanweb.componentPrefix = 'app-';
        const instance = createInstance(LWElement, root, ast);
        instance.update();

        assert.equal(root.contains(panelA), false, 'panelA should be removed (false)');
        assert.equal(root.contains(panelB), true, 'panelB should remain (true)');
        assert.equal(panelB.innerText, 'content', 'panelB directives should be processed');
        assert.equal(root.contains(panelC), false, 'panelC should be removed (false)');
      });

      it('should not restore lw-if placeholders inside child components', async () => {
        setupDOM();
        const LWElement = await loadLWElement();
        const doc = globalThis.document;

        // DOM: <div id="root"><app-child><!-- lw-if placeholder --></app-child></div>
        // The placeholder inside app-child belongs to the child component.
        // The parent's _restoreIfPlaceholders must not touch it.
        const root = doc.createElement('div');
        const child = doc.createElement('app-child');
        root.appendChild(child);
        doc.body.appendChild(root);

        // Simulate a placeholder that a child component left behind.
        const innerElem = doc.createElement('span');
        innerElem.setAttribute('lw-elem', '');
        innerElem.setAttribute('lw-if', 'childKey');
        const placeholder = doc.createComment('lw-if');
        placeholder['lw-if-element'] = innerElem;
        child.appendChild(placeholder);

        const ast = makeAST({
          shadowDom,
          componentFullName: 'app-parent',
          // Parent has no 'childKey' — accessing it would throw if reached.
        });

        globalThis.leanweb.componentPrefix = 'app-';
        const instance = createInstance(LWElement, root, ast);

        if (!shadowDom) {
          // In light DOM, the filter should prevent walking into app-child.
          assert.doesNotThrow(() => instance.update(),
            'parent should not process placeholders inside child components');
          assert.equal(child.childNodes[0], placeholder,
            'placeholder inside child should remain untouched');
        }
        // In shadow DOM, jsdom can't create real shadow roots, so the child's
        // internals would be in the same DOM tree. Real browsers isolate via
        // the shadow boundary. We verify the light DOM guard here.
      });
    });

    describe(`${mode}: update root node processing`, () => {
      it('should process directives on rootNode when rootNode !== this._root', async () => {
        setupDOM();
        const LWElement = await loadLWElement();
        const doc = globalThis.document;

        const root = doc.createElement('div');
        doc.body.appendChild(root);

        // The node passed as rootNode to update (simulating updateFor cloned node).
        const cloned = doc.createElement('div');
        cloned.setAttribute('lw-elem', '');
        cloned.setAttribute('lw', 'k1');
        doc.body.appendChild(cloned);

        const ast = makeAST({
          shadowDom,
          componentFullName: 'app-list',
          'k1': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'item-text' } }], loc: {} },
        });

        globalThis.leanweb.componentPrefix = 'app-';
        const instance = createInstance(LWElement, root, ast);

        // Call update with a different rootNode.
        instance.update(cloned);

        assert.equal(cloned['lw-eval-value-k1'], 'item-text',
          'should evaluate lw expression on the root node itself');
      });

      it('should NOT re-process the component root as a directive target', async () => {
        setupDOM();
        const LWElement = await loadLWElement();
        const doc = globalThis.document;

        // Set up: root has an lw attribute but is this._root, so it should be skipped.
        const root = doc.createElement('div');
        root.setAttribute('lw-elem', '');
        root.setAttribute('lw', 'k1');
        const span = doc.createElement('span');
        span.setAttribute('lw-elem', '');
        span.setAttribute('lw', 'k2');
        root.appendChild(span);
        doc.body.appendChild(root);

        const ast = makeAST({
          shadowDom,
          componentFullName: 'app-self',
          'k1': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'root-text' } }], loc: {} },
          'k2': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'child-text' } }], loc: {} },
        });

        globalThis.leanweb.componentPrefix = 'app-';
        const instance = createInstance(LWElement, root, ast);
        instance.update();

        // Only the child span should be processed.
        assert.equal(span.innerText, 'child-text');
        // The root itself (this._root) should NOT have had updateEval called on it.
        assert.equal(root['lw-eval-value-k1'], undefined,
          'component root element itself should not be processed as a directive');
      });

      it('should remove rootNode from DOM when lw-if is false on rootNode', async () => {
        setupDOM();
        const LWElement = await loadLWElement();
        const doc = globalThis.document;

        const root = doc.createElement('div');
        doc.body.appendChild(root);

        const container = doc.createElement('div');
        const cloned = doc.createElement('div');
        cloned.setAttribute('lw-elem', '');
        cloned.setAttribute('lw-if', 'k1');
        cloned.setAttribute('lw', 'k2');
        container.appendChild(cloned);
        doc.body.appendChild(container);

        const ast = makeAST({
          shadowDom,
          componentFullName: 'app-list',
          'k1': { ast: [{ type: 'ExpressionStatement', expression: { type: 'BooleanLiteral', value: false } }], loc: {} },
          'k2': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'SHOULD_NOT_APPEAR' } }], loc: {} },
        });

        globalThis.leanweb.componentPrefix = 'app-';
        const instance = createInstance(LWElement, root, ast);
        instance.update(cloned);

        assert.equal(container.contains(cloned), false,
          'rootNode should be removed from DOM when lw-if is false');
        assert.equal(cloned['lw-eval-value-k2'], undefined,
          'directives should not be processed when lw-if is false');
      });
    });
  }

  describe('_bindMethods async wrapper', () => {
    it('should auto-call update() when an async method completes', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const doc = globalThis.document;

      const root = doc.createElement('div');
      doc.body.appendChild(root);

      const ast = makeAST({ componentFullName: 'app-async' });
      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);

      let updateCount = 0;
      const originalUpdate = instance.update;
      instance.update = function () {
        updateCount++;
        return originalUpdate.call(this);
      };

      // Add an async method and call _bindMethods
      instance.loadData = async function () {
        return 'done';
      };
      LWElement.prototype._bindMethods.call(instance);

      assert.equal(updateCount, 0);
      await instance.loadData();
      assert.equal(updateCount, 1, 'update() should be called after async method completes');
    });

    it('should update() without leaking an unhandled rejection when an async method rejects', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const doc = globalThis.document;

      const root = doc.createElement('div');
      doc.body.appendChild(root);

      const ast = makeAST({ componentFullName: 'app-async-reject' });
      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);

      let updateCount = 0;
      const originalUpdate = instance.update;
      instance.update = function () {
        updateCount++;
        return originalUpdate.call(this);
      };

      instance.failToLoad = async function () {
        throw new Error('boom');
      };
      LWElement.prototype._bindMethods.call(instance);

      const unhandled = [];
      const onUnhandled = reason => unhandled.push(reason);
      process.on('unhandledRejection', onUnhandled);
      try {
        // The caller handles the rejection; the wrapper's side chain must not
        // report it a second time as unhandled.
        await assert.rejects(() => instance.failToLoad(), /boom/);
        // Give the wrapper's side chain time to surface a leak.
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(updateCount, 1, 'update() should still be called after the async method rejects');
        assert.equal(unhandled.length, 0, 'no unhandled rejection should leak from the wrapper');
      } finally {
        process.removeListener('unhandledRejection', onUnhandled);
      }
    });

    it('should not wrap sync methods with update()', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const doc = globalThis.document;

      const root = doc.createElement('div');
      doc.body.appendChild(root);

      const ast = makeAST({ componentFullName: 'app-sync' });
      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);

      let updateCount = 0;
      const originalUpdate = instance.update;
      instance.update = function () {
        updateCount++;
        return originalUpdate.call(this);
      };

      instance.doWork = function () {
        return 'done';
      };
      LWElement.prototype._bindMethods.call(instance);

      instance.doWork();
      assert.equal(updateCount, 0, 'update() should not be called after sync method');
    });
  });

  describe('_bindEvents', () => {
    it('should call update() after event handler runs', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const doc = globalThis.document;

      const root = doc.createElement('div');
      const btn = doc.createElement('button');
      btn.setAttribute('lw-elem', '');
      btn.setAttribute('lw-elem-bind', '');
      btn.setAttribute('lw-on:click', 'k1');
      root.appendChild(btn);
      doc.body.appendChild(root);

      const ast = makeAST({
        componentFullName: 'app-sync-event',
        'k1': {
          ast: [{ type: 'ExpressionStatement', expression: { type: 'NumericLiteral', value: 42 } }],
          lwValue: 'click',
          loc: {},
        },
      });

      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);

      let updateCount = 0;
      const originalUpdate = instance.update;
      instance.update = function () {
        updateCount++;
        return originalUpdate.call(this);
      };

      instance._bindEvents(btn);
      btn.click();

      assert.equal(updateCount, 1, 'should call update() after event handler');
    });
  });

  describe('_bindModels number input', () => {
    it('should set null (not 0) on the model when the input is cleared', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const doc = globalThis.document;

      const root = doc.createElement('div');
      const input = doc.createElement('input');
      input.type = 'number';
      input.setAttribute('lw-elem', '');
      input.setAttribute('lw-elem-bind', '');
      input.setAttribute('lw-model', 'k1');
      root.appendChild(input);
      doc.body.appendChild(root);

      const ast = makeAST({
        componentFullName: 'app-num',
        'k1': { ast: [{ type: 'ExpressionStatement', expression: { type: 'Identifier', name: 'amount' } }], loc: {} },
      });

      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);
      instance.amount = 5;

      instance._bindModels(input);

      input.value = '42';
      input.dispatchEvent(new globalThis.window.Event('input', { bubbles: true }));
      assert.equal(instance.amount, 42);

      input.value = '';
      input.dispatchEvent(new globalThis.window.Event('input', { bubbles: true }));
      assert.equal(instance.amount, null, 'clearing the input should yield null, not 0');
    });
  });

  describe('_restoreIfPlaceholders with detached placeholders', () => {
    it('should clean up placeholders that are no longer in the DOM', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const doc = globalThis.document;

      const root = doc.createElement('div');
      const container = doc.createElement('div');
      const elem = doc.createElement('div');
      elem.setAttribute('lw-elem', '');
      elem.setAttribute('lw-if', 'k1');
      container.appendChild(elem);
      root.appendChild(container);
      doc.body.appendChild(root);

      const ast = makeAST({
        shadowDom: false,
        componentFullName: 'app-detach',
        'k1': { ast: [{ type: 'ExpressionStatement', expression: { type: 'BooleanLiteral', value: false } }], loc: {} },
      });

      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);

      // First update removes the element and creates a placeholder
      instance.update();
      assert.equal(instance._ifPlaceholders.size, 1, 'placeholder should be tracked');

      // Simulate lw-for removing the container (detaches the placeholder)
      container.remove();

      // Next update should clean up the stale placeholder
      instance.update();
      assert.equal(instance._ifPlaceholders.size, 0, 'stale placeholder should be removed from set');
    });
  });

  describe('nested lw-if park/restore', () => {
    // DOM: root > outer(lw-if kOuter) > inner(lw-if kInner, lw kText)
    // with both conditions driven by closure variables.
    function setupNested() {
      const doc = globalThis.document;
      const root = doc.createElement('div');
      const container = doc.createElement('div');
      const outer = doc.createElement('div');
      outer.setAttribute('lw-elem', '');
      outer.setAttribute('lw-if', 'kOuter');
      const inner = doc.createElement('span');
      inner.setAttribute('lw-elem', '');
      inner.setAttribute('lw-if', 'kInner');
      inner.setAttribute('lw', 'kText');
      outer.appendChild(inner);
      container.appendChild(outer);
      root.appendChild(container);
      doc.body.appendChild(root);

      const state = { outerOn: true, innerOn: true };
      const ast = makeAST({
        componentFullName: 'app-nested',
        'kOuter': { get ast() { return [expr({ type: 'BooleanLiteral', value: state.outerOn })]; }, loc: {} },
        'kInner': { get ast() { return [expr({ type: 'BooleanLiteral', value: state.innerOn })]; }, loc: {} },
        'kText': { ast: [expr({ type: 'StringLiteral', value: 'HELLO' })], loc: {} },
      });
      return { root, container, outer, inner, state, ast };
    }

    it('should restore nested lw-if content in the same update pass', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const { root, outer, inner, state, ast } = setupNested();
      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);

      instance.update();
      state.innerOn = false;
      instance.update();
      state.outerOn = false;
      instance.update();
      assert.equal(root.contains(outer), false, 'outer parked');

      // Turn both back on with a SINGLE update: the inner element must come
      // back in the same pass, not one update later.
      state.outerOn = true;
      state.innerOn = true;
      instance.update();
      assert.equal(root.contains(outer), true, 'outer restored');
      assert.equal(root.contains(inner), true, 'inner restored in the same update pass');
      assert.equal(inner.innerText, 'HELLO', 'inner directives processed after restore');
    });

    it('should keep dormant placeholders alive while their ancestor is parked', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const { root, outer, inner, state, ast } = setupNested();
      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);

      instance.update();
      state.innerOn = false;
      instance.update();
      state.outerOn = false;
      instance.update();
      // A few idle updates while parked must not garbage-collect the dormant
      // inner entry (the original orphaning bug).
      instance.update();
      instance.update();

      // Restore the ancestor with the inner condition still false.
      state.outerOn = true;
      instance.update();
      assert.equal(root.contains(outer), true, 'outer restored');
      assert.equal(root.contains(inner), false, 'inner still parked');
      assert.equal(instance._ifPlaceholders.size, 1, 'inner entry is tracked again');

      state.innerOn = true;
      instance.update();
      assert.equal(root.contains(inner), true, 'inner restores after its ancestor came back');
      assert.equal(inner.innerText, 'HELLO');
    });

    it('should release all entries in one update when a parked subtree is removed for good', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const { root, container, state, ast } = setupNested();
      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);

      instance.update();
      state.innerOn = false;
      instance.update();
      state.outerOn = false;
      instance.update();
      assert.equal(instance._ifPlaceholders.size, 1, 'outer entry tracked (inner is stashed on it)');

      // Remove the subtree that holds the outer placeholder — like an lw-for
      // shrink would. One update must drop the whole chain, not one level
      // per pass.
      container.remove();
      instance.update();
      assert.equal(instance._ifPlaceholders.size, 0, 'dead chain released in a single update');
    });

    it('should survive a turnedOff hook reparenting the parked element', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const doc = globalThis.document;
      const { root, outer, inner, state, ast } = setupNested();
      const pool = doc.createElement('div');
      outer.turnedOff = function () { pool.appendChild(this); };
      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);

      instance.update();
      state.innerOn = false;
      instance.update();
      state.outerOn = false;
      instance.update();
      await nextTick(); // let turnedOff move the parked element into the pool
      assert.equal(pool.contains(outer), true, 'hook moved the parked element');
      instance.update(); // idle pass must not orphan the dormant inner entry

      state.outerOn = true;
      state.innerOn = true;
      instance.update();
      assert.equal(root.contains(outer), true, 'outer restored from the pool');
      assert.equal(root.contains(inner), true, 'inner survived the reparenting');
    });

    it('should drop registry entries whose element lost its lw-if attribute', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const { root, outer, state, ast } = setupNested();
      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);

      instance.update();
      state.outerOn = false;
      instance.update();
      assert.equal(instance._ifPlaceholders.size, 1);

      outer.removeAttribute('lw-if');
      instance.update();
      assert.equal(instance._ifPlaceholders.size, 0, 'keyless entry dropped instead of rescanned forever');
    });
  });

  describe('lw-for rows with lw-if', () => {
    function setupFor(rowIfEntry) {
      const doc = globalThis.document;
      const root = doc.createElement('div');
      const container = doc.createElement('div');
      const forNode = doc.createElement('div');
      forNode.setAttribute('lw-elem', '');
      forNode.setAttribute('lw-for', 'kFor');
      forNode.setAttribute('lw-if', 'kIf');
      forNode.setAttribute('lw', 'kRowText');
      container.appendChild(forNode);
      root.appendChild(container);
      doc.body.appendChild(root);

      const ast = makeAST({
        componentFullName: 'app-rows',
        'kFor': { astItems: [expr(ident('items'))], itemExpr: 'item', indexExpr: 'index', loc: {} },
        'kIf': rowIfEntry,
        'kRowText': { ast: [expr(ident('item'))], loc: {} },
      });
      return { root, container, ast };
    }
    const rowsOf = container => [...container.querySelectorAll('[lw-for-parent]')];
    const commentsOf = container => [...container.childNodes].filter(n => n.nodeType === 8);

    it('should keep updating when a row lw-if references the loop item', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const { root, container, ast } = setupFor({ ast: [expr(member('item', 'visible'))], loc: {} });
      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);
      instance.items = [{ visible: false }];

      // The parked row's registry entry must not brick later updates by
      // evaluating "item.visible" without the loop context.
      instance.update();
      instance.update();
      instance.update();
      assert.equal(rowsOf(container).length, 0, 'row hidden while item.visible is false');

      instance.items[0].visible = true;
      instance.update();
      assert.equal(rowsOf(container).length, 1, 'row appears when item.visible becomes true');
    });

    it('should keep rendering when a middle item is falsy and preserve row order', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const { root, container, ast } = setupFor({ ast: [expr(ident('item'))], loc: {} });
      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);
      instance.items = ['a', '', 'c'];

      instance.update();
      instance.update();
      assert.deepEqual(rowsOf(container).map(n => n.innerText), ['a', 'c'],
        'truthy rows render around the parked middle row');
      assert.equal(commentsOf(container).length, 1, 'middle row parked as one placeholder');

      instance.items = ['a', 'b', 'c'];
      instance.update();
      assert.deepEqual(rowsOf(container).map(n => n.innerText), ['a', 'b', 'c'],
        'restored row keeps its position and gets the fresh item');
    });

    it('should not grow the registry or DOM while a row lw-if stays false', async () => {
      setupDOM();
      const LWElement = await loadLWElement();
      const { root, container, ast } = setupFor({ get ast() { return [expr(ident('show'))]; }, loc: {} });
      globalThis.leanweb.componentPrefix = 'app-';
      const instance = createInstance(LWElement, root, ast);
      instance.items = ['a'];
      instance.show = false;

      for (let i = 0; i < 3; i++) {
        instance.update();
        assert.equal(instance._ifPlaceholders.size, 1, `registry stable after update #${i + 1}`);
        assert.equal(commentsOf(container).length, 1, `one placeholder after update #${i + 1}`);
        assert.equal(rowsOf(container).length, 0);
      }

      instance.show = true;
      instance.update();
      assert.deepEqual(rowsOf(container).map(n => n.innerText), ['a'], 'exactly one row after restore');
      assert.equal(commentsOf(container).length, 0, 'no stray placeholder comments');

      instance.show = false;
      instance.update();
      assert.equal(rowsOf(container).length, 0, 'row parked again');
      assert.equal(commentsOf(container).length, 1);
      assert.equal(instance._ifPlaceholders.size, 1);
    });
  });
});
