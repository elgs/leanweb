customElements.define('${component}',
  class extends HTMLElement {
    constructor() {
      super();

      const templateNode = document.querySelector('#${component}').content.cloneNode(true);
      // attach to shadow dom
      this.attachShadow({ mode: 'open' }).appendChild(templateNode);
      // attach to normal dom
      // this.appendChild(templateNode);
    }

    // connectedCallback() {
    //   console.log(this.isConnected);
    //   console.log('Element added to page.');
    // }

    // disconnectedCallback() {
    //   console.log('Element removed from page.');
    // }

    // adoptedCallback() {
    //   console.log('Element moved to new page.');
    // }

    // static get observedAttributes() {
    //   return [];
    // }

    // attributeChangedCallback(name, oldValue, newValue) {
    //   console.log(name, oldValue, newValue);
    // }
  }
);
