import * as parser from './lw-expr-parser.js';
import LWEventBus from './lw-event-bus.js';

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
   constructor(component) {
      super();
      this._component = component;
      const node = document.getElementById(component.id).content.cloneNode(true);
      this.attachShadow({ mode: 'open' }).appendChild(node);

      this._bindMethods().then(() => {
         this._bind();
         this.update();
         if (this.domReady && typeof this.domReady === 'function') {
            this.domReady.call(this);
         }
      });
   }

   static eventBus = new LWEventBus();

   _getNodeContext(node) {
      const contextNode = node.closest('[lw-context]');
      if (contextNode) {
         return contextNode['lw-context'];
      } else {
         return this;
      }
   }

   // lw-if:   reject lw-for
   // lw-for:  reject lw-false
   // others:  reject both lw-for and lw-false 
   // all:     reject lw-for-parent
   _queryNodes(selector = '', rootNode = this.shadowRoot, excludeLwFalse = true, excludeLwFor = true) {
      if (rootNode[selector]) {
         return rootNode[selector];
      }
      const nodes = [];
      if (rootNode !== this.shadowRoot) {
         if (excludeLwFalse && rootNode.matches('[lw-false]')) {
            return nodes;
         }
         if (excludeLwFor && rootNode.matches('[lw-for]')) {
            return nodes;
         }
         if (rootNode.matches(selector.trim())) {
            nodes.push(rootNode);
         }
      }
      const treeWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT, {
         acceptNode: node => {
            if (node.matches('[lw-for-parent]')) {
               return NodeFilter.FILTER_REJECT;
            }
            if (excludeLwFalse && node.matches('[lw-false]')) {
               return NodeFilter.FILTER_REJECT;
            }
            if (excludeLwFor && node.matches('[lw-for]')) {
               return NodeFilter.FILTER_REJECT;
            }
            if (node.matches(selector.trim())) {
               nodes.push(node);
            }
            return NodeFilter.FILTER_ACCEPT;
         }
      });
      while (treeWalker.nextNode()) { }
      rootNode[selector] = nodes;
      return nodes;
   }

   _bind(rootNode = this.shadowRoot) {
      this._bindEvents(rootNode);
      this._bindModels(rootNode);
      this._bindInputs(rootNode);
   }

   async _bindMethods() {
      const methodNames = [];
      const proto = Object.getPrototypeOf(this);
      methodNames.push(...Object.getOwnPropertyNames(proto).filter(name => hasMethod(proto, name)));
      methodNames.push(...Object.getOwnPropertyNames(this).filter(name => hasMethod(this, name)));
      methodNames.filter(name => name !== 'constructor').forEach(name => {
         this[name] = this[name].bind(this);
      });
   }

   // attribute: lw-input (marker)
   _bindInputs(rootNode = this.shadowRoot) {
      const nodes = this._queryNodes('[lw-input]', rootNode);
      nodes.forEach(inputNode => {
         for (const attr of inputNode.attributes) {
            const attrName = attr.name;
            const attrValue = attr.value;
            if (attrName.startsWith('lw-input:')) {
               const interpolation = this._component.interpolation[attrValue];
               const context = this._getNodeContext(inputNode);
               const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);
               inputNode[interpolation.lwValue] = parsed[0];
            }
         }
         if (inputNode.inputReady && typeof inputNode.inputReady === 'function') {
            inputNode.inputReady.call(this);
         }
         inputNode.update();
      });
   }

   // attribute: lw-on (marker)
   // properties:
   // lw-on:click: true
   _bindEvents(rootNode = this.shadowRoot) {
      const nodes = this._queryNodes('[lw-on]', rootNode);
      nodes.forEach(eventNode => {
         for (const attr of eventNode.attributes) {
            const attrName = attr.name;
            const attrValue = attr.value;
            if (attrName.startsWith('lw-on:')) {
               if (eventNode[attrName]) {
                  continue;
               }
               eventNode[attrName] = true;
               const interpolation = this._component.interpolation[attrValue];

               const context = this._getNodeContext(eventNode);
               eventNode.addEventListener(interpolation.lwValue, (event => {
                  const eventContext = { '$event': event };
                  const localContext = [eventContext, context].flat(Infinity);
                  const parsed = parser.evaluate(interpolation.ast, localContext, interpolation.loc);
                  return parsed;
               }).bind(this));
            }
         }
      });
   }

   // attribute: lw-model (marker)
   // properties:
   // model_event_bound: boolean
   _bindModels(rootNode = this.shadowRoot) {
      const nodes = this._queryNodes('[lw-model]', rootNode);
      for (const modelNode of nodes) {
         if (modelNode['model_event_bound']) {
            continue;
         }
         modelNode['model_event_bound'] = true;
         const key = modelNode.getAttribute('lw-model');
         const interpolation = this._component.interpolation[key];
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
   }

   update(rootNode = this.shadowRoot) {
      this.updateFor(rootNode);
      this.updateIf(rootNode);
      this.updateEval(rootNode);
      this.updateClass(rootNode);
      this.updateBind(rootNode);
      this.updateModel(rootNode);
   }

   // attribute: lw-model (marker)
   updateModel(rootNode = this.shadowRoot) {
      const nodes = this._queryNodes('[lw-model]', rootNode);
      nodes.forEach(modelNode => {
         const context = this._getNodeContext(modelNode);
         const key = modelNode.getAttribute('lw-model');
         const interpolation = this._component.interpolation[key];
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
      });
   }

   // attribute: lw: astKey
   // property: lw-eval-value-$key
   updateEval(rootNode = this.shadowRoot) {
      const nodes = this._queryNodes('[lw]', rootNode);
      nodes.forEach(evalNode => {
         const context = this._getNodeContext(evalNode);
         const key = evalNode.getAttribute('lw');
         const interpolation = this._component.interpolation[key];
         const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);
         if (evalNode['lw-eval-value-' + key] !== parsed[0]) {
            evalNode['lw-eval-value-' + key] = parsed[0];
            evalNode.innerText = parsed[0] ?? '';
         }
      });
   }

   // attribute: lw-if: astKey
   // lw-false: '' (if false)
   updateIf(rootNode = this.shadowRoot) {
      const nodes = this._queryNodes('[lw-if]', rootNode, false, true);
      nodes.forEach(ifNode => {
         const context = this._getNodeContext(ifNode);
         const key = ifNode.getAttribute('lw-if');
         const interpolation = this._component.interpolation[key];
         const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);

         if (!parsed[0]) {
            ifNode.setAttribute('lw-false', '');
         } else {
            ifNode.removeAttribute('lw-false');
         }
      });
   }

   // attribute: lw-class: astKey
   updateClass(rootNode = this.shadowRoot) {
      const nodes = this._queryNodes('[lw-class]', rootNode);
      nodes.forEach(classNode => {
         const context = this._getNodeContext(classNode);
         for (const attr of classNode.attributes) {
            const attrName = attr.name;
            const attrValue = attr.value;
            if (attrName.startsWith('lw-class:')) {
               const interpolation = this._component.interpolation[attrValue];
               const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);

               if (!parsed[0]) {
                  classNode.classList.remove(interpolation.lwValue);
               } else {
                  classNode.classList.add(interpolation.lwValue);
               }
            }
         }
      });
   }

   // attribute: lw-bind (marker)
   updateBind(rootNode = this.shadowRoot) {
      const nodes = this._queryNodes('[lw-bind]', rootNode);
      nodes.forEach(bindNode => {
         const context = this._getNodeContext(bindNode);
         for (const attr of bindNode.attributes) {
            const attrName = attr.name;
            const attrValue = attr.value;
            if (attrName.startsWith('lw-bind:')) {
               const interpolation = this._component.interpolation[attrValue];
               const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);

               if (!parsed[0]) {
                  bindNode.removeAttribute(interpolation.lwValue);
               } else {
                  bindNode.setAttribute(interpolation.lwValue, parsed[0]);
               }
            }
         }
      });
   }

   // parent attribytes:
   // lw-for: $astKey

   // child attributes:
   // lw-context: ''
   // lw-for-parent: $astKey

   // child propery:
   // lw-context: localContext
   updateFor(rootNode = this.shadowRoot) {
      const nodes = this._queryNodes('[lw-for]', rootNode, true, false);
      for (const forNode of nodes) {
         const context = this._getNodeContext(forNode);
         const key = forNode.getAttribute('lw-for');
         const interpolation = this._component.interpolation[key];
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
               node.setAttribute('lw-for-parent', key);
               node.setAttribute('lw-context', '');
               currentNode.insertAdjacentElement('afterend', node);
            }
            currentNode = node;
            const itemContext = { [interpolation.itemExpr]: item, [interpolation.indexExpr]: index };
            const localContext = [itemContext, context].flat(Infinity);
            node['lw-context'] = localContext;
            if (rendered.length <= index) {
               this._bind(node);
            }
            this.update(node);
         });
      }
   }
}