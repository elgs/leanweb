import * as parser from './lw-expr-parser.js';
import LWEventBus from './lw-event-bus.js';

globalThis.leanweb = globalThis.leanweb ?? {
   componentsListeningOnUrlChanges: [],
   eventBus: new LWEventBus(),
   updateComponents(...tagNames) {
      if (tagNames?.length) {
         tagNames.forEach(tagName => {
            leanweb.eventBus.dispatchEvent(tagName);
         });
      } else {
         leanweb.eventBus.dispatchEvent('update');
      }
   },
};

globalThis.addEventListener('hashchange', () => {
   leanweb.componentsListeningOnUrlChanges.forEach(component => {
      setTimeout(() => {
         component?.urlHashChanged?.call(component);
      });
   });
}, false);

const hasMethod = (obj, name) => {
   const desc = Object.getOwnPropertyDescriptor(obj, name);
   return !!desc && typeof desc.value === 'function';
}

const nextAllSiblings = (el, selector) => {
   const siblings = [];
   while (el = el.nextSibling) {
      if (el.nodeType === Node.ELEMENT_NODE && (!selector || el.matches(selector))) {
         siblings.push(el);
      }
   }
   return siblings;
};

export default class LWElement extends HTMLElement {
   constructor(ast) {
      super();
      this.ast = ast;

      leanweb.runtimeVersion = ast.runtimeVersion;
      leanweb.builderVersion = ast.builderVersion;

      const node = document.createElement('template');
      node.innerHTML = '<style>' + ast.globalCss + '</style>' +
         '<style>' + ast.css + '</style>' +
         ast.html;
      this.attachShadow({ mode: 'open' }).appendChild(node.content);

      this._bindMethods().then(() => {
         this.update(this.shadowRoot);
         this.domReady?.call(this);
      });

      if (this.urlHashChanged && typeof this.urlHashChanged === 'function') {
         leanweb.componentsListeningOnUrlChanges.push(this);
      }

      leanweb.eventBus.addEventListener('update', _ => {
         this.update();
      });

      leanweb.eventBus.addEventListener(ast.componentFullName, _ => {
         this.update();
      });
   }

   set urlHash(hash) {
      location.hash = hash;
   }

   get urlHash() {
      return location.hash;
   }

   set urlHashPath(hashPath) {
      const s = this.urlHash.split('?');
      if (s.length === 1) {
         this.urlHash = hashPath;
      } else if (s.length > 1) {
         this.urlHash = hashPath + '?' + s[1];
      }
   }

   get urlHashPath() {
      return this.urlHash.split('?')[0];
   }

   set urlHashParams(hashParams) {
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
   }

   get urlHashParams() {
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

   _getNodeContext(node) {
      const contextNode = node.closest('[lw-context]');
      return contextNode?.['lw-context'] ?? [this, globalThis];
   }

   update(rootNode = this.shadowRoot) {
      if (rootNode !== this.shadowRoot) {
         if (rootNode.hasAttribute('lw-elem')) {
            if (rootNode.hasAttribute('lw-elem-bind')) {
               this._bindEvents(rootNode);
               this._bindModels(rootNode);
               this._bindInputs(rootNode);
               rootNode.removeAttribute('lw-elem-bind');
            }
            if (rootNode.hasAttribute('lw-if')) {
               this.updateIf(rootNode);
            }
            if (!rootNode.hasAttribute('lw-false')) {
               this.updateEval(rootNode);
               this.updateClass(rootNode);
               this.updateBind(rootNode);
               this.updateModel(rootNode);
               if (rootNode.hasAttribute('lw-for')) {
                  this.updateFor(rootNode);
               }
            }
         }
      }
      const treeWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT, {
         acceptNode: node => {
            if (node.hasAttribute('lw-elem')) {
               if (node.hasAttribute('lw-elem-bind')) {
                  this._bindEvents(node);
                  this._bindModels(node);
                  this._bindInputs(node);
                  node.removeAttribute('lw-elem-bind');
               }
               if (node.hasAttribute('lw-if')) {
                  this.updateIf(node);
               }
               if (node.hasAttribute('lw-false')) {
                  return NodeFilter.FILTER_REJECT;
               }
               if (node.hasAttribute('lw-for-parent')) {
                  return NodeFilter.FILTER_REJECT;
               }
               if (node.hasAttribute('lw-for')) {
                  this.updateFor(node);
                  return NodeFilter.FILTER_REJECT;
               }
               this.updateEval(node);
               this.updateClass(node);
               this.updateBind(node);
               this.updateModel(node);
            }
            return NodeFilter.FILTER_ACCEPT;
         }
      });
      while (treeWalker.nextNode()) { }
   }

   async _bindMethods() {
      const methodNames = ['update', 'applyStyles'];
      const proto = Object.getPrototypeOf(this);
      methodNames.push(...Object.getOwnPropertyNames(proto).filter(name => hasMethod(proto, name)));
      methodNames.push(...Object.getOwnPropertyNames(this).filter(name => hasMethod(this, name)));
      methodNames.filter(name => name !== 'constructor').forEach(name => {
         this[name] = this[name].bind(this);
      });
   }

