import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../lib/lw-html-parser.js';

describe('lw-html-parser', () => {
  describe('parse', () => {
    it('should return an object with html property', () => {
      const result = parse('<div>hello</div>');
      assert.ok(result.html);
      assert.equal(typeof result.html, 'string');
    });

    it('should pass through plain HTML unchanged', () => {
      const result = parse('<div>hello</div>');
      assert.equal(result.html, '<div>hello</div>');
      // Only the html key, no interpolation keys
      assert.deepEqual(Object.keys(result), ['html']);
    });

    it('should handle lw text interpolation', () => {
      const result = parse('<span lw>name</span>');
      const keys = Object.keys(result).filter(k => k !== 'html');
      assert.equal(keys.length, 1);

      const interp = result[keys[0]];
      assert.ok(interp.ast);
      assert.ok(interp.loc);
      // The content should be cleared from the HTML
      assert.ok(!result.html.includes('>name<'));
    });

    it('should handle lw with empty content', () => {
      const result = parse('<span lw></span>');
      const keys = Object.keys(result).filter(k => k !== 'html');
      assert.equal(keys.length, 1);
    });

    it('should handle lw with complex expressions', () => {
      const result = parse('<span lw>1 + 2 + 3</span>');
      const keys = Object.keys(result).filter(k => k !== 'html');
      assert.equal(keys.length, 1);

      const interp = result[keys[0]];
      assert.ok(interp.ast.length > 0);
    });

    it('should handle lw-on:click event binding', () => {
      const result = parse('<button lw-on:click="handleClick()">Click</button>');
      const keys = Object.keys(result).filter(k => k !== 'html');
      assert.equal(keys.length, 1);

      const interp = result[keys[0]];
      assert.equal(interp.lwType, 'lw-on');
      assert.equal(interp.lwValue, 'click');
    });

    it('should handle lw-class binding', () => {
      const result = parse('<div lw-class:active="isActive"></div>');
      const keys = Object.keys(result).filter(k => k !== 'html');
      assert.equal(keys.length, 1);

      const interp = result[keys[0]];
      assert.equal(interp.lwType, 'lw-class');
      assert.equal(interp.lwValue, 'active');
    });

    it('should handle lw-bind binding', () => {
      const result = parse('<input lw-bind:value="name">');
      const keys = Object.keys(result).filter(k => k !== 'html');
      assert.equal(keys.length, 1);

      const interp = result[keys[0]];
      assert.equal(interp.lwType, 'lw-bind');
      assert.equal(interp.lwValue, 'value');
    });

    it('should handle lw-bind:class with existing class attr', () => {
      const result = parse('<div class="base" lw-bind:class="dynamicClass"></div>');
      assert.ok(result.html.includes('lw-init-class'));
    });

    it('should handle lw-model binding', () => {
      const result = parse('<input lw-model="username">');
      const keys = Object.keys(result).filter(k => k !== 'html');
      assert.equal(keys.length, 1);

      // lw-model adds both lw-elem-bind and lw-elem
      assert.ok(result.html.includes('lw-elem-bind'));
      assert.ok(result.html.includes('lw-elem'));
    });

    it('should handle lw-for loop', () => {
      const result = parse('<li lw-for="item in items">text</li>');
      const keys = Object.keys(result).filter(k => k !== 'html');
      assert.equal(keys.length, 1);

      const interp = result[keys[0]];
      assert.equal(interp.itemExpr, 'item');
      assert.equal(interp.itemsExpr, 'items');
      assert.ok(interp.astItems);
    });

    it('should handle lw-for with index', () => {
      const result = parse('<li lw-for="item, index in items">text</li>');
      const keys = Object.keys(result).filter(k => k !== 'html');
      const interp = result[keys[0]];
      assert.equal(interp.itemExpr, 'item');
      assert.equal(interp.indexExpr, 'index');
      assert.equal(interp.itemsExpr, 'items');
    });

    it('should handle lw-input binding', () => {
      const result = parse('<input lw-input:change="onInputChange()">');
      const keys = Object.keys(result).filter(k => k !== 'html');
      assert.equal(keys.length, 1);

      // lw-input adds lw-elem-bind
      assert.ok(result.html.includes('lw-elem-bind'));
    });

    it('should handle multiple lw attributes on different elements', () => {
      const result = parse('<div><span lw>a</span><span lw>b</span></div>');
      const keys = Object.keys(result).filter(k => k !== 'html');
      assert.equal(keys.length, 2);
    });

    it('should handle nested elements with lw attributes', () => {
      const result = parse('<div lw-on:click="handler()"><span lw>text</span></div>');
      const keys = Object.keys(result).filter(k => k !== 'html');
      assert.equal(keys.length, 2);
    });

    it('should strip AST location info', () => {
      const result = parse('<span lw>name</span>');
      const keys = Object.keys(result).filter(k => k !== 'html');
      const interp = result[keys[0]];
      const astStr = JSON.stringify(interp.ast);
      // Should not contain loc, start, end from babel
      assert.ok(!astStr.includes('"loc"'));
      assert.ok(!astStr.includes('"start"'));
      assert.ok(!astStr.includes('"end"'));
    });

    it('should handle generic lw- prefixed attributes', () => {
      const result = parse('<div lw-if="visible"></div>');
      const keys = Object.keys(result).filter(k => k !== 'html');
      assert.equal(keys.length, 1);
      assert.ok(result.html.includes('lw-elem'));
    });
  });
});
