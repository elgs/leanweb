import * as parser from './parser.js';

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

   _bind() {
      const treeWalker = document.createTreeWalker(this.shadowRoot, NodeFilter.SHOW_ELEMENT);
      while (treeWalker.nextNode()) {
         const node = treeWalker.currentNode;
         for (let attr of node.attributes) {
            if (attr.name.startsWith(eventPrefix)) {
               this._bindEvent(node, attr.name, attr.value);
            } else if (attr.name.startsWith(classPrefix)) {
               this._bindClass(node, attr.name, attr.value);
            } else if (attr.name.startsWith(bindPrefix)) {
               this._bindBind(node, attr.name, attr.value);
            }
         }
      }
      this._bindModels();
   }

   _bindMethods() {
      const methodNames = [];
      const proto = Object.getPrototypeOf(this);
      methodNames.push(...Object.getOwnPropertyNames(proto).filter(name => hasMethod(proto, name)));
      methodNames.push(...Object.getOwnPropertyNames(this).filter(name => hasMethod(this, name)));
      methodNames.filter(name => name !== 'constructor').forEach(name => {
         this[name] = this[name].bind(this);
      });
   }

   _bindModels() {
      const modelNodes = this.shadowRoot.querySelectorAll('input[lw-model]');
      for (const modelNode of modelNodes) {
         if (modelNode['mode_event_bound']) {
            return;
         }
         const expression = modelNode.getAttribute('lw-model');

         const indexOfLastDot = expression.lastIndexOf('.');
         if (indexOfLastDot > -1) {
            const objectExpression = expression.substring(0, indexOfLastDot);
            const ast = parser.parse(objectExpression);
            modelNode['lw-model-object'] = ast;
         }

         modelNode.addEventListener('keyup', (event => {
            modelNode['mode_event_bound'] = true;
            const indexOfLastDot = expression.lastIndexOf('.');
            if (indexOfLastDot > -1) {
               const valueExpression = expression.substring(indexOfLastDot + 1);
               const object = parser.eval(modelNode['lw-model-object'], this);
               if (event.target.type === 'number') {
                  object[valueExpression] = event.target.value * 1;
               } else {
                  object[valueExpression] = event.target.value;
               }
            } else {
               if (event.target.type === 'number') {
                  this[expression] = event.target.value * 1;
               } else {
                  this[expression] = event.target.value;
               }
            }
            this.update();
         }).bind(this));
      }
   }

   _bindEvent(node, eventAttrName, eventHandlerExpression) {
      if (node[eventAttrName]) {
         return;
      }
      const ast = parser.parse(eventHandlerExpression);
      node[eventAttrName] = ast;

      node.addEventListener(eventAttrName.substring(eventPrefix.length), (event => {
         this['$event'] = event;
         const ret = parser.eval(node[eventAttrName], this);
         delete this['$event'];
         return ret;
      }).bind(this));
   }

   _bindClass(node, classAttrName, classExpression) {
      if (node[classAttrName]) {
         return;
      }
      // put a hook
      if (!node.hasAttribute('lw-class')) {
         node.setAttribute('lw-class', '');
      }
      const ast = parser.parse(classExpression);
      node[classAttrName] = ast;
      const classValue = parser.eval(ast, this);
      if (!classValue) {
         node.classList.remove(classAttrName.substring(classPrefix.length));
      } else {
         node.classList.add(classAttrName.substring(classPrefix.length));
      }
   }

   _bindBind(node, bindAttrName, bindExpression) {
      if (node[bindAttrName]) {
         return;
      }
      // put a hook
      if (!node.hasAttribute('lw-bind')) {
         node.setAttribute('lw-bind', '');
      }
      const ast = parser.parse(bindExpression);
      node[bindAttrName] = ast;
      const bindValue = parser.eval(ast, this);
      if (!bindValue) {
         node.removeAttribute(bindAttrName.substring(bindPrefix.length));
      } else {
         node.setAttribute(bindAttrName.substring(bindPrefix.length), bindValue);
      }
   }

   // for

   update(selector = '') {
      this.updateEval(selector);
      this.updateIf(selector);
      this.updateClass(selector);
      this.updateModel(selector);
      this.updateBind(selector);
   }

   updateModel(selector = '') {
      this.shadowRoot.querySelectorAll(selector.trim() + 'input[lw-model]').forEach(modelNode => {
         if (!modelNode['lw-model']) {
            const expression = modelNode.getAttribute('lw-model');
            const ast = parser.parse(expression);
            modelNode['lw-model'] = ast;
         }

         parser.evalAsync(modelNode['lw-model'], this).then(value => {
            modelNode.value = value;
         });
      });
   }

   updateEval(selector = '') {
      this.shadowRoot.querySelectorAll(selector.trim() + '[lw]').forEach(evalNode => {
         if (!evalNode['lw-eval']) {
            const expression = evalNode.innerText;
            const ast = parser.parse(expression);
            evalNode['lw-eval'] = ast;
         }

         parser.evalAsync(evalNode['lw-eval'], this).then(value => {
            evalNode.innerText = value;
         });
      });
   }

   updateIf(selector = '') {
      this.shadowRoot.querySelectorAll(selector.trim() + '[lw-if]').forEach(ifNode => {
         if (!ifNode['lw-if']) {
            const expression = ifNode.getAttribute('lw-if');
            const ast = parser.parse(expression);
            ifNode['lw-if'] = ast;
         }

         parser.evalAsync(ifNode['lw-if'], this).then(value => {
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

   updateClass(selector = '') {
      this.shadowRoot.querySelectorAll(selector.trim() + '[lw-class]').forEach(node => {
         for (let attr of node.attributes) {
            const classAttrName = attr.name;
            if (classAttrName.startsWith(classPrefix)) {
               const ast = node[classAttrName];
               const classValue = parser.eval(ast, this);
               if (!classValue) {
                  node.classList.remove(classAttrName.substring(classPrefix.length));
               } else {
                  node.classList.add(classAttrName.substring(classPrefix.length));
               }
            }
         }
      });
   }

   updateBind(selector = '') {
      this.shadowRoot.querySelectorAll(selector.trim() + '[lw-bind]').forEach(node => {
         for (let attr of node.attributes) {
            const bindAttrName = attr.name;
            if (bindAttrName.startsWith(bindPrefix)) {
               const ast = node[bindAttrName];
               const bindValue = parser.eval(ast, this);
               if (!bindValue) {
                  node.removeAttribute(bindAttrName.substring(bindPrefix.length));
               } else {
                  node.setAttribute(bindAttrName.substring(bindPrefix.length), bindValue);
               }
            }
         }
      });
   }
}