import * as parser from './lw-expr-parser.js';

const hasMethod = (obj, name) => {
   const desc = Object.getOwnPropertyDescriptor(obj, name);
   return !!desc && typeof desc.value === 'function';
}

const nextAllSiblings = (el, selector) => {
   const siblings = [];
   while ((el = el.nextSibling)) {
      if (el.nodeType === Node.ELEMENT_NODE && (!selector || el.matches(selector))) {
         siblings.push(el);
      }
   }
   return siblings;
};

export default class LWElement extends HTMLElement {
   _component;
   constructor(component) {
      super();
      this._component = component;

      const node = document.getElementById(component.id).content.cloneNode(true);
      this.attachShadow({ mode: 'open' }).appendChild(node);

      this._bindMethods().then(() => {
         this._bind();
         this.update();
      });
   }

   _querySelectorAllIncludingSelf(selector, rootNode) {
      const nodes = [];
      if (rootNode.matches && rootNode.matches(selector)) {
         nodes.push(rootNode);
      }
      rootNode.querySelectorAll(selector).forEach(evalNode => {
         nodes.push(evalNode);
      });
      return nodes;
   }

   _bind(selector = '', rootNode = this.shadowRoot, context = this) {
      this._bindEvents(selector, rootNode, context);
      this._bindModels(selector, rootNode, context);
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

   _bindModels(selector = '', rootNode = this.shadowRoot, context = this) {
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-model]:not([lw-false])', rootNode);
      for (const modelNode of nodes) {
         if (modelNode['model_event_bound']) {
            continue;
         }
         modelNode['model_event_bound'] = true;
         const key = modelNode.getAttribute('lw-model');
         const interpolation = this._component.interpolation[key];
         modelNode.addEventListener('input', (event => {
            const astModel = interpolation.ast[0].expression;
            if (astModel.type === 'MemberExpression') {
               const object = parser.evaluate([astModel.object], context, interpolation.loc)[0];
               if (event.target.type === 'number') {
                  object[astModel.property.name] = event.target.value * 1;
               } else {
                  object[astModel.property.name] = event.target.value;
               }
            } else if (astModel.type === 'Identifier') {
               if (event.target.type === 'number') {
                  this[astModel.name] = event.target.value * 1;
               } else {
                  this[astModel.name] = event.target.value;
               }
            }
            this.update();
         }).bind(this));
      }
   }

   _bindEvents(selector = '', rootNode = this.shadowRoot, context = this) {
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-on]:not([lw-false])', rootNode);
      nodes.forEach(eventNode => {
         for (const attr of eventNode.attributes) {
            const attrName = attr.name;
            const attrValue = attr.value;
            if (attrName.startsWith('lw-on:')) {
               if (eventNode[attr.name]) {
                  continue;
               }
               eventNode[attr.name] = true;
               const interpolation = this._component.interpolation[attrValue];

               eventNode.addEventListener(interpolation.lwValue, (event => {
                  const eventContext = { '$event': event };
                  const localContext = [eventContext, context].flat(Infinity);
                  const parsed = parser.evaluate(interpolation.ast, localContext, interpolation.loc);
                  return parsed;
               }).bind(context));
            }
         }
      });
   }

   update(selector = '', rootNode = this.shadowRoot, context = this) {
      this.updateEval(selector, rootNode, context);
      this.updateIf(selector, rootNode, context);
      this.updateClass(selector, rootNode, context);
      this.updateModel(selector, rootNode, context);
      this.updateBind(selector, rootNode, context);
      this.updateFors(selector, rootNode, context);
   }

   updateModel(selector = '', rootNode = this.shadowRoot, context = this) {
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-model]:not([lw-false])', rootNode);
      nodes.forEach(modelNode => {
         const key = modelNode.getAttribute('lw-model');
         const interpolation = this._component.interpolation[key];
         const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);
         modelNode.value = parsed[0];
      });
   }

   updateEval(selector = '', rootNode = this.shadowRoot, context = this) {
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw]:not([lw-false])', rootNode);
      nodes.forEach(evalNode => {
         const key = evalNode.getAttribute('lw');
         const interpolation = this._component.interpolation[key];
         const localContext = evalNode['lw-context'];
         if (localContext) {
            context = localContext;
         }
         const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);
         evalNode.innerText = parsed[0];
      });
   }

   updateIf(selector = '', rootNode = this.shadowRoot, context = this) {
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-if]', rootNode);
      nodes.forEach(ifNode => {
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

   updateClass(selector = '', rootNode = this.shadowRoot, context = this) {
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-class]:not([lw-false])', rootNode);
      nodes.forEach(classNode => {
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

   updateBind(selector = '', rootNode = this.shadowRoot, context = this) {
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-bind]:not([lw-false])', rootNode);
      nodes.forEach(bindNode => {
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

   updateFors(selector = '', rootNode = this.shadowRoot, context = this) {
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-for]', rootNode); // todo need to change to get only first level
      for (const forNode of nodes) {
         const key = forNode.getAttribute('lw-for');

         const interpolation = this._component.interpolation[key];
         const items = parser.evaluate(interpolation.astItems, context, interpolation.loc)[0];

         const rendered = nextAllSiblings(forNode, `[lw-for-parent="${key}"]`);
         rendered.forEach(r => r.remove());

         let currentNode = forNode;
         items.forEach((item, index) => {
            const node = forNode.cloneNode(true);
            node.removeAttribute('lw-for');
            node.removeAttribute('lw-false');
            node.setAttribute('lw-for-parent', key);
            currentNode.insertAdjacentElement('afterend', node);
            currentNode = node;
            const itemContext = { [interpolation.itemExpr]: item, [interpolation.indexExpr]: index };
            const localContext = [itemContext, context].flat(Infinity);
            node['lw-context'] = localContext;
            this._bind(selector, node, localContext);
            this.update(selector, node, localContext);
         });
      }
   }
}