   _bindInputs(inputNode) {
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
      inputNode?.inputReady?.call(this);
      inputNode?.update?.();
   }

   // properties:
   // lw-on:click: true
   _bindEvents(eventNode) {
      for (const attr of eventNode.attributes) {
         const attrName = attr.name;
         const attrValue = attr.value;
         if (attrName.startsWith('lw-on:')) {
            if (eventNode[attrName]) {
               continue;
            }
            eventNode[attrName] = true;
            const interpolation = this.ast[attrValue];

            const context = this._getNodeContext(eventNode);
            eventNode.addEventListener(interpolation.lwValue, (event => {
               const eventContext = { '$event': event };
               const parsed = parser.evaluate(interpolation.ast, [eventContext, ...context], interpolation.loc);
               this.update();
               return parsed;
            }).bind(this));
         }
      }
   }

   // properties:
   // model_event_bound: boolean
   _bindModels(modelNode) {
      const key = modelNode.getAttribute('lw-model');
      if (!key) {
         return;
      }
      if (modelNode['model_event_bound']) {
         return;
      }
      modelNode['model_event_bound'] = true;
      const interpolation = this.ast[key];
      const context = this._getNodeContext(modelNode);
      modelNode.addEventListener('input', (event => {
         const astModel = interpolation.ast[0].expression;
         let object;
         let propertyExpr;
         if (astModel.type === 'MemberExpression') {
            propertyExpr = astModel.property.name;
            if (astModel.computed) {
               // . false and [] true
               propertyExpr = parser.evaluate([astModel.property], context, interpolation.loc)[0];
            }
            object = parser.evaluate([astModel.object], context, interpolation.loc)[0];
         } else if (astModel.type === 'Identifier') {
            object = this;
            propertyExpr = astModel.name;
         }

         if (modelNode.type === 'number') {
            object[propertyExpr] = modelNode.value * 1;
         } else if (modelNode.type === 'checkbox') {
            if (!Array.isArray(object[propertyExpr])) {
               object[propertyExpr] = [];
            }
            if (modelNode.checked) {
               object[propertyExpr].push(modelNode.value);
            } else {
               const index = object[propertyExpr].indexOf(modelNode.value);
               if (index > -1) {
                  object[propertyExpr].splice(index, 1);
               }
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
      }).bind(this));
   }

   updateModel(modelNode) {
      const key = modelNode.getAttribute('lw-model');
      if (!key) {
         return;
      }
      const context = this._getNodeContext(modelNode);
      const interpolation = this.ast[key];
      const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);
      if (modelNode.type === 'checkbox') {
         modelNode.checked = parsed[0].includes(modelNode.value);
      } else if (modelNode.type === 'radio') {
         modelNode.checked = parsed[0] === modelNode.value;
      } else if (modelNode.type === 'select-multiple') {
         for (let i = 0; i < modelNode.options.length; ++i) {
            const option = modelNode.options[i];
            if (parsed[0]) {
               option.selected = parsed[0].includes(option.value);
            }
         }
      } else {
         modelNode.value = parsed[0] ?? '';
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
   // lw-false: '' (if false)
   updateIf(ifNode) {
      const key = ifNode.getAttribute('lw-if');
      if (!key) {
         return;
      }
      const context = this._getNodeContext(ifNode);
      const interpolation = this.ast[key];
      const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);

      if (!parsed[0]) {
         ifNode.setAttribute('lw-false', '');
      } else {
         ifNode.removeAttribute('lw-false');
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

            if (!parsed[0]) {
               bindNode.removeAttribute(interpolation.lwValue);
            } else {
               bindNode.setAttribute(interpolation.lwValue, parsed[0]);
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
      const key = forNode.getAttribute('lw-for');
      if (!key) {
         return;
      }
      const context = this._getNodeContext(forNode);
      const interpolation = this.ast[key];
      const items = parser.evaluate(interpolation.astItems, context, interpolation.loc)[0] ?? [];
      const rendered = nextAllSiblings(forNode, `[lw-for-parent="${key}"]`);
      for (let i = items.length; i < rendered.length; ++i) {
         rendered[i].remove();
      }

      let currentNode = forNode;
      items.forEach((item, index) => {
         let node;
         if (rendered.length > index) {
            node = rendered[index];
         } else {
            node = forNode.cloneNode(true);
            node.removeAttribute('lw-for');
            // node.removeAttribute('lw-elem');
            node.setAttribute('lw-for-parent', key);
            node.setAttribute('lw-context', '');
            currentNode.insertAdjacentElement('afterend', node);
         }
         currentNode = node;
         const itemContext = { [interpolation.itemExpr]: item };
         if (interpolation.indexExpr) {
            itemContext[interpolation.indexExpr] = index;
         }

         node['lw-context'] = [itemContext, ...context];
         this.update(node);
      });
   }

   applyStyles(...styles) {
      if (!styles) {
         return;
      }
      styles.forEach(style => {
         if (typeof style !== 'string') {
            style = style.toString();
         }
         const styleNode = document.createElement('style');
         styleNode.innerHTML = style;
         this.shadowRoot.appendChild(styleNode);
      });
   }
}