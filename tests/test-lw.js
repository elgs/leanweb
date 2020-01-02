const lwlib = require('../lib/lw.js');

describe('leanweb lib tests', () => {
   it('should tokenize string', () => {
      expect(lwlib.tokenize('1+1')).toEqual(['1', '+', '1']);
      expect(lwlib.tokenize('1 + 1')).toEqual(['1', '+', '1']);
      expect(lwlib.tokenize('2*x+y')).toEqual(['2', '*', 'x', '+', 'y']);
      expect(lwlib.tokenize('-1+a*-b')).toEqual(['-1', '+', 'a', '*', '-b']);
      expect(lwlib.tokenize('(-1+a)*-b')).toEqual(['(', '-1', '+', 'a', ')', '*', '-b']);
      expect(lwlib.tokenize('a===b')).toEqual(['a', '===', 'b']);
      expect(lwlib.tokenize('(a)===(b)')).toEqual(['(', 'a', ')', '===', '(', 'b', ')']);
      expect(lwlib.tokenize('a==b')).toEqual(['a', '==', 'b']);
      expect(lwlib.tokenize('a!=b')).toEqual(['a', '!=', 'b']);
      expect(lwlib.tokenize('a!==b')).toEqual(['a', '!==', 'b']);
      expect(lwlib.tokenize('a[3]===4')).toEqual(['a', '[', '3', ']', '===', '4']);
      expect(lwlib.tokenize('a!=="asdf"')).toEqual(['a', '!==', '"asdf"']);
      expect(lwlib.tokenize('a!==\'asdf\'')).toEqual(['a', '!==', "'asdf'"]);
   });
});
