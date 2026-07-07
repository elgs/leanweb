import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { APIClient } from '../templates/lib/api-client.js';

const originalFetch = globalThis.fetch;
const hadLocalStorage = 'localStorage' in globalThis;
const originalLocalStorage = globalThis.localStorage;

// Replaces globalThis.fetch with a stub and returns the recorded calls.
const mockFetch = (response = {}) => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '',
      ...response,
    };
  };
  return calls;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (hadLocalStorage) {
    globalThis.localStorage = originalLocalStorage;
  } else {
    delete globalThis.localStorage;
  }
});

describe('APIClient', () => {

  it('should resolve parsed JSON on success', async () => {
    mockFetch({ text: async () => '{"a":1}' });
    const client = new APIClient('http://api.test');
    assert.deepEqual(await client.get('/thing'), { a: 1 });
  });

  it('should resolve null for an empty body (e.g. 204 No Content)', async () => {
    mockFetch({ status: 204, text: async () => '' });
    const client = new APIClient('http://api.test');
    assert.equal(await client.delete('/thing/1'), null);
  });

  it('should reject on HTTP errors with status and body attached', async () => {
    mockFetch({ ok: false, status: 500, statusText: 'Internal Server Error', text: async () => '{"error":"x"}' });
    const client = new APIClient('http://api.test');
    await assert.rejects(client.get('/bad'), err => {
      assert.match(err.message, /HTTP 500/);
      assert.equal(err.status, 500);
      assert.equal(err.body, '{"error":"x"}');
      return true;
    });
  });

  it('should encode GET params, including keys and array values', async () => {
    const calls = mockFetch({ text: async () => '{}' });
    const client = new APIClient('http://api.test');
    await client.get('/search', { q: 'a b', tags: ['x', 'y'], 'weird&key': 'v' });
    assert.equal(calls[0].url, 'http://api.test/search?q=a%20b&tags=x&tags=y&weird%26key=v');
  });

  it('should not append a trailing ? when GET params are empty', async () => {
    const calls = mockFetch({ text: async () => '{}' });
    const client = new APIClient('http://api.test');
    await client.get('/plain');
    await client.get('/plain2', {});
    assert.equal(calls[0].url, 'http://api.test/plain');
    assert.equal(calls[1].url, 'http://api.test/plain2');
  });

  it('should send JSON body for POST', async () => {
    const calls = mockFetch({ text: async () => '{}' });
    const client = new APIClient('http://api.test');
    await client.post('/create', { a: 1 });
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.body, '{"a":1}');
  });

  it('should attach the bearer token without mutating caller headers', async () => {
    globalThis.localStorage = { getItem: () => 'tok123' };
    const calls = mockFetch({ text: async () => '{}' });
    const client = new APIClient('http://api.test', true);
    const myHeaders = { 'x-custom': '1' };
    await client.get('/secure', {}, myHeaders);
    assert.deepEqual(myHeaders, { 'x-custom': '1' }, 'caller headers must not be mutated');
    assert.equal(calls[0].options.headers['authorization'], 'Bearer tok123');
    assert.equal(calls[0].options.headers['x-custom'], '1');
  });

  it('should reject when sendToken is set and no token is stored', async () => {
    globalThis.localStorage = { getItem: () => null };
    const calls = mockFetch();
    const client = new APIClient('http://api.test', true);
    await assert.rejects(client.get('/secure'), /No access token/);
    assert.equal(calls.length, 0, 'no request should be sent without a token');
  });
});
