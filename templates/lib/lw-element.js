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

   _bind(selector = '', rootNode = this.shadowRoot, context = this) {
      this._bindEvents(selector, rootNode, context);
      this._bindModels(selector, rootNode, context);
   }

   async _bindMethods(context = this) {
      const methodNames = [];
      const proto = Object.getPrototypeOf(context);
      methodNames.push(...Object.getOwnPropertyNames(proto).filter(name => hasMethod(proto, name)));
      methodNames.push(...Object.getOwnPropertyNames(context).filter(name => hasMethod(context, name)));
      methodNames.filter(name => name !== 'constructor').forEach(name => {
         context[name] = context[name].bind(context);
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

   _bindModels(selector = '', rootNode = this.shadowRoot, context = this) {
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-model]', rootNode);
      for (const modelNode of nodes) {
         if (modelNode['model_event_bound']) {
            continue;
         }
         modelNode['model_event_bound'] = true;

         const key = modelNode.getAttribute('lw-model');
         const interpolation = this._component.interpolation[key];

         modelNode.addEventListener('change', (event => {
            const valueExpression = interpolation.value;
            if (interpolation.astObj) {
               const object = parser.evaluate(interpolation.astObj, context, interpolation.loc)[0];
               if (event.target.type === 'number') {
                  object[valueExpression] = event.target.value * 1;
               } else {
                  object[valueExpression] = event.target.value;
               }
            } else {
               if (event.target.type === 'number') {
                  context[valueExpression] = event.target.value * 1;
               } else {
                  context[valueExpression] = event.target.value;
               }
            }
            context.update();
         }).bind(context));
      }
   }

   _bindEvents(selector = '', rootNode = this.shadowRoot, context = this) {
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-on]', rootNode);
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
                  context['$event'] = event;
                  const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);
                  delete context['$event'];
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
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-model]:not([lw-off])', rootNode);
      nodes.forEach(modelNode => {
         const key = modelNode.getAttribute('lw-model');
         const interpolation = this._component.interpolation[key];
         const parsed = parser.evaluate(interpolation.ast, context, interpolation.loc);
         modelNode.value = parsed[0];
      });
   }

   updateEval(selector = '', rootNode = this.shadowRoot, context = this) {
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw]:not([lw-off])', rootNode);
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
            ifNode.setAttribute('lw-off', '');
         } else {
            ifNode.removeAttribute('lw-off');
         }
      });
   }

   updateClass(selector = '', rootNode = this.shadowRoot, context = this) {
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-class]:not([lw-off])', rootNode);
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
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-bind]:not([lw-off])', rootNode);
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
      const nodes = this._querySelectorAllIncludingSelf(selector.trim() + '[lw-for]', rootNode);
      for (const forNode of nodes) {
         const key = forNode.getAttribute('lw-for');

         const interpolation = this._component.interpolation[key];
         const items = parser.evaluate(interpolation.astItems, context, interpolation.loc)[0];

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
               node.removeAttribute('lw-off');
               node.setAttribute('lw-for-parent', key);
               currentNode.insertAdjacentElement('afterend', node);
            }
            currentNode = node;
            const itemContext = { [interpolation.itemExpr]: item, [interpolation.indexExpr]: index };
            const localContext = [itemContext, context]
            node['lw-context'] = localContext;
            if (rendered.length > index) {
               this._bind(selector, node, localContext);
            }
            this.update(selector, node, localContext);
         });
      }
   }
}