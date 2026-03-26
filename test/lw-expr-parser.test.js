import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as parser from '@babel/parser';
import { evaluate } from '../templates/lib/lw-expr-parser.js';

const getAST = expr => {
  const parsedProgram = parser.parse(expr).program;
  if (parsedProgram.directives.length > 0 && parsedProgram.body.length === 0) {
    return parsedProgram.directives;
  }
  return parsedProgram.body;
};

const eval1 = (expr, context = {}) => evaluate(getAST(expr), context)[0];

describe('lw-expr-parser', () => {
  describe('literals', () => {
    it('should evaluate numeric literals', () => {
      assert.equal(eval1('42'), 42);
      assert.equal(eval1('3.14'), 3.14);
    });

    it('should evaluate string literals', () => {
      assert.equal(eval1('"hello"'), 'hello');
      assert.equal(eval1("'world'"), 'world');
    });

    it('should evaluate boolean literals', () => {
      assert.equal(eval1('true'), true);
      assert.equal(eval1('false'), false);
    });

    it('should evaluate null literal', () => {
      assert.equal(eval1('null'), null);
    });

    it('should evaluate regex literals', () => {
      const result = eval1('/abc/gi');
      assert.ok(result instanceof RegExp);
      assert.equal(result.source, 'abc');
      assert.equal(result.flags, 'gi');
    });
  });

  describe('binary operations', () => {
    it('should handle arithmetic', () => {
      assert.equal(eval1('2 + 3'), 5);
      assert.equal(eval1('10 - 4'), 6);
      assert.equal(eval1('3 * 4'), 12);
      assert.equal(eval1('15 / 3'), 5);
      assert.equal(eval1('10 % 3'), 1);
      assert.equal(eval1('2 ** 3'), 8);
    });

    it('should handle comparison operators', () => {
      assert.equal(eval1('1 == 1'), true);
      assert.equal(eval1('1 === 1'), true);
      assert.equal(eval1('1 != 2'), true);
      assert.equal(eval1('1 !== 2'), true);
      assert.equal(eval1('1 < 2'), true);
      assert.equal(eval1('2 <= 2'), true);
      assert.equal(eval1('3 > 2'), true);
      assert.equal(eval1('3 >= 3'), true);
    });

    it('should handle bitwise operators', () => {
      assert.equal(eval1('5 & 3'), 1);
      assert.equal(eval1('5 | 3'), 7);
      assert.equal(eval1('5 ^ 3'), 6);
      assert.equal(eval1('1 << 2'), 4);
      assert.equal(eval1('8 >> 2'), 2);
    });

    it('should handle string concatenation', () => {
      assert.equal(eval1('"hello" + " " + "world"'), 'hello world');
    });
  });

  describe('unary operations', () => {
    it('should handle negation', () => {
      assert.equal(eval1('-5'), -5);
    });

    it('should handle logical not', () => {
      assert.equal(eval1('!true'), false);
      assert.equal(eval1('!false'), true);
    });

    it('should handle typeof', () => {
      assert.equal(eval1('typeof 42'), 'number');
      assert.equal(eval1('typeof "hi"'), 'string');
    });

    it('should handle void', () => {
      assert.equal(eval1('void 0'), undefined);
    });

    it('should handle unary plus', () => {
      assert.equal(eval1('+"5"'), 5);
    });

    it('should handle bitwise NOT', () => {
      assert.equal(eval1('~0'), -1);
    });
  });

  describe('logical operations', () => {
    it('should handle && operator', () => {
      assert.equal(eval1('true && "yes"'), 'yes');
      assert.equal(eval1('false && "yes"'), false);
    });

    it('should handle || operator', () => {
      assert.equal(eval1('false || "fallback"'), 'fallback');
      assert.equal(eval1('"first" || "second"'), 'first');
    });

    it('should handle ?? operator', () => {
      assert.equal(eval1('null ?? "default"'), 'default');
      assert.equal(eval1('0 ?? "default"'), 0);
    });
  });

  describe('conditional (ternary) expression', () => {
    it('should return consequent when true', () => {
      assert.equal(eval1('true ? "yes" : "no"'), 'yes');
    });

    it('should return alternate when false', () => {
      assert.equal(eval1('false ? "yes" : "no"'), 'no');
    });
  });

  describe('identifiers and context', () => {
    it('should resolve identifiers from context object', () => {
      assert.equal(eval1('name', { name: 'Alice' }), 'Alice');
    });

    it('should resolve identifiers from context array', () => {
      assert.equal(eval1('x', [{ x: 10 }, { y: 20 }]), 10);
    });

    it('should return undefined for missing identifiers', () => {
      assert.equal(eval1('missing', {}), undefined);
    });

    it('should resolve from first matching context in array', () => {
      assert.equal(eval1('x', [{ x: 'first' }, { x: 'second' }]), 'first');
    });
  });

  describe('member expressions', () => {
    it('should access object properties', () => {
      assert.equal(eval1('obj.name', { obj: { name: 'test' } }), 'test');
    });

    it('should access computed properties', () => {
      assert.equal(eval1('obj["key"]', { obj: { key: 'value' } }), 'value');
    });

    it('should access nested properties', () => {
      assert.equal(eval1('a.b.c', { a: { b: { c: 42 } } }), 42);
    });

    it('should bind functions to their object', () => {
      const result = eval1('arr.join', { arr: [1, 2, 3] });
      assert.equal(typeof result, 'function');
    });
  });

  describe('optional member expressions', () => {
    it('should return undefined for null object', () => {
      assert.equal(eval1('obj?.name', { obj: null }), undefined);
    });

    it('should return undefined for undefined object', () => {
      assert.equal(eval1('obj?.name', {}), undefined);
    });

    it('should return value when object exists', () => {
      assert.equal(eval1('obj?.name', { obj: { name: 'test' } }), 'test');
    });
  });

  describe('function calls', () => {
    it('should call functions', () => {
      const ctx = { greet: name => `Hello ${name}` };
      assert.equal(eval1('greet("World")', ctx), 'Hello World');
    });

    it('should call method on object', () => {
      assert.equal(eval1('arr.join(",")', { arr: [1, 2, 3] }), '1,2,3');
    });

    it('should handle spread arguments', () => {
      const ctx = { sum: (...args) => args.reduce((a, b) => a + b, 0), nums: [1, 2, 3] };
      assert.equal(eval1('sum(...nums)', ctx), 6);
    });

    it('should call string methods', () => {
      assert.equal(eval1('name.toUpperCase()', { name: 'hello' }), 'HELLO');
    });
  });

  describe('assignment operations', () => {
    it('should handle simple assignment', () => {
      const ctx = { x: 0 };
      eval1('x = 5', ctx);
      assert.equal(ctx.x, 5);
    });

    it('should handle += assignment', () => {
      const ctx = { x: 10 };
      eval1('x += 5', ctx);
      assert.equal(ctx.x, 15);
    });

    it('should handle -= assignment', () => {
      const ctx = { x: 10 };
      eval1('x -= 3', ctx);
      assert.equal(ctx.x, 7);
    });

    it('should handle member expression assignment', () => {
      const ctx = { obj: { val: 0 } };
      eval1('obj.val = 42', ctx);
      assert.equal(ctx.obj.val, 42);
    });
  });

  describe('update operations', () => {
    it('should handle prefix increment', () => {
      const ctx = { x: 5 };
      const result = eval1('++x', ctx);
      assert.equal(result, 6);
      assert.equal(ctx.x, 6);
    });

    it('should handle postfix increment', () => {
      const ctx = { x: 5 };
      const result = eval1('x++', ctx);
      assert.equal(result, 5);
      assert.equal(ctx.x, 6);
    });

    it('should handle prefix decrement', () => {
      const ctx = { x: 5 };
      const result = eval1('--x', ctx);
      assert.equal(result, 4);
      assert.equal(ctx.x, 4);
    });

    it('should handle postfix decrement', () => {
      const ctx = { x: 5 };
      const result = eval1('x--', ctx);
      assert.equal(result, 5);
      assert.equal(ctx.x, 4);
    });
  });

  describe('array expressions', () => {
    it('should create arrays', () => {
      assert.deepEqual(eval1('[1, 2, 3]'), [1, 2, 3]);
    });

    it('should handle spread in arrays', () => {
      assert.deepEqual(eval1('[...arr, 4]', { arr: [1, 2, 3] }), [1, 2, 3, 4]);
    });
  });

  describe('object expressions', () => {
    it('should create objects', () => {
      assert.deepEqual(eval1('({ a: 1, b: 2 })'), { a: 1, b: 2 });
    });

    it('should handle computed keys', () => {
      assert.deepEqual(eval1('({ [key]: "value" })', { key: 'dynamic' }), { dynamic: 'value' });
    });
  });

  describe('new expressions', () => {
    it('should create new instances', () => {
      const result = eval1('new Date(2024, 0, 1)', { Date });
      assert.ok(result instanceof Date);
    });
  });

  describe('this expression', () => {
    it('should resolve this from context', () => {
      const self = { name: 'component' };
      assert.equal(eval1('this.name', [{ this: self }]), 'component');
    });
  });

  describe('error handling', () => {
    it('should throw with location info on error', () => {
      const loc = { startLine: 1, endLine: 1 };
      assert.throws(() => {
        evaluate(getAST('nonexistent()'), {}, loc);
      });
    });
  });
});
