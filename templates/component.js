customElements.define('${component}',
  class extends HTMLElement {
    constructor() {
      super();

      const template = document.querySelector('#${component}').content;
      // attach to shadow dom
      this.attachShadow({ mode: 'open' }).appendChild(template.cloneNode(true));
      // attach to normal dom
      // this.appendChild(template.cloneNode(true));
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
