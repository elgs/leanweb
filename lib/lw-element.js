import * as parser from './parser.js';

export default class LWElement extends HTMLElement {

   constructor(templateId) {
      super();

      const templateNode = document.querySelector('#' + templateId).content.cloneNode(true);
      this.attachShadow({ mode: 'open' }).appendChild(templateNode);

      setTimeout(() => {
         this.update();

         const treeWalker = document.createTreeWalker(this.shadowRoot, NodeFilter.SHOW_ELEMENT);
         const eventPrefix = 'lw-event-';
         while (treeWalker.nextNode()) {
            const node = treeWalker.currentNode;
            for (let attr of node.attributes) {
               if (attr.name.startsWith(eventPrefix)) {
                  this.bindLWEvent(node, attr.name.substring(eventPrefix.length), attr.value);
               }
            }
         }
      });
   }

   bindLWEvent(node, eventName, eventHandlerExpression) {
      const ast = parser.parse('this.' + eventHandlerExpression);
      node['lw-event-' + eventName] = ast;

      node.addEventListener(eventName, function (event) {
         this['$event'] = event;
         const ret = parser.eval(node['lw-event-' + eventName], this);
         delete this['$event'];
         return ret;
      }.bind(this));
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