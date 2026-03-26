import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getComponentName, getComponentPath, getPathLevels, throttle, portInUse } from '../commands/utils.js';

describe('utils', () => {
  describe('getComponentName', () => {
    it('should return the component name after last slash', () => {
      assert.equal(getComponentName('path/to/my-component'), 'my-component');
    });

    it('should return the full string when no slash', () => {
      assert.equal(getComponentName('my-component'), 'my-component');
    });

    it('should handle multiple slashes', () => {
      assert.equal(getComponentName('a/b/c/deep-component'), 'deep-component');
    });

    it('should handle trailing component after single slash', () => {
      assert.equal(getComponentName('dir/comp'), 'comp');
    });
  });

  describe('getComponentPath', () => {
    it('should return the path before last slash', () => {
      assert.equal(getComponentPath('path/to/my-component'), 'path/to');
    });

    it('should return empty string when no slash', () => {
      assert.equal(getComponentPath('my-component'), '');
    });

    it('should handle single directory', () => {
      assert.equal(getComponentPath('dir/comp'), 'dir');
    });
  });

  describe('getPathLevels', () => {
    it('should return empty string for file without directory', () => {
      assert.equal(getPathLevels('file.html'), '');
    });

    it('should return ../ for one level deep', () => {
      assert.equal(getPathLevels('dir/file.html'), '../');
    });

    it('should return ../../ for two levels deep', () => {
      assert.equal(getPathLevels('a/b/file.html'), '../../');
    });

    it('should handle deeper paths', () => {
      assert.equal(getPathLevels('a/b/c/file.html'), '../../../');
    });
  });

  describe('throttle', () => {
    it('should call function after delay', async () => {
      let called = false;
      const fn = throttle(() => { called = true; }, 50);
      fn();
      assert.equal(called, false); // not called immediately
      await new Promise(r => setTimeout(r, 100));
      assert.equal(called, true);
    });

    it('should not call function again within the limit', async () => {
      let callCount = 0;
      const fn = throttle(() => { callCount++; }, 50);
      fn();
      fn();
      fn();
      await new Promise(r => setTimeout(r, 100));
      assert.equal(callCount, 1);
    });

    it('should allow call again after limit expires', async () => {
      let callCount = 0;
      const fn = throttle(() => { callCount++; }, 30);
      fn();
      await new Promise(r => setTimeout(r, 50));
      assert.equal(callCount, 1);
      fn();
      await new Promise(r => setTimeout(r, 50));
      assert.equal(callCount, 2);
    });
  });

  describe('portInUse', () => {
    it('should return false for an available port', async () => {
      const result = await portInUse(0);
      assert.equal(result, false);
    });
  });
});
