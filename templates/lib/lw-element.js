import * as parser from './lw-expr-parser.js';
import LWEventBus from './lw-event-bus.js';

globalThis.leanweb ??= {};

leanweb.componentsListeningOnUrlChanges = [];
leanweb.eventBus = new LWEventBus();
leanweb.updateComponents = function (...tagNames) {
  if (leanweb.debug) console.debug('[leanweb] updateComponents', tagNames?.length ? tagNames : '(all)');
  if (tagNames?.length) {
    tagNames.forEach(tagName => {
      leanweb.eventBus.dispatchEvent(tagName);
    });
  } else {
    leanweb.eventBus.dispatchEvent('update');
  }
};

Object.defineProperties(leanweb, {
  urlHash: {
    set(hash) { location.hash = hash; },
    get() { return location.hash; }
  },
  urlHashPath: {
    set(hashPath) {
      const s = this.urlHash.split('?');
      if (s.length === 1) {
        this.urlHash = hashPath;
      } else if (s.length > 1) {
        this.urlHash = hashPath + '?' + s[1];
      }
    },
    get() { return this.urlHash.split('?')[0]; }
  },
  urlHashParams: {
    set(hashParams) {
      if (!hashParams) {
        return;
      }

      const paramArray = [];
      Object.keys(hashParams).forEach(key => {
        const value = hashParams[key];
        if (Array.isArray(value)) {
          value.forEach(v => {
            paramArray.push(key + '=' + encodeURIComponent(v));
          });
        } else {
          paramArray.push(key + '=' + encodeURIComponent(value));
        }
      });
      this.urlHash = this.urlHashPath + '?' + paramArray.join('&');
    },
    get() {
      const ret = {};
      const s = this.urlHash.split('?');
      if (s.length > 1) {
        const p = new URLSearchParams(s[1]);
        p.forEach((v, k) => {
          if (ret[k] === undefined) {
            ret[k] = v;
          } else if (Array.isArray(ret[k])) {
            ret[k].push(v);
          } else {
            ret[k] = [ret[k], v];
          }
        });
      }
      return ret;
    }
  }
});

globalThis.addEventListener('hashchange', () => {
  leanweb.componentsListeningOnUrlChanges.forEach(component => {
    setTimeout(() => {
      component?.urlHashChanged?.call(component);
      component?.update?.call(component);
    });
  });
}, false);

// True while _removeIfNode swaps an lw-if subtree for its placeholder, so
// disconnectedCallback can tell parking apart from a real removal.
let parkingInProgress = false;

const hasMethod = (obj, name) => {
  const desc = Object.getOwnPropertyDescriptor(obj, name);
  return !!desc && typeof desc.value === 'function';
}

// Row slots created by updateFor after a template node: the live row element,
// or the comment placeholder of a row whose lw-if is currently false.
const nextAllRowSlots = (el, key) => {
  const slots = [];
  while (el = el.nextSibling) {
    if (el.nodeType === Node.ELEMENT_NODE && el.getAttribute('lw-for-parent') === key) {
      slots.push(el);
    } else if (el.nodeType === Node.COMMENT_NODE && el['lw-if-element']?.getAttribute('lw-for-parent') === key) {
      slots.push(el);
    }
  }
  return slots;
};

