customElements.define('${component}',
  class extends HTMLElement {
    constructor() {
      super();
      const template = document.querySelector('${component}').content;
      this.attachShadow({ mode: 'open' }).appendChild(template.cloneNode(true));
      // this.appendChild(template.cloneNode(true));
    }

    static get observedAttributes() {
      return [];
    }

    attributeChangedCallback(name, oldValue, newValue) {
      // console.log(name, oldValue, newValue);
    }
  }
);
