const binaryOperations = {
   '==': (a, b) => a == b,
   '!=': (a, b) => a != b,
   '===': (a, b) => a === b,
   '!==': (a, b) => a !== b,
   '<': (a, b) => a < b,
   '<=': (a, b) => a <= b,
   '>': (a, b) => a > b,
   '>=': (a, b) => a >= b,
   '<<': (a, b) => a << b,
   '>>': (a, b) => a >> b,
   '>>>': (a, b) => a >>> b,
   '+': (a, b) => a + b,
   '-': (a, b) => a - b,
   '*': (a, b) => a * b,
   '/': (a, b) => a / b,
   '%': (a, b) => a % b,
   '**': (a, b) => a ** b,
   '|': (a, b) => a | b,
   '^': (a, b) => a ^ b,
   '&': (a, b) => a & b,
   'in': (a, b) => a in b,
   'instanceof': (a, b) => a instanceof b,
   // '|>': (a, b) => a |> b,
};

const logicalOperators = {
   '||': (a, b) => a || b,
   '&&': (a, b) => a && b,
   // '??': (a, b) => a ?? b,
};

const unaryOperators = {
   '-': a => -a,
   '+': a => +a,
   '!': a => !a,
   '~': a => ~a,
   'typeof': a => typeof a,
   'void': a => void a,
   //  'delete': a => delete a,
   'throw': a => { throw a; },
};

const updateOperators = (operator, prefix) => {
   if (operator === '++') {
      return prefix ? a => ++a : a => a++;
   } else if (operator === '--') {
      return prefix ? a => --a : a => a--;
   }
};

const callFunction = (node, table) => {
   const callee = evalNode(node.callee, table);
   if (node.callee.type === 'OptionalMemberExpression' && (callee === undefined || callee === null)) {
      return undefined;
   }
   const args = [];
   node.arguments.map(argument => {
      if (argument.type === 'SpreadElement') {
         args.push(...evalNode(argument, table));
      } else {
         args.push(evalNode(argument, table));
      }
   });
   return callee(...args);
};

const nodeHandlers = {
   'NumericLiteral': (node, table) => node.value,
   'StringLiteral': (node, table) => node.value,
   'BooleanLiteral': (node, table) => node.value,
   'NullLiteral': (node, table) => null,

   'RegExpLiteral': (node, table) => new RegExp(node.pattern, node.flags),

   'ExpressionStatement': (node, table) => evalNode(node.expression, table),
   'BinaryExpression': (node, table) => binaryOperations[node.operator](evalNode(node.left, table), evalNode(node.right, table)),
   'LogicalExpression': (node, table) => logicalOperators[node.operator](evalNode(node.left, table), evalNode(node.right, table)),
   'UnaryExpression': (node, table) => unaryOperators[node.operator](evalNode(node.argument, table)),
   'UpdateExpression': (node, table) => updateOperators(node.operator, node.prefix)(evalNode(node.argument, table)),
   'ConditionalExpression': (node, table) => {
      const test = evalNode(node.test, table);
      const consequent = evalNode(node.consequent, table);
      const alternate = evalNode(node.alternate, table);
      return test ? consequent : alternate;
   },
   'MemberExpression': (node, table) => {
      const object = evalNode(node.object, table);
      const member = node.computed ? object[evalNode(node.property, table)] : object[node.property.name];
      if (node.object.type === 'RegExpLiteral' && typeof member === 'function') {
         return member.bind(object);
      }
      return member;
   },
   'OptionalMemberExpression': (node, table) => {
      const object = evalNode(node.object, table);
      if (object === undefined || object === null) {
         return undefined;
      }
      const member = node.computed ? (object[evalNode(node.property, table)]) : (object[node.property.name]);
      if (node.object.type === 'RegExpLiteral' && typeof member === 'function') {
         return member.bind(object);
      }
      return member;
   },

   'ArrayExpression': (node, table) => {
      const arr = [];
      node.elements.map(elem => {
         if (elem.type === 'SpreadElement') {
            arr.push(...evalNode(elem, table));
         } else {
            arr.push(evalNode(elem, table));
         }
      });
      return arr;
   },
   'ObjectExpression': (node, table) => node.properties.reduce((acc, prop) => ({ ...acc, ...evalNode(prop, table) }), {}),
   'ObjectProperty': (node, table) => ({ [evalNode(node.key, table)]: evalNode(node.value, table) }),
   'SpreadElement': (node, table) => evalNode(node.argument, table),

   'Identifier': (node, table) => table[node.name],

   'CallExpression': (node, table) => callFunction(node, table),
   'OptionalCallExpression': (node, table) => callFunction(node, table),
   'NewExpression': (node, table) => callFunction(node, table),
};

const evalNode = (node, table) => {
   // console.log(node.type);
   return nodeHandlers[node.type](node, table);
};

export const evaluate = (ast, table = {}) => {
   // console.log(ast);
   return ast.map(a => evalNode(a, table));
};

// module.exports = { evaluate };
// const parser = require('@babel/parser');
// const ast = parser.parse("/\\d+/.test(1);123").program.body;
// console.log(ast);
// const result = evaluate(JSON.parse(JSON.stringify(ast)), { a: {} });
// console.log(result);