export default class LWElement extends HTMLElement {
  constructor(ast) {
    super();
    this.ast = ast;

    leanweb.runtimeVersion = ast.runtimeVersion;
    leanweb.builderVersion = ast.builderVersion;
    leanweb.componentPrefix ??= ast.componentFullName.split('-')[0] + '-';

    const node = document.createElement('template');
    node.innerHTML = ast.html;

    if (ast.shadowDom) {
      const componentSheet = new CSSStyleSheet();
      componentSheet.replaceSync(ast.css);
      this.attachShadow({ mode: 'open' }).appendChild(node.content);
      this.shadowRoot.adoptedStyleSheets = [globalThis.leanweb.__lw_globalStyleSheet, componentSheet].filter(Boolean);
      globalThis.leanweb.__lw_globalStyleImports?.forEach(url => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        this.shadowRoot.appendChild(link);
      });
      this._root = this.shadowRoot;
    } else {
      // Light-DOM content projection: the element's initial children — the
      // markup the PARENT's template placed between this component's tags —
      // are captured before the template renders and re-homed into the
      // template's <lw-slot>. They stay the parent's: parent context, parent
      // expressions, parent updates (the parent walks them at this
      // component's boundary; this component's own walker skips them). This
      // mirrors what shadow-DOM mode already gets from native <slot>.
      // Without an <lw-slot>, children stay ahead of the template untouched,
      // exactly as before.
      const initial = [...this.childNodes];
      const projected = initial.some(n => n.nodeType !== Node.TEXT_NODE || n.textContent.trim()) ? initial : null;
      projected?.forEach(n => n.remove());
      this.appendChild(node.content);
      if (!LWElement._injectedStyles) {
        LWElement._injectedStyles = new Set();
      }
      if (!LWElement._injectedStyles.has(ast.componentFullName)) {
        LWElement._injectedStyles.add(ast.componentFullName);
        const style = document.createElement('style');
        style.textContent = ast.css;
        document.head.appendChild(style);
      }
      this._root = this;
      if (projected) {
        const slot = this._findSlot();
        if (slot) {
          this['lw-projected-roots'] = [];
          for (const n of projected) {
            if (n.nodeType === Node.ELEMENT_NODE) {
              n.setAttribute('lw-projected', '');
              this['lw-projected-roots'].push(n);
            }
          }
          slot.append(...projected);
        } else {
          this.prepend(...projected);
        }
      }
    }

    this._bindMethods();
    setTimeout(() => {
      const result = this.domReady?.call(this);
      if (result && typeof result.then === 'function') {
        // domReady is async
        result.then(() => this.update());
      } else {
        // domReady is sync
        this.update();
      }
    });

