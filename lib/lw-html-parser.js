const parse5 = require('parse5');
const parser = require('@babel/parser');
const strgen = require('./jsstrgen.js');

const walkNode = node => {
   node.attrs && node.attrs.forEach(attr => {
      if (attr.name === 'lw') {
         if (node.childNodes && node.childNodes.length) {
            const exprNode = node.childNodes.find(childNode => childNode.nodeName === '#text');
            const ast = parser.parse(exprNode.value).program.body;
            const astKey = strgen.randGen(8);
            attr.value = astKey;
            node.childNodes.length = 0;
         }
      }
   });
   node.childNodes && node.childNodes.forEach(childNode => {
      walkNode(childNode);
   });
};

const html = `<div>
<span class="x" lw>asdf</span>
<span lw-class="a">dddd</span>
</div>`;

const doc = parse5.parseFragment(html);
// console.log(doc.childNodes[0].childNodes);
walkNode(doc);
const output = parse5.serialize(doc);

console.log(output);