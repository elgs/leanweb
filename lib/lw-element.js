import * as parser from './parser.js';

function hasMethod(obj, name) {
   const desc = Object.getOwnPropertyDescriptor(obj, name);
   return !!desc && typeof desc.value === 'function';
}

const eventPrefix = 'lw-event-';
const classPrefix = 'lw-class-';

export default class LWElement extends HTMLElement {

   constructor(templateId) {
      super();

      this._bindMethods();

      const templateNode = document.querySelector('#' + templateId).content.cloneNode(true);
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
               this._bindLWEvent(node, attr.name, attr.value);
            } else if (attr.name.startsWith(classPrefix)) {
               this._bindClass(node, attr.name, attr.value);
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
      this.shadowRoot.querySelectorAll('input[lw-model]').forEach(modelNode => {
         const expression = modelNode.getAttribute('lw-model');
         modelNode.addEventListener('keyup', (event => {

            // how about nested object?
            if (event.target.type === 'number') {
               this[expression] = event.target.value * 1;
            } else {
               this[expression] = event.target.value;
            }
            this.update();
         }).bind(this));
      });
   }

   _bindLWEvent(node, eventAttrName, eventHandlerExpression) {
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
      if (!node.classList.contains('lw-class')) {
         node.classList.add('lw-class');
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

   // for
   // bind

   update(selector = '') {
      this.updateEval(selector);
      this.updateIf(selector);
      this.updateClass(selector);
      this.updateModel(selector);
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
      this.shadowRoot.querySelectorAll(selector.trim() + '.lw-class').forEach(node => {
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
}