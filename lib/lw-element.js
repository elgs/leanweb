import * as parser from './parser.js';

export default class LWElement extends HTMLElement {

   constructor(templateId) {
      super();

      const templateNode = document.querySelector('#' + templateId).content.cloneNode(true);
      this.attachShadow({ mode: 'open' }).appendChild(templateNode);

      setTimeout(() => {
         this.update();
      });
   }

   update(selector = '') {
      this.shadowRoot.querySelectorAll(selector.trim() + '[lw-eval]').forEach(evalNode => {
         if (!evalNode.ast) {
            const expression = evalNode.innerText;
            const ast = parser.parse(expression);
            evalNode.ast = ast;
         }

         parser.evalAsync(evalNode.ast, this).then(value => {
            evalNode.innerText = value;
         });
      });
   }
}