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

const assignmentOperations = {
  '=': (c, a, b) => { c[a] = b; },
  '+=': (c, a, b) => { c[a] += b; },
  '-=': (c, a, b) => { c[a] -= b; },
  '*=': (c, a, b) => { c[a] *= b; },
  '/=': (c, a, b) => { c[a] /= b; },
  '%=': (c, a, b) => { c[a] %= b; },
  '**=': (c, a, b) => { c[a] **= b; },
  '&&=': (c, a, b) => { c[a] &&= b; },
  '??=': (c, a, b) => { c[a] ??= b; },
  '||=': (c, a, b) => { c[a] ||= b; },
  '>>=': (c, a, b) => { c[a] >>= b; },
  '>>>=': (c, a, b) => { c[a] >>>= b; },
  '<<=': (c, a, b) => { c[a] <<= b; },
  '&=': (c, a, b) => { c[a] &= b; },
  '|=': (c, a, b) => { c[a] |= b; },
  '^=': (c, a, b) => { c[a] ^= b; },
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
    return (c, a) => prefix ? ++c[a] : c[a]++;
  } else if (operator === '--') {
    return (c, a) => prefix ? --c[a] : c[a]--;
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
  const thisContext = getThisContext(context);
  return callee.apply(thisContext, args);
};

const nodeHandlers = {
  'NumericLiteral': (node, context) => node.value,
  'StringLiteral': (node, context) => node.value,
  'BooleanLiteral': (node, context) => node.value,
  'NullLiteral': (node, context) => null,

  'RegExpLiteral': (node, context) => new RegExp(node.pattern, node.flags),

  'ExpressionStatement': (node, context) => evalNode(node.expression, context),
  'BinaryExpression': (node, context) => binaryOperations[node.operator](evalNode(node.left, context), evalNode(node.right, context)),
  'AssignmentExpression': (node, context) => {
    const immediateCtx = immediateContext(node.left, context);
    assignmentOperations[node.operator](immediateCtx, node.left.name, evalNode(node.right, context));
  },
  'LogicalExpression': (node, context) => logicalOperators[node.operator](evalNode(node.left, context), evalNode(node.right, context)),
  'UnaryExpression': (node, context) => unaryOperators[node.operator](evalNode(node.argument, context)),
  'UpdateExpression': (node, context) => {
    const immediateCtx = immediateContext(node.argument, context);
    updateOperators(node.operator, node.prefix)(immediateCtx, node.argument.name, evalNode(node.argument, context));
  },
  'ConditionalExpression': (node, context) => {
    const test = evalNode(node.test, context);
    const consequent = evalNode(node.consequent, context);
    const alternate = evalNode(node.alternate, context);
    return test ? consequent : alternate;
  },
  'MemberExpression': (node, context) => {
    const object = evalNode(node.object, context);
    const member = node.computed ? object[evalNode(node.property, context)] : object[node.property.name];
    if (typeof member === 'function') {
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
    if (typeof member === 'function') {
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
    if (Array.isArray(context)) {
      const hitContext = context.find(contextObj => node.name in contextObj);
      return hitContext ? hitContext[node.name] : undefined;
    } else if (typeof context === 'object') {
      return context[node.name];
    }
  },
  'ThisExpression': (node, context) => {
    return getThisContext(context);
  },

  'CallExpression': (node, context) => callFunction(node, context),
  'OptionalCallExpression': (node, context) => callFunction(node, context),
  'NewExpression': (node, context) => callFunction(node, context),

  'Directive': (node, context) => evalNode(node.value, context),
  'DirectiveLiteral': (node, context) => node.value,
};

const getThisContext = (context) => {
  if (Array.isArray(context)) {
    const hitContext = context.find(contextObj => 'this' in contextObj);
    return hitContext ? hitContext['this'] : undefined;
  } else if (typeof context === 'object') {
    return context['this'];
  }
};

const immediateContext = (node, context) => {
  if (Array.isArray(context)) {
    if (context.length === 0) {
      return null;
    }
    const qualifiedContext = context.filter(contextObj => !(('$event' in contextObj && '$node' in contextObj) || 'this' in contextObj));
    return context.find(contextObj => node.name in contextObj) ?? qualifiedContext[0];
  } else if (typeof context === 'object') {
    return context;
  }
}

const evalNode = (node, context) => nodeHandlers[node.type](node, context);

const evaluate = (ast, context = {}, loc = {}) => {
  try {
    return ast.map(astNode => evalNode(astNode, context));
  } catch (e) {
    throw { error: e.message, location: loc, ast, context };
  }
};

export { evaluate };

//   module.exports = { evaluate };
// const parser = require('@babel/parser');
// const ast = parser.parse("name?.toUpperCase()").program.body;
// console.log(ast);
// const result = evaluate(JSON.parse(JSON.stringify(ast)), { name: 'hello' });
// console.log(result);