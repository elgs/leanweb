class LWElement extends HTMLElement {

  constructor(templateId) {
    super();

    const templateNode = document.querySelector('#' + templateId).content.cloneNode(true);
    // attach to shadow dom
    // this.attachShadow({ mode: 'open' }).appendChild(templateNode);
    // attach to normal dom
    this.appendChild(templateNode);

    const treeWalker = document.createTreeWalker(this, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (treeWalker.nextNode()) {
      if (treeWalker.currentNode.nodeType === Node.ELEMENT_NODE) {
        if (treeWalker.currentNode.attributes.length > 0) {
          // console.log(treeWalker.currentNode);
        }
      } else if (treeWalker.currentNode.nodeType === Node.TEXT_NODE) {
        if (treeWalker.currentNode.data.trim().length > 0) {
          this.collectTextNodes(treeWalker.currentNode);
        }
      }
    }
    // console.log(this.textNodeKeyGroups);
  }

  connectedCallback() {
    this.update();
  }

  collectTextNodes(node) {
    const myRegexp = /(?:\{\{)(.*?)(?:\}\})/g;
    let match = myRegexp.exec(node.data);
    while (match !== null) {
      const expressions = match[1].trim().split(/\,\s#/);
      if (expressions.length === 0) {
        continue;
      }

      let key = '#';
      if (expressions.length > 1) {
        key = expressions[1];
      }
      this.textNodeKeyGroups[key] = this.textNodeKeyGroups[key] || [];
      if (this.textNodeKeyGroups[key].filter(nodeData => nodeData.node === node && nodeData.expression === expressions[0]).length === 0) {
        node.originalTemplate = node.data;
        this.textNodeKeyGroups[key].push({
          node,
          match: match[0], // {{ x }}
          expression: expressions[0] // x
        });
      }
      node.updateExpressions = node.updateExpressions || [];
      if (!node.updateExpressions.includes(expressions[0])) {
        node.updateExpressions.push(expressions[0]);
      }
      match = myRegexp.exec(node.data);
    }
  };

  // key -> nodes -> expression
  update(...keys) {
    const filteredKeys = Object.keys(this.textNodeKeyGroups).filter(key => keys.length === 0 || keys.includes(key));

    for (const key of filteredKeys) {
      const nodeDataArray = this.textNodeKeyGroups[key];
      for (const nodeData of nodeDataArray) {
        let { node, match, expression } = nodeData;

        let originalTemplate = node.open ? node.data : node.originalTemplate;
        node.open = true;
        for (const updateExpression of node.updateExpressions.filter(updateExpression => updateExpression === expression)) {
          const value = eval(updateExpression);
          // console.log('before:', originalTemplate);
          // console.log('match:', match, 'value:', value, 'updateExpression:', updateExpression);
          const escapedMatch = match.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          originalTemplate = originalTemplate.replace(new RegExp(escapedMatch, 'g'), value);
          node.data = originalTemplate;
          // console.log('after', originalTemplate);
          // console.log('******');
        }
      }
    }

    for (const key of filteredKeys) {
      const nodeDataArray = this.textNodeKeyGroups[key];
      for (const nodeData of nodeDataArray) {
        nodeData.node.open = false;
      }
    }
  }

  textNodeKeyGroups = {};
}

customElements.define('test-root',
  class extends LWElement {
    constructor() {
      super('test-root');
    }

    a = 'a';
    x = 'x';
    y = 'y';
    z = 'z';


    connectedCallback() {
      super.connectedCallback();
      // console.log(this.isConnected);
      // console.log('Element added to page.');

      this.y = 'yy';
      this.x = 'xx';
      this.update('#', 'xid');
    }

    // disconnectedCallback() {
    //   super.disconnectedCallback();
    //   console.log('Element removed from page.');
    // }

    // adoptedCallback() {
    //   super.adoptedCallback();
    //   console.log('Element moved to new page.');
    // }

    // static get observedAttributes() {
    //   return [];
    // }

    // attributeChangedCallback(name, oldValue, newValue) {
    //   super.attributes(name, oldValue, newValue);
    //   console.log(name, oldValue, newValue);
    // }
  }
);
