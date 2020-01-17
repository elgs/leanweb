import * as parser from './parser.js';

function hasMethod(obj, name) {
   const desc = Object.getOwnPropertyDescriptor(obj, name);
   return !!desc && typeof desc.value === 'function';
}

export default class LWElement extends HTMLElement {

   constructor(templateId) {
      super();

      this._bindMethods();

      const templateNode = document.querySelector('#' + templateId).content.cloneNode(true);
      this.attachShadow({ mode: 'open' }).appendChild(templateNode);

      setTimeout(() => {
         this.update();

         const treeWalker = document.createTreeWalker(this.shadowRoot, NodeFilter.SHOW_ELEMENT);
         const eventPrefix = 'lw-event-';
         const classPrefix = 'lw-class-';
         while (treeWalker.nextNode()) {
            const node = treeWalker.currentNode;
            for (let attr of node.attributes) {
               if (attr.name.startsWith(eventPrefix)) {
                  this._bindLWEvent(node, attr.name.substring(eventPrefix.length), attr.value);
               } else if (attr.name.startsWith(classPrefix)) {

               }
            }
         }
      });
   }

   _bindMethods() {
      const methodNames = [];
      const proto = Object.getPrototypeOf(this);
      const names = Object.getOwnPropertyNames(proto);
      methodNames.push(...names.filter(name => hasMethod(proto, name)));
      methodNames.push(...Object.getOwnPropertyNames(this).filter(name => hasMethod(this, name)));
      methodNames.filter(name => name !== 'constructor').forEach(name => {
         this[name] = this[name].bind(this);
      });
   }

   _bindLWEvent(node, eventName, eventHandlerExpression) {
      const ast = parser.parse(eventHandlerExpression);
      node['lw-event-' + eventName] = ast;

      node.addEventListener(eventName, function (event) {
         this['$event'] = event;
         const ret = parser.eval(node['lw-event-' + eventName], this);
         delete this['$event'];
         return ret;
      }.bind(this));
   }

   _bindClass(node, className, classHandlerExpression) {
   }

   update(selector = '') {
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
}