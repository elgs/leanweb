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

   _bindClass(node, classAttrName, classHandlerExpression) {
      if (!node.classList.contains('lw-class')) {
         node.classList.add('lw-class');
      }
      const ast = parser.parse(classHandlerExpression);
      node[classAttrName] = ast;
      const classValue = parser.eval(ast, this);
      if (!classValue) {
         node.classList.remove(classAttrName.substring(classPrefix.length));
      } else {
         node.classList.add(classAttrName.substring(classPrefix.length));
      }
   }

   // if
   // for

   update(selector = '') {
      this.updateEval(selector);
      this.updateClass(selector);
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