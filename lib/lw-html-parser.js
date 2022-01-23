import * as parse5 from 'parse5';
import * as parser from '@babel/parser';

let astKey = 0;

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

const getAST = expr => {
   const parsedProgram = parser.parse(expr).program;
   if (parsedProgram.directives.length > 0 && parsedProgram.body.length === 0) {
      return parsedProgram.directives;
   }
   return parsedProgram.body;
};

const walkNode = (node, interpolation) => {
   node.attrs && node.attrs.forEach(attr => {
      const { startLine, endLine } = node.sourceCodeLocation;
      const loc = { startLine, endLine };
      const key = `${++astKey}`;
      if (attr.name === 'lw-false' || attr.name === 'lw-context' || attr.name === 'lw-for-parent') {
         // this should never happen
         console.assert(false, attr.name);
         // no op
      } else if (attr.name === 'lw') {
         node.attrs.push({ name: 'lw-elem', value: '' });
         let expr = '';
         if (node.childNodes) {
            const exprNode = node.childNodes.find(childNode => childNode.nodeName === '#text');
            expr = exprNode ? exprNode.value : '';
         }
         const ast = getAST(expr);
         removeASTLocation(ast);
         interpolation[key] = { ast, loc };
         node.childNodes.length = 0;
         attr.value = key;
      } else if (attr.name === ('lw-for')) {
         node.attrs.push({ name: 'lw-elem', value: '' });
         const matched = attr.value.match(/(.+)\s+in\s+(.+)/);
         const itemIndex = matched[1].split(',');
         const itemExpr = itemIndex[0].trim();
         let indexExpr;
         if (itemIndex.length > 1) {
            indexExpr = itemIndex[1].trim();
         }
         const itemsExpr = matched[2];
         const astItems = getAST(itemsExpr);
         removeASTLocation(astItems);
         interpolation[key] = { astItems, loc, itemExpr, indexExpr, itemsExpr };
         attr.value = key;
      } else if (attr.name === ('lw-model')) {
         node.attrs.push({ name: 'lw-elem-bind', value: '' });
         node.attrs.push({ name: 'lw-elem', value: '' });
         const ast = getAST(attr.value);
         removeASTLocation(ast);
         interpolation[key] = { ast, loc };
         attr.value = key;
      } else if (attr.name.startsWith('lw-on:') || attr.name.startsWith('lw-class:') || attr.name.startsWith('lw-bind:') || attr.name.startsWith('lw-input:')) {
         if (attr.name.startsWith('lw-on:') || attr.name.startsWith('lw-input:')) {
            node.attrs.push({ name: 'lw-elem-bind', value: '' });
         }

         node.attrs.push({ name: 'lw-elem', value: '' });
         const lw = attr.name.split(':');
         const lwType = lw[0];
         const lwValue = lw[1];

         const ast = getAST(attr.value);
         removeASTLocation(ast);
         interpolation[key] = { ast, loc, lwType, lwValue };

         attr.value = key;
      } else if (attr.name.startsWith('lw-')) {
         node.attrs.push({ name: 'lw-elem', value: '' });
         const ast = getAST(attr.value);
         removeASTLocation(ast);
         interpolation[key] = { ast, loc };
         attr.value = key;
      }
   });
   node.childNodes && node.childNodes.forEach(childNode => walkNode(childNode, interpolation));
};

export const parse = html => {
   const ast = {};
   const doc = parse5.parseFragment(html, { sourceCodeLocationInfo: true });
   walkNode(doc, ast);
   html = parse5.serialize(doc);
   ast.html = html;
   return ast;
};


// const html = `<div>
// <span class="x" lw>/a/;(1+(2+3))</span>
// <span lw-on:click="a">dddd</span>
// <span lw></span>
// </div>`;

// const result = parse(html);
// console.log(JSON.stringify(result, null, 2));
