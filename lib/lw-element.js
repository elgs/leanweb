import * as parser from './parser.js';

export default class LWElement extends HTMLElement {

   constructor(templateId) {
      super();

      const templateNode = document.querySelector('#' + templateId).content.cloneNode(true);
      // attach to shadow dom
      this.attachShadow({ mode: 'open' }).appendChild(templateNode);
      // attach to normal dom
      // this.appendChild(templateNode);

      setTimeout(() => {
         this.update();
      });
   }

   update() {
      this.shadowRoot.querySelectorAll('[lw-eval]').forEach(evalNode => {
         const expression = evalNode.innerText;
         evalNode.setAttribute('lw-eval', expression);
         const ast = parser.parse(expression);
         const value = parser.eval(ast, this);
         evalNode.innerText = value;
      });
   }
}