    this._ifPlaceholders = new Set();
    this._forTemplates = new Set();
    this._eventBusListeners = [];
    this._registerListeners();
  }

  _registerListeners() {
    this._eventBusListeners.push(leanweb.eventBus.addEventListener('update', _ => {
      this.update();
    }));
    this._eventBusListeners.push(leanweb.eventBus.addEventListener(this.ast.componentFullName, _ => {
      this.update();
    }));
    if (this.urlHashChanged && typeof this.urlHashChanged === 'function') {
      leanweb.componentsListeningOnUrlChanges.push(this);
    }
  }

  connectedCallback() {
    if (this._eventBusListeners.length === 0) {
      this._registerListeners();
    }
  }

  disconnectedCallback() {
    // Parking (lw-if turning false) is a pause, not a removal: the element
    // comes back via its placeholder with everything intact, so keep the
    // bus and url subscriptions. Real removals still tear down; components
    // parked inside a subtree that later leaves for good are swept by
    // _teardownParked.
    if (parkingInProgress) {
      return;
    }
    this._teardown();
  }

  _teardown() {
    const idx = leanweb.componentsListeningOnUrlChanges.indexOf(this);
    if (idx > -1) {
      leanweb.componentsListeningOnUrlChanges.splice(idx, 1);
    }
    this._eventBusListeners?.forEach(listener => {
      leanweb.eventBus.removeEventListener(listener);
    });
    this._eventBusListeners = [];
  }

  // The template's own <lw-slot>: the first one that doesn't belong to a
  // nested component inside this template.
  _findSlot() {
    for (const slot of this._root.querySelectorAll('lw-slot')) {
      let el = slot.parentElement;
      while (el && el !== this && !el.localName.startsWith(leanweb.componentPrefix)) {
        el = el.parentElement;
      }
      if (el === this) {
        return slot;
      }
    }
    return null;
  }

  _getNodeContext(node) {
    const contextNode = node.closest('[lw-context]');
    // contextNode must be inside this component's root, not the root itself.
    // In non-shadow DOM, the component element (this._root === this) may carry
    // a [lw-context] set by a parent's lw-for — that context belongs to the
    // parent, not this component.
    if (contextNode && contextNode !== this._root && this._root.contains(contextNode)) {
      return contextNode['lw-context'];
    }
    return [{ 'this': this }, this, globalThis];
  }

  update(rootNode = this._root) {
    // Failed expressions report which component they belong to.
    parser.setErrorLabel(this.ast.componentFullName);
    // Restore any lw-if placeholders whose condition is now true before
    // walking the tree, so the restored elements get processed normally.
    this._restoreIfPlaceholders();

    // Process rootNode itself when called from updateFor with a cloned node.
    // TreeWalker never visits its own root, so we handle it manually here.
    // Skipped when rootNode === this._root because the component's own root
    // element is owned by the parent component's TreeWalker, not ours.
    // Nodes whose lw-if evaluated to false.  We defer DOM removal until
    // after the TreeWalker finishes so we don't detach the walker's current
    // navigation pointer (which would stop the walk).
    const toRemove = [];
    // lw-for templates rendered this pass; extracted from the DOM after the
    // walk (see _extractForTemplates) for the same navigation-safety reason.
    const toExtract = [];

    if (rootNode !== this._root) {
      if (rootNode.hasAttribute('lw-elem')) {
        // lw-for first, mirroring the walker: a template is inert — its
        // bindings only make sense inside a row context. Render the rows,
        // move the template out of the DOM and let its placeholder drive
        // future renders. (Reached when a projected root is an lw-for.)
        if (rootNode.hasAttribute('lw-for')) {
          this.updateFor(rootNode);
          this._extractForTemplates([rootNode]);
          return;
        }
        if (rootNode.hasAttribute('lw-elem-bind')) {
          this._bindModels(rootNode);
          this._bindEvents(rootNode);
          this._bindInputs(rootNode);
        }
        if (rootNode.hasAttribute('lw-if') && !this.updateIf(rootNode)) {
          // The whole subtree is leaving the DOM — park it without processing
          // its descendants, mirroring the FILTER_REJECT below for non-root
          // nodes. No walker is running yet, so the removal needs no deferral.
          this._removeIfNode(rootNode);
          return;
        } else {
          this.updateEval(rootNode);
          this.updateClass(rootNode);
          this.updateBind(rootNode);
          this.updateModel(rootNode);
        }
      }
    }
    // If rootNode is a child component (called from updateFor on a component
    // element), don't walk its descendants — they belong to the child's own
    // AST. Its bound attributes were refreshed above, so hand it the update:
    // parent renders, child renders.
    if (rootNode !== this._root && rootNode.localName.startsWith(leanweb.componentPrefix)) {
      if (typeof rootNode.update === 'function') rootNode.update();
      this._updateProjected(rootNode);
      return;
    }
    // Walk all descendant elements and process lw-* directives.
    // With shadow DOM, the shadow boundary naturally prevents walking into
    // child components. Without shadow DOM, we check for child components
    // by tag name (see FILTER_REJECT below) to mimic that boundary.
    const treeWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT, {
      acceptNode: node => {
        parser.setErrorLabel(this.ast.componentFullName);
        // Projected content belongs to the parent that wrote it; the
        // component it was projected into never processes it.
        if (node.hasAttribute('lw-projected')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.hasAttribute('lw-elem')) {
          if (node.hasAttribute('lw-for')) {
            this.updateFor(node);
            toExtract.push(node);
            return NodeFilter.FILTER_REJECT;
          }
          if (node.hasAttribute('lw-for-parent')) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.hasAttribute('lw-elem-bind')) {
            this._bindModels(node);
            this._bindEvents(node);
            this._bindInputs(node);
          }
          if (node.hasAttribute('lw-if') && !this.updateIf(node)) {
            toRemove.push(node);
            return NodeFilter.FILTER_REJECT;
          }
          this.updateEval(node);
          this.updateClass(node);
          this.updateBind(node);
          this.updateModel(node);
        }
        // Child component boundary. Its bound attributes were refreshed
        // above; hand it the update so parent state flows into children
        // without manual updateComponents() plumbing (parent renders, child
        // renders — children updated by their own cycle from here).
        if (node !== rootNode && node.localName.startsWith(leanweb.componentPrefix)) {
          if (typeof node.update === 'function') node.update();
          this._updateProjected(node);
          // Light DOM: the child's internal DOM is in the light DOM, so
          // FILTER_REJECT prevents walking into it. With shadow DOM the
          // boundary already isolates child internals, and we must not
          // reject so the TreeWalker still visits slotted content (light
          // DOM children owned by this parent).
          if (!this.ast.shadowDom) {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (treeWalker.nextNode()) { }
    this._applyIfRemovals(toRemove);
    this._extractForTemplates(toExtract);
    this._updateForPlaceholders(rootNode);
  }

  // Content this component projected into a child stays this component's:
  // after the child refreshed its own DOM, walk each projected root with
  // THIS component's context and AST. (A root parked by one of our own
  // lw-ifs is detached; its placeholder brings it back through the normal
  // sweep.)
  _updateProjected(childEl) {
    childEl['lw-projected-roots']?.forEach(p => {
      if (p.isConnected) {
        this.update(p);
      }
    });
  }

  // True when a node that left this component's tree is riding inside a
  // subtree some OTHER component parked: parked subtrees carry an
  // 'lw-if-placeholder' marker at their detached root. The marker is cleared
  // on restore and on teardown, so dead subtrees still purge normally.
  _parkedElsewhere(node) {
    let top = node;
    while (top.parentNode) {
      top = top.parentNode;
    }
    return !!top['lw-if-placeholder'];
  }

  _applyIfRemovals(toRemove) {
    for (const node of toRemove) {
      this._removeIfNode(node);
    }
  }

  // After its first render, an lw-for template leaves the DOM for good: a
  // comment placeholder anchors the rows and carries the detached template
  // for cloning. Templates therefore never pollute selectors, row counts,
  // CSS or the accessibility tree — and component instances that only ever
  // existed inside the template (never real rows) release their
  // subscriptions on the way out.
  _extractForTemplates(templates) {
    this._forTemplates ??= new Set();
    for (const template of templates) {
      if (!template.parentNode) {
        continue;
      }
      const placeholder = document.createComment('lw-for');
      placeholder['lw-for-template'] = template;
      template.replaceWith(placeholder);
      this._forTemplates.add(placeholder);
    }
  }

  // Re-renders every extracted lw-for whose placeholder sits under rootNode.
  // An entry whose placeholder left the component for good goes away with
  // its rows; entries inside a parked ancestor are dormant on that
  // ancestor's placeholder (see _removeIfNode), not in this registry.
  _updateForPlaceholders(rootNode = this._root) {
    if (!this._forTemplates) {
      return;
    }
    for (const placeholder of this._forTemplates) {
      if (!this._root.contains(placeholder)) {
        if (!this._parkedElsewhere(placeholder)) {
          this._forTemplates.delete(placeholder);
        }
        continue;
      }
      if (rootNode === this._root || rootNode.contains(placeholder)) {
        this.updateFor(placeholder);
      }
    }
  }

  _bindMethods() {
    const methodNames = ['update'];
    const proto = Object.getPrototypeOf(this);
    methodNames.push(...Object.getOwnPropertyNames(proto).filter(name => hasMethod(proto, name)));
    methodNames.push(...Object.getOwnPropertyNames(this).filter(name => hasMethod(this, name)));
    methodNames.filter(name => name !== 'constructor').forEach(name => {
      const bound = this[name].bind(this);
      if (bound[Symbol.toStringTag] === 'AsyncFunction') {
        this[name] = (...args) => {
          const result = bound(...args);
          // finally must attach directly to result so update() runs before
          // the caller's own await continuation; the trailing catch keeps
          // this side chain from re-reporting a rejection the caller already
          // handles on the returned promise.
          result.finally(() => this.update()).catch(() => { });
          return result;
        };
      } else {
        this[name] = bound;
      }
    });
  }

  // properties:
  // lw_input_bound: boolean
  _bindInputs(inputNode) {
    if (inputNode['lw_input_bound']) {
      return;
    }
    inputNode['lw_input_bound'] = true;
    for (const attr of inputNode.attributes) {
      const attrName = attr.name;
      const attrValue = attr.value;
      if (attrName.startsWith('lw-input:')) {
        const interpolation = this.ast[attrValue];
        const context = this._getNodeContext(inputNode);
        const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);
        inputNode[interpolation.lwValue] = parsed[0];
      }
    }
    inputNode?.inputReady?.call(inputNode);
    inputNode?.update?.call(inputNode);
  }

  // properties:
  // lw_event_bound: boolean
  _bindEvents(eventNode) {
    if (eventNode['lw_event_bound']) {
      return;
    }
    eventNode['lw_event_bound'] = true;
    for (const attr of eventNode.attributes) {
      const attrName = attr.name;
      const attrValue = attr.value;
      if (attrName.startsWith('lw-on:')) {
        const interpolation = this.ast[attrValue];
        interpolation.lwValue.split(',').forEach(eventType => {
          eventNode.addEventListener(eventType.trim(), event => {
            const context = this._getNodeContext(eventNode);
            const eventContext = { '$event': event, '$node': eventNode };
            const parsed = parser.evaluate(interpolation.ast, [eventContext, ...context], interpolation.loc);
            if (parsed.some(p => typeof p?.then !== 'function')) {
              this.update();
            }
          });
        });
      }
    }
  }

  // properties:
  // lw_model_bound: boolean
  _bindModels(modelNode) {
    const key = modelNode.getAttribute('lw-model');
    if (!key) {
      return;
    }
    if (modelNode['lw_model_bound']) {
      return;
    }
    modelNode['lw_model_bound'] = true;
    const interpolation = this.ast[key];
    modelNode.addEventListener('input', (event => {
      const context = this._getNodeContext(modelNode);
      const astModel = interpolation.ast[0].expression;
      let object;
      let propertyExpr;
      if (astModel.type === 'MemberExpression') {
        // . false and [] true
        propertyExpr = astModel.computed ? parser.evaluate([astModel.property], context, interpolation.loc)[0] : astModel.property.name;
        object = parser.evaluate([astModel.object], context, interpolation.loc)[0];
      } else if (astModel.type === 'Identifier') {
        object = this;
        propertyExpr = astModel.name;
      }

      if (modelNode.type === 'number' || modelNode.type === 'range') {
        // set do_not_update mark for cases when user inputs 0.01, 0.0 will not be evaluated prematurely
        modelNode.do_not_update = true;
        // valueAsNumber is NaN for an empty or partially-typed field; map it
        // to null so clearing the input doesn't coerce the model to 0.
        const parsedNumber = modelNode.valueAsNumber;
        object[propertyExpr] = Number.isNaN(parsedNumber) ? null : parsedNumber;
      } else if (modelNode.type === 'checkbox') {
        if (Array.isArray(object[propertyExpr])) {
          if (modelNode.checked) {
            if (!object[propertyExpr].includes(modelNode.value)) {
              object[propertyExpr].push(modelNode.value);
            }
          } else {
            const index = object[propertyExpr].indexOf(modelNode.value);
            if (index > -1) {
              object[propertyExpr].splice(index, 1);
            }
          }
        } else {
          object[propertyExpr] = modelNode.checked;
        }
      } else if (modelNode.type === 'select-multiple') {
        if (!Array.isArray(object[propertyExpr])) {
          object[propertyExpr] = [];
        }
        object[propertyExpr].length = 0;
        for (let i = 0; i < modelNode.options.length; ++i) {
          const option = modelNode.options[i];
          if (option.selected) {
            object[propertyExpr].push(option.value);
          }
        }
      } else {
        object[propertyExpr] = modelNode.value;
      }
      this.update();
      delete modelNode.do_not_update;
    }).bind(this));
  }

  updateModel(modelNode) {
    if (modelNode.do_not_update && (modelNode.type === 'number' || modelNode.type === 'range')) {
      return;
    }
    const key = modelNode.getAttribute('lw-model');
    if (!key) {
      return;
    }
    const context = this._getNodeContext(modelNode);
    const interpolation = this.ast[key];
    const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);
    if (modelNode.type === 'checkbox') {
      if (Array.isArray(parsed[0])) {
        modelNode.checked = parsed[0].includes?.(modelNode.value);
      } else {
        modelNode.checked = !!parsed[0];
      }
    } else if (modelNode.type === 'radio') {
      modelNode.checked = parsed[0] === modelNode.value;
    } else if (modelNode.type === 'select-multiple') {
      // First, clear all selections
      for (let i = 0; i < modelNode.options.length; ++i) {
        modelNode.options[i].selected = false;
      }
      // Then, set selected options
      if (parsed[0]) {
        for (let i = 0; i < modelNode.options.length; ++i) {
          const option = modelNode.options[i];
          option.selected = parsed[0].includes(option.value);
        }
      }
    } else {
      const newValue = parsed[0] ?? '';
      if (modelNode.value !== newValue) {
        modelNode.value = newValue;
      }
    }
  }

  // attribute: lw: astKey
  // property: lw-eval-value-$key
  updateEval(evalNode) {
    const key = evalNode.getAttribute('lw');
    if (!key) {
      return;
    }
    const context = this._getNodeContext(evalNode);
    const interpolation = this.ast[key];
    const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);
    if (evalNode['lw-eval-value-' + key] !== parsed[0] || typeof parsed[0] === 'object') {
      evalNode['lw-eval-value-' + key] = parsed[0];
      evalNode.innerText = parsed[0] ?? '';
    }
  }

  // attribute: lw-if: astKey
  // Returns true if the condition is true (element should stay), false if the
  // element should be removed.  The actual DOM removal is deferred so it
  // doesn't break the TreeWalker's navigation during the walk.
  updateIf(ifNode) {
    const key = ifNode.getAttribute('lw-if');
    if (!key) {
      return true;
    }
    const context = this._getNodeContext(ifNode);
    const interpolation = this.ast[key];
    const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);
    return !!parsed[0];
  }

  // Replace an element with a comment placeholder.
  _removeIfNode(ifNode) {
    if (!ifNode.parentNode) {
      return;
    }
    const placeholder = document.createComment('lw-if');
    placeholder['lw-if-element'] = ifNode;
    ifNode['lw-if-placeholder'] = placeholder;
    // Registry entries whose placeholders sit inside the subtree being
    // detached (e.g. a page card while another page is shown) can't restore
    // while this ancestor is off. Move them onto this placeholder so they
    // leave the per-update sweep but come back with the ancestor (see
    // _restoreIfNode); their own stashes ride along, so nesting is handled.
    const dormant = new Set();
    for (const p of this._ifPlaceholders) {
      if (ifNode.contains(p)) {
        dormant.add(p);
        this._ifPlaceholders.delete(p);
      }
    }
    placeholder['lw-dormant-placeholders'] = dormant;
    // Same treatment for extracted lw-for anchors inside the subtree: they
    // leave the per-update sweep and come back with the ancestor.
    const dormantFors = new Set();
    if (this._forTemplates) {
      for (const p of this._forTemplates) {
        if (ifNode.contains(p)) {
          dormantFors.add(p);
          this._forTemplates.delete(p);
        }
      }
    }
    placeholder['lw-dormant-for-templates'] = dormantFors;
    if (leanweb.debug) console.debug('[leanweb] park', this.ast.componentFullName, '<' + ifNode.localName + '>');
    parkingInProgress = true;
    try {
      ifNode.parentNode.replaceChild(placeholder, ifNode);
    } finally {
      parkingInProgress = false;
    }
    this._ifPlaceholders.add(placeholder);
    setTimeout(() => {
      ifNode.turnedOff?.call(ifNode);
    });
  }

  // Put a parked element back at its placeholder's position and wake the
  // entries that were parked inside its subtree.
  _restoreIfNode(placeholder) {
    const ifNode = placeholder['lw-if-element'];
    if (leanweb.debug) console.debug('[leanweb] restore', this.ast.componentFullName, '<' + ifNode.localName + '>');
    placeholder.parentNode.replaceChild(ifNode, placeholder);
    // Drop the parked marker (see _parkedElsewhere); re-set on the next park.
    delete ifNode['lw-if-placeholder'];
    this._ifPlaceholders.delete(placeholder);
    // A for..of over a Set visits entries added during iteration, so a sweep
    // in progress re-evaluates the woken entries in this same pass.
    placeholder['lw-dormant-placeholders']?.forEach(p => this._ifPlaceholders.add(p));
    placeholder['lw-dormant-for-templates']?.forEach(p => {
      this._forTemplates ??= new Set();
      this._forTemplates.add(p);
    });
    setTimeout(() => {
      ifNode.turnedOn?.call(ifNode);
    });
  }

  // Releases the subscriptions of every component inside a parked subtree
  // that is leaving for good (its placeholder's position was destroyed).
  // Recurses through dormant placeholders so nested parked subtrees are
  // swept too.
  _teardownParked(placeholder) {
    const rootEl = placeholder?.['lw-if-element'];
    if (rootEl) {
      for (const el of [rootEl, ...rootEl.querySelectorAll('*')]) {
        if (el.localName?.startsWith(leanweb.componentPrefix) && typeof el._teardown === 'function') {
          el._teardown();
        }
      }
      // The subtree is gone for good: clear the parked marker so any other
      // component whose placeholder rode inside purges too (_parkedElsewhere).
      delete rootEl['lw-if-placeholder'];
    }
    placeholder?.['lw-dormant-placeholders']?.forEach(p => this._teardownParked(p));
  }

  // Restores lw-if placeholders whose condition has become true.
  _restoreIfPlaceholders() {
    for (const placeholder of this._ifPlaceholders) {
      if (!this._root.contains(placeholder)) {
        // The placeholder's spot left this component's tree for good (e.g. a
        // removed lw-for row). Placeholders inside a parked lw-if subtree are
        // not in this registry — they live on the ancestor's placeholder and
        // return with it (see _removeIfNode) — so nothing reachable is lost.
        // Exception: OUR placeholder can sit inside a subtree ANOTHER
        // component parked (projected content under a child's hidden
        // chrome). That subtree can come back; stay dormant until it does or
        // is torn down for good (see _parkedElsewhere).
        // Parked components kept their subscriptions (see
        // disconnectedCallback); now that they can never return, release them.
        if (!this._parkedElsewhere(placeholder)) {
          this._teardownParked(placeholder);
          this._ifPlaceholders.delete(placeholder);
        }
        continue;
      }
      const ifNode = placeholder['lw-if-element'];
      const key = ifNode.getAttribute('lw-if');
      if (!key) {
        // No condition to evaluate — the entry can never restore.
        this._ifPlaceholders.delete(placeholder);
        continue;
      }
      // The removed node is detached, so its own context lookup would miss an
      // enclosing lw-for scope. Use the context captured on the node (lw-for
      // rows, refreshed by updateFor each pass), falling back to the
      // placeholder's position in the live tree.
      const context = ifNode['lw-context'] ?? this._getNodeContext(placeholder.parentElement ?? ifNode);
      const interpolation = this.ast[key];
      const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);
      if (parsed[0]) {
        this._restoreIfNode(placeholder);
      }
    }
  }

  // attribute: lw-class: astKey
  updateClass(classNode) {
    const context = this._getNodeContext(classNode);
    for (const attr of classNode.attributes) {
      const attrName = attr.name;
      const attrValue = attr.value;
      if (attrName.startsWith('lw-class:')) {
        const interpolation = this.ast[attrValue];
        const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);

        if (!parsed[0]) {
          classNode.classList.remove(interpolation.lwValue);
        } else {
          classNode.classList.add(interpolation.lwValue);
        }
      }
    }
  }

  updateBind(bindNode) {
    const context = this._getNodeContext(bindNode);
    for (const attr of bindNode.attributes) {
      const attrName = attr.name;
      const attrValue = attr.value;
      if (attrName.startsWith('lw-bind:')) {
        const interpolation = this.ast[attrValue];
        const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);

        if (interpolation.lwValue === 'class') {
          const dynamicClass = parsed[0];
          const initClass = bindNode.getAttribute('lw-init-class') || '';
          // Ensure initial classes are present
          if (initClass) {
            initClass.split(' ').forEach(cls => {
              if (cls) bindNode.classList.add(cls);
            });
          }
          // Remove previously applied dynamic class
          const prevClass = bindNode['lw-prev-class-' + attrValue];
          if (prevClass && prevClass !== dynamicClass) {
            bindNode.classList.remove(prevClass);
          }
          // Add or record the dynamic class
          if (dynamicClass) {
            bindNode.classList.add(dynamicClass);
            bindNode['lw-prev-class-' + attrValue] = dynamicClass;
          } else {
            bindNode['lw-prev-class-' + attrValue] = null;
          }
        } else {
          if (parsed[0] !== false && parsed[0] !== undefined && parsed[0] !== null) {
            bindNode.setAttribute(interpolation.lwValue, parsed[0]);
          } else {
            bindNode.removeAttribute(interpolation.lwValue);
          }
        }
      }
    }
  }

  // parent attribytes:
  // lw-for: $astKey

  // child attributes:
  // lw-context: ''
  // lw-for-parent: $astKey

  // child propery:
  // lw-context: localContext
  updateFor(forNode) {
    // forNode is the lw-for element on its FIRST render; afterwards the
    // template lives detached on a comment placeholder and forNode is that
    // comment (_extractForTemplates). Either way it anchors the rows.
    const isPlaceholder = forNode.nodeType === Node.COMMENT_NODE;
    const template = isPlaceholder ? forNode['lw-for-template'] : forNode;
    const key = template.getAttribute('lw-for');
    if (!key) {
      return;
    }
    const context = this._getNodeContext(isPlaceholder ? forNode.parentElement : template);
    const interpolation = this.ast[key];
    const items = parser.evaluate(interpolation.astItems, context, interpolation.loc)[0] ?? [];
    const rendered = nextAllRowSlots(forNode, key);

    // With lw-key="expr" on the lw-for element, rows are matched to items by
    // key instead of by position: node identity follows the DATA through
    // reorders, insertions and removals, so node-bound state (focus, hover,
    // CSS transitions, half-typed inputs) travels with its item. The key
    // expression sees the loop variable (and index, and component state) and
    // must yield defined, unique values (the builder rejects an empty one).
    // For lists holding stable objects, the item itself is a fine key:
    // lw-key="item". Without lw-key, behavior is exactly the positional
    // reuse it has always been.
    const keyAstKey = template.getAttribute('lw-key');
    const slotElement = slot => slot.nodeType === Node.COMMENT_NODE ? slot['lw-if-element'] : slot;
    let byKey = null;
    if (keyAstKey) {
      byKey = new Map();
      for (const slot of rendered) {
        const k = slotElement(slot)?.['lw-key-value'];
        // Duplicate or undefined keys: first slot wins, extras fall through
        // to surplus removal below.
        if (k !== undefined && !byKey.has(k)) {
          byKey.set(k, slot);
        }
      }
    }

    let currentNode = forNode;
    items.forEach((item, index) => {
      const itemContext = { [interpolation.itemExpr]: item };
      if (interpolation.indexExpr) {
        itemContext[interpolation.indexExpr] = index;
      }

      let slot;
      let itemKey;
      if (byKey) {
        const keyInterpolation = this.ast[keyAstKey];
        itemKey = parser.evaluate(keyInterpolation.ast, [itemContext, ...context], keyInterpolation.loc)[0];
        slot = byKey.get(itemKey);
        byKey.delete(itemKey);
      } else if (rendered.length > index) {
        slot = rendered[index];
      }

      let node;
      let placeholder = null;
      if (slot !== undefined) {
        node = slot;
        if (node.nodeType === Node.COMMENT_NODE) {
          placeholder = node;
          node = placeholder['lw-if-element'];
        }
        // Keyed rows can arrive out of order; move the slot into position.
        if (byKey) {
          const domSlot = placeholder ?? node;
          if (currentNode.nextSibling !== domSlot) {
            currentNode.after(domSlot);
          }
        }
      } else {
        node = template.cloneNode(true);
        node.removeAttribute('lw-for');
        // node.removeAttribute('lw-elem');
        node.setAttribute('lw-for-parent', key);
        node.setAttribute('lw-context', '');
        // after() also works when the anchor is a parked row's comment.
        currentNode.after(node);
      }
      if (byKey) {
        node['lw-key-value'] = itemKey;
      }
      currentNode = placeholder ?? node;

      node['lw-context'] = [itemContext, ...context];
      if (placeholder) {
        // The row is parked. update() must not run on the detached row —
        // context lookups only work in the live tree — so re-evaluate its
        // lw-if against the fresh item context here and restore it in place
        // (keeping its position) when the condition has become true.
        const ifKey = node.getAttribute('lw-if');
        if (ifKey && parser.evaluate(this.ast[ifKey].ast, node['lw-context'], this.ast[ifKey].loc)[0]) {
          this._restoreIfNode(placeholder);
          currentNode = node;
          this.update(node);
        }
      } else {
        this.update(node);
        if (!node.parentNode) {
          // update() parked this row; anchor the walk on its placeholder so
          // the next item still inserts at a live position.
          currentNode = node['lw-if-placeholder'] ?? currentNode;
        }
      }
    });

    // Surplus rows: whatever no item claimed this pass. A parked surplus
    // row's registry entry goes with its placeholder, and any components
    // parked inside it release their subscriptions.
    const surplus = byKey ? [...byKey.values()] : rendered.slice(items.length);
    for (const slot of surplus) {
      if (slot.nodeType === Node.COMMENT_NODE) {
        this._teardownParked(slot);
        this._ifPlaceholders.delete(slot);
      }
      slot.remove();
    }
  }
}