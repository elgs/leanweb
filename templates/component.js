import LWElement from './../../${pathLevels}lib/lw-element.js';
import ast from './ast.js';

customElements.define('${projectName}-${component}',
   class extends LWElement {  // LWElement extends HTMLElement
      constructor() {
         super(ast);
      }

      // derived from LWElement
      // domReady() {
      //    console.log('Dom is ready');
      // }

      // inputReady() {
      //    console.log('input is ready');
      // }

      // derived from HTMLElement
      // connectedCallback() {
      //    console.log(this.isConnected);
      //    console.log('Element added to page.');
      // }

      // disconnectedCallback() {
      //    console.log('Element removed from page.');
      // }

      // adoptedCallback() {
      //    console.log('Element moved to new page.');
      // }

      // static get observedAttributes() {
      //    return [];
      // }

      // attributeChangedCallback(name, oldValue, newValue) {
      //    console.log(name, oldValue, newValue);
      // }
   }
);
