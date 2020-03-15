const parse5 = require('parse5');
const parser = require('@babel/parser');
const strgen = require('./jsstrgen.js');

const removeASTLocation = ast => {
   if (Array.isArray(ast)) {
      ast.forEach(a => removeASTLocation(a));
   } else if (typeof ast === 'object') {
      delete ast['loc'];
      delete ast['start'];
      delete ast['end'];
      const values = Object.values(ast).filter(v => Array.isArray(v) || typeof v === 'object');
      removeASTLocation(values);
   }
};

const walkNode = (node, interpolation) => {
   node.attrs && node.attrs.forEach(attr => {
      const { startLine, endLine } = node.sourceCodeLocation;
      const loc = { startLine, endLine };
      const key = strgen.randGen(8);
      if (attr.name === 'lw') {
         let expr = '';
         if (node.childNodes) {
            const exprNode = node.childNodes.find(childNode => childNode.nodeName === '#text');
            expr = exprNode ? exprNode.value : '';
         }
         const ast = parser.parse(expr).program.body;
         removeASTLocation(ast);
         interpolation[key] = { ast, loc };
         node.childNodes.length = 0;
         attr.value = key;
      } else if (attr.name === ('lw-for')) {
         attr.value = key;
      } else if (attr.name === ('lw-model')) {
         const ast = parser.parse(attr.value).program.body;
         removeASTLocation(ast);
         interpolation[key] = { ast, loc };

         const indexOfLastDot = attr.value.lastIndexOf('.');
         if (indexOfLastDot > -1) {
            const objectExpression = attr.value.substring(0, indexOfLastDot);
            const valueExpression = attr.value.substring(indexOfLastDot + 1);
            const astObj = parser.parse(objectExpression).program.body;
            removeASTLocation(astObj);
            interpolation[key]['astObj'] = astObj;
            interpolation[key]['value'] = valueExpression;
         } else {
            interpolation[key]['value'] = attr.value;
         }
         attr.value = key;
      } else if (attr.name.startsWith('lw-')) {
         const ast = parser.parse(attr.value).program.body;
         removeASTLocation(ast);
         interpolation[key] = { ast, loc };

         ['lw-on', 'lw-class', 'lw-bind'].forEach(lw => {
            if (attr.name.startsWith(lw) && node.attrs.filter(a => a.name === lw).length === 0) {
               node.attrs.push({ name: lw, value: '' });
            }
         });
         attr.value = key;
      }
   });
   node.childNodes && node.childNodes.forEach(childNode => walkNode(childNode, interpolation));
};

const parse = html => {
   const interpolation = {};
   const doc = parse5.parseFragment(html, { sourceCodeLocationInfo: true });
   walkNode(doc, interpolation);
   html = parse5.serialize(doc);
   return { html, interpolation };
};

module.exports = { parse };


// const html = `<div>
// <span class="x" lw>/a/;(1+(2+3))</span>
// <span lw-on:click="a">dddd</span>
// <span lw></span>
// </div>`;

// const result = parse(html);
// console.log(JSON.stringify(result, null, 2));
