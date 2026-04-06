import { describe, it, beforeEach } from 'node:test';
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
  for (const method of ['update', 'updateEval', 'updateIf', 'updateClass', 'updateBind', 'updateModel', 'updateFor', '_bindModels', '_bindEvents', '_bindInputs', '_getNodeContext', '_restoreIfPlaceholders', '_removeIfNode', '_applyIfRemovals']) {
    if (LWElement.prototype[method]) {
      instance[method] = LWElement.prototype[method].bind(instance);
    }
  }
  return instance;
}

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
});
