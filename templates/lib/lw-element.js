import * as parser from './lw-expr-parser.js';

function hasMethod(obj, name) {
   const desc = Object.getOwnPropertyDescriptor(obj, name);
   return !!desc && typeof desc.value === 'function';
}

const eventPrefix = 'lw-on:';
const classPrefix = 'lw-class:';
const bindPrefix = 'lw-bind:';

export default class LWElement extends HTMLElement {

   constructor(templateId) {
      super();

      this._bindMethods();

      const templateNode = document.getElementById(templateId).content.cloneNode(true);
      this.attachShadow({ mode: 'open' }).appendChild(templateNode);

      setTimeout(() => {
         this._bind();
         this.update();
      });
   }

   _bind(rootNode = this.shadowRoot, context = this) {
      const nodes = [];
      if (rootNode.attributes) {
         nodes.push(rootNode);
      }
      const treeWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT);
      while (treeWalker.nextNode()) {
         nodes.push(treeWalker.currentNode);
      }
      nodes.forEach(node => {
         for (let attr of node.attributes) {
            if (attr.name.startsWith(eventPrefix)) {
               this._bindEvent(node, attr.name, attr.value, context);
            } else if (attr.name.startsWith(classPrefix)) {
               this._bindClass(node, attr.name, attr.value, context);
            } else if (attr.name.startsWith(bindPrefix)) {
               this._bindBind(node, attr.name, attr.value, context);
            }
         }
      });
      this._bindModels(rootNode, context);
      this._bindFors(rootNode, context);
   }

   _bindMethods(context = this) {
      const methodNames = [];
      const proto = Object.getPrototypeOf(context);
      methodNames.push(...Object.getOwnPropertyNames(proto).filter(name => hasMethod(proto, name)));
      methodNames.push(...Object.getOwnPropertyNames(context).filter(name => hasMethod(context, name)));
      methodNames.filter(name => name !== 'constructor').forEach(name => {
         context[name] = context[name].bind(context);
      });
   }

   _bindModels(rootNode = this.shadowRoot, context = this) {
      const modelNodes = rootNode.querySelectorAll('input[lw-model]');
      if (rootNode.matches && rootNode.matches('input[lw-model]')) {
         modelNodes.push(rootNode);
      }
      for (const modelNode of modelNodes) {
         if (modelNode['model_event_bound']) {
            continue;
         }
         modelNode['model_event_bound'] = true;

         const expression = modelNode.getAttribute('lw-model');
         const indexOfLastDot = expression.lastIndexOf('.');
         if (indexOfLastDot > -1) {
            const objectExpression = expression.substring(0, indexOfLastDot);
            const ast = parser.parse(objectExpression);
            modelNode['lw-model-object'] = ast;
         }

         modelNode.addEventListener('keyup', (event => {
            const indexOfLastDot = expression.lastIndexOf('.');
            if (indexOfLastDot > -1) {
               const valueExpression = expression.substring(indexOfLastDot + 1);
               const object = parser.eval(modelNode['lw-model-object'], context);
               if (event.target.type === 'number') {
                  object[valueExpression] = event.target.value * 1;
               } else {
                  object[valueExpression] = event.target.value;
               }
            } else {
               if (event.target.type === 'number') {
                  context[expression] = event.target.value * 1;
               } else {
                  context[expression] = event.target.value;
               }
            }
            context.update();
         }).bind(context));
      }
   }

   _bindFors(rootNode = this.shadowRoot, context = this) {
      const forNodes = rootNode.querySelectorAll('[lw-for]');
      if (rootNode.matches && rootNode.matches('[lw-for]')) {
         forNodes.push(rootNode);
      }
      for (const forNode of forNodes) {
         if (forNode['model_for_bound']) {
            continue;
         }
         forNode['model_for_bound'] = true;
         const expression = forNode.getAttribute('lw-for').trim();
         const tokens = expression.split(/\s+/g);
         const itemExpression = tokens[0];
         const itemsExpression = tokens[1];
         let indexExpression = '$index';
         if (tokens.length > 2) {
            indexExpression = tokens[2];
         }
         const ast = parser.parse(itemsExpression, context);
         const items = parser.eval(ast, context);
         items.forEach((item, index) => {
            const node = forNode.cloneNode(true);
            console.log(node);
            node.removeAttribute('lw-for');
            forNode.insertAdjacentElement('afterend', node);
            const itemContext = { [itemExpression]: item, [indexExpression]: index };
            this._bind(node, itemContext);
            this.update('', node, itemContext);
         });
      }
   }

   _bindEvent(node, eventAttrName, eventHandlerExpression, context = this) {
      if (node[eventAttrName]) {
         return;
      }
      const ast = parser.parse(eventHandlerExpression);
      node[eventAttrName] = ast;

      node.addEventListener(eventAttrName.substring(eventPrefix.length), (event => {
         context['$event'] = event;
         const ret = parser.eval(node[eventAttrName], context);
         delete context['$event'];
         return ret;
      }).bind(context));
   }

   _bindClass(node, classAttrName, classExpression, context = this) {
      if (node[classAttrName]) {
         return;
      }
      // put a hook
      if (!node.hasAttribute('lw-class')) {
         node.setAttribute('lw-class', '');
      }
      const ast = parser.parse(classExpression);
      node[classAttrName] = ast;
      const classValue = parser.eval(ast, context);
      if (!classValue) {
         node.classList.remove(classAttrName.substring(classPrefix.length));
      } else {
         node.classList.add(classAttrName.substring(classPrefix.length));
      }
   }

   _bindBind(node, bindAttrName, bindExpression, context = this) {
      if (node[bindAttrName]) {
         return;
      }
      // put a hook
      if (!node.hasAttribute('lw-bind')) {
         node.setAttribute('lw-bind', '');
      }
      const ast = parser.parse(bindExpression);
      node[bindAttrName] = ast;
      const bindValue = parser.eval(ast, context);
      if (!bindValue) {
         node.removeAttribute(bindAttrName.substring(bindPrefix.length));
      } else {
         node.setAttribute(bindAttrName.substring(bindPrefix.length), bindValue);
      }
   }

   update(selector = '', rootNode = this.shadowRoot, context = this) {
      this.updateEval(selector, rootNode, context);
      this.updateIf(selector, rootNode, context);
      this.updateClass(selector, rootNode, context);
      this.updateModel(selector, rootNode, context);
      this.updateBind(selector, rootNode, context);
   }

   updateModel(selector = '', rootNode = this.shadowRoot, context = this) {
      rootNode.querySelectorAll(selector.trim() + 'input[lw-model]').forEach(modelNode => {
         if (!modelNode['lw-model']) {
            const expression = modelNode.getAttribute('lw-model');
            const ast = parser.parse(expression);
            modelNode['lw-model'] = ast;
         }

         parser.evalAsync(modelNode['lw-model'], context).then(value => {
            modelNode.value = value;
         });
      });
   }

   updateEval(selector = '', rootNode = this.shadowRoot, context = this) {
      const evalNodes = [];
      if (rootNode.matches && rootNode.matches(selector.trim() + '[lw]')) {
         evalNodes.push(rootNode);
      }
      rootNode.querySelectorAll(selector.trim() + '[lw]').forEach(evalNode => {
         evalNodes.push(evalNode);
      });
      evalNodes.forEach(evalNode => {
         if (!evalNode['lw-eval']) {
            const expression = evalNode.innerText;
            const ast = parser.parse(expression);
            evalNode['lw-eval'] = ast;
         }
         parser.evalAsync(evalNode['lw-eval'], context).then(value => {
            evalNode.innerText = value;
         });
      })
   }

   updateIf(selector = '', rootNode = this.shadowRoot, context = this) {
      rootNode.querySelectorAll(selector.trim() + '[lw-if]').forEach(ifNode => {
         if (!ifNode['lw-if']) {
            const expression = ifNode.getAttribute('lw-if');
            const ast = parser.parse(expression);
            ifNode['lw-if'] = ast;
         }

         parser.evalAsync(ifNode['lw-if'], context).then(value => {
            if (!value) {
               const oldDisplayValue = getComputedStyle(ifNode).getPropertyValue('display') || '';
               if (oldDisplayValue !== 'none') {
                  ifNode['lw-if-display'] = oldDisplayValue;
               }
               ifNode.style.display = 'none';
            } else {
               const oldDisplayValue = ifNode['lw-if-display'] || '';
               ifNode.style.display = oldDisplayValue;
            }
         });
      });
   }

   updateClass(selector = '', rootNode = this.shadowRoot, context = this) {
      rootNode.querySelectorAll(selector.trim() + '[lw-class]').forEach(classNode => {
         for (let attr of classNode.attributes) {
            const classAttrName = attr.name;
            if (classAttrName.startsWith(classPrefix)) {
               const ast = classNode[classAttrName];
               const classValue = parser.eval(ast, context);
               if (!classValue) {
                  classNode.classList.remove(classAttrName.substring(classPrefix.length));
               } else {
                  classNode.classList.add(classAttrName.substring(classPrefix.length));
               }
            }
         }
      });
   }

   updateBind(selector = '', rootNode = this.shadowRoot, context = this) {
      rootNode.querySelectorAll(selector.trim() + '[lw-bind]').forEach(bindNode => {
         for (let attr of bindNode.attributes) {
            const bindAttrName = attr.name;
            if (bindAttrName.startsWith(bindPrefix)) {
               const ast = bindNode[bindAttrName];
               const bindValue = parser.eval(ast, context);
               if (!bindValue) {
                  bindNode.removeAttribute(bindAttrName.substring(bindPrefix.length));
               } else {
                  bindNode.setAttribute(bindAttrName.substring(bindPrefix.length), bindValue);
               }
            }
         }
      });
   }
}