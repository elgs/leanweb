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
   //  '|>': (a, b) => a |> b,
};

const logicalOperators = {
   '||': (a, b) => a || b,
   '&&': (a, b) => a && b,
   '??': (a, b) => a ?? b,
};

const unaryOperators = {
   '-': a => -a,
   '+': a => +a,
   '!': a => !a,
   '~': a => ~a,
   'typeof': a => typeof a,
   'void': a => void a,
   // 'delete': a => delete a,
   'throw': a => { throw a; },
};

const updateOperators = (operator, prefix) => {
   if (operator === '++') {
      return prefix ? a => ++a : a => a++;
   } else if (operator === '--') {
      return prefix ? a => --a : a => a--;
   }
};

const callFunction = (node, context) => {
   const callee = evalNode(node.callee, context);
   if (node.callee.type === 'OptionalMemberExpression' && (callee === void 0 || callee === null)) {
      return void 0;
   }
   const args = [];
   node.arguments.map(argument => {
      if (argument.type === 'SpreadElement') {
         args.push(...evalNode(argument, context));
      } else {
         args.push(evalNode(argument, context));
      }
   });
   return callee(...args);
};

const nodeHandlers = {
   'NumericLiteral': (node, context) => node.value,
   'StringLiteral': (node, context) => node.value,
   'BooleanLiteral': (node, context) => node.value,
   'NullLiteral': (node, context) => null,

   'RegExpLiteral': (node, context) => new RegExp(node.pattern, node.flags),

   'ExpressionStatement': (node, context) => evalNode(node.expression, context),
   'BinaryExpression': (node, context) => binaryOperations[node.operator](evalNode(node.left, context), evalNode(node.right, context)),
   'LogicalExpression': (node, context) => logicalOperators[node.operator](evalNode(node.left, context), evalNode(node.right, context)),
   'UnaryExpression': (node, context) => unaryOperators[node.operator](evalNode(node.argument, context)),
   'UpdateExpression': (node, context) => updateOperators(node.operator, node.prefix)(evalNode(node.argument, context)),
   'ConditionalExpression': (node, context) => {
      const test = evalNode(node.test, context);
      const consequent = evalNode(node.consequent, context);
      const alternate = evalNode(node.alternate, context);
      return test ? consequent : alternate;
   },
   'MemberExpression': (node, context) => {
      const object = evalNode(node.object, context);
      const member = node.computed ? object[evalNode(node.property, context)] : object[node.property.name];
      if (node.object.type === 'RegExpLiteral' && typeof member === 'function') {
         return member.bind(object);
      }
      return member;
   },
   'OptionalMemberExpression': (node, context) => {
      const object = evalNode(node.object, context);
      if (object === void 0 || object === null) {
         return void 0;
      }
      const member = node.computed ? (object[evalNode(node.property, context)]) : (object[node.property.name]);
      if (node.object.type === 'RegExpLiteral' && typeof member === 'function') {
         return member.bind(object);
      }
      return member;
   },

   'ArrayExpression': (node, context) => {
      const arr = [];
      node.elements.map(elem => {
         if (elem.type === 'SpreadElement') {
            arr.push(...evalNode(elem, context));
         } else {
            arr.push(evalNode(elem, context));
         }
      });
      return arr;
   },
   'ObjectExpression': (node, context) => node.properties.reduce((acc, prop) => ({ ...acc, ...evalNode(prop, context) }), {}),
   'ObjectProperty': (node, context) => ({ [evalNode(node.key, context)]: evalNode(node.value, context) }),
   'SpreadElement': (node, context) => evalNode(node.argument, context),

   'Identifier': (node, context) => {
      if (context._lw_complex_context) {
         for (const subContextArray of context.sub) {
            for (const subContext of subContextArray) {
               if (subContext.expr === node.name) {
                  return subContext.value;
               }
            }
         }
         return context.main[node.name];
      } else {
         return context[node.name];
      }
   },

   'CallExpression': (node, context) => callFunction(node, context),
   'OptionalCallExpression': (node, context) => callFunction(node, context),
   'NewExpression': (node, context) => callFunction(node, context),
};

const evalNode = (node, context) => nodeHandlers[node.type](node, context);

export const evaluate = (ast, context = {}, loc = {}) => {
   try {
      return ast.map(astNode => evalNode(astNode, context));
   } catch (e) {
      throw { error: e.message, location: loc };
   }
};

  // module.exports = { evaluate };
  // const parser = require('@babel/parser');
  // const ast = parser.parse("/\\d+/.test(1);123").program.body;
  // console.log(ast);
  // const result = evaluate(JSON.parse(JSON.stringify(ast)), { a: {} });
  // console.log(result);