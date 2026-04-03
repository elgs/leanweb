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
  describe('light DOM boundary', () => {
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

      // Create a minimal LWElement-like object with _root and ast.
      const ast = makeAST({
        componentFullName: 'app-parent',
        'k1': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'parent' } }], loc: {} },
        // k2 belongs to the child component — parent shouldn't process it.
        'k2': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'SHOULD_NOT_APPEAR' } }], loc: {} },
      });

      // Use Object.create to get a real LWElement instance without calling constructor.
      // Ensure componentPrefix is set (normally done by the constructor).
      globalThis.leanweb.componentPrefix = 'app-';

      const instance = Object.create(LWElement.prototype);
      instance._root = root;
      instance.ast = ast;

      for (const method of ['update', 'updateEval', 'updateIf', 'updateClass', 'updateBind', 'updateModel', 'updateFor', '_bindModels', '_bindEvents', '_bindInputs', '_getNodeContext']) {
        if (LWElement.prototype[method]) {
          instance[method] = LWElement.prototype[method].bind(instance);
        }
      }

      instance.update();

      assert.equal(parentDiv.innerText, 'parent');
      // The inner span inside app-child should NOT have been processed.
      assert.equal(innerSpan['lw-eval-value-k2'], undefined,
        'parent update should not walk into child component');
    });

    it('should still process lw-if directive on the child component element itself', async () => {
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
        componentFullName: 'app-parent',
        'k1': { ast: [{ type: 'ExpressionStatement', expression: { type: 'BooleanLiteral', value: false } }], loc: {} },
      });

      const instance = Object.create(LWElement.prototype);
      instance._root = root;
      instance.ast = ast;
      for (const method of ['update', 'updateEval', 'updateIf', 'updateClass', 'updateBind', 'updateModel', 'updateFor', '_bindModels', '_bindEvents', '_bindInputs', '_getNodeContext']) {
        if (LWElement.prototype[method]) {
          instance[method] = LWElement.prototype[method].bind(instance);
        }
      }

      instance.update();

      assert.equal(child.hasAttribute('lw-false'), true,
        'parent should process lw-if on child component element');
    });
  });

  describe('update root node processing', () => {
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
        componentFullName: 'app-list',
        'k1': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'item-text' } }], loc: {} },
      });

      const instance = Object.create(LWElement.prototype);
      instance._root = root;
      instance.ast = ast;
      for (const method of ['update', 'updateEval', 'updateIf', 'updateClass', 'updateBind', 'updateModel', 'updateFor', '_bindModels', '_bindEvents', '_bindInputs', '_getNodeContext']) {
        if (LWElement.prototype[method]) {
          instance[method] = LWElement.prototype[method].bind(instance);
        }
      }

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
        componentFullName: 'app-self',
        'k1': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'root-text' } }], loc: {} },
        'k2': { ast: [{ type: 'ExpressionStatement', expression: { type: 'StringLiteral', value: 'child-text' } }], loc: {} },
      });

      const instance = Object.create(LWElement.prototype);
      instance._root = root;
      instance.ast = ast;
      for (const method of ['update', 'updateEval', 'updateIf', 'updateClass', 'updateBind', 'updateModel', 'updateFor', '_bindModels', '_bindEvents', '_bindInputs', '_getNodeContext']) {
        if (LWElement.prototype[method]) {
          instance[method] = LWElement.prototype[method].bind(instance);
        }
      }

      instance.update();

      // Only the child span should be processed.
      assert.equal(span.innerText, 'child-text');
      // The root itself (this._root) should NOT have had updateEval called on it.
      assert.equal(root['lw-eval-value-k1'], undefined,
        'component root element itself should not be processed as a directive');
    });
  });
});
