const parse5 = require('parse5');
const parser = require('@babel/parser');
const strgen = require('./jsstrgen.js');

const walkNode = (node, result) => {
   node.attrs && node.attrs.forEach(attr => {
      if (attr.name === 'lw') {
         let expr = '';
         if (node.childNodes) {
            const exprNode = node.childNodes.find(childNode => childNode.nodeName === '#text');
            expr = exprNode ? exprNode.value : '';
         }
         const ast = parser.parse(expr).program.body;
         const astKey = strgen.randGen(8);
         result[astKey] = ast;
         attr.value = astKey;
         node.childNodes.length = 0;
      } else if (attr.name.startsWith('lw-') && attr.name !== ('lw-for')) {
         const ast = parser.parse(attr.value).program.body;
         const astKey = strgen.randGen(8);
         result[astKey] = ast;
         attr.value = astKey;
      }
   });
   node.childNodes && node.childNodes.forEach(childNode => walkNode(childNode, result));
};

const parse = html => {
   const ast = {};
   const doc = parse5.parseFragment(html);
   walkNode(doc, ast);
   html = parse5.serialize(doc);
   return { html, ast };
};

module.exports = { parse };


// const html = `<div>
// <span class="x" lw>/a/;(1+(2+3))</span>
// <span lw-on:click="a">dddd</span>
// <span lw></span>
// </div>`;

// const result = parse(html);
// console.log(JSON.stringify(result, null, 2));
