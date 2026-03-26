import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import LWEventBus from '../templates/lib/lw-event-bus.js';

describe('LWEventBus', () => {
  it('should create an instance with empty listeners', () => {
    const bus = new LWEventBus();
    assert.deepEqual(bus.listeners, {});
  });

  describe('addEventListener', () => {
    it('should register a listener and return it', () => {
      const bus = new LWEventBus();
      const callback = () => {};
      const listener = bus.addEventListener('test', callback);
      assert.equal(listener.eventName, 'test');
      assert.equal(listener.callback, callback);
      assert.ok(listener.key);
    });

    it('should register multiple listeners for same event', () => {
      const bus = new LWEventBus();
      bus.addEventListener('test', () => {});
      bus.addEventListener('test', () => {});
      assert.equal(Object.keys(bus.listeners['test']).length, 2);
    });

    it('should register listeners for different events', () => {
      const bus = new LWEventBus();
      bus.addEventListener('event1', () => {});
      bus.addEventListener('event2', () => {});
      assert.ok(bus.listeners['event1']);
      assert.ok(bus.listeners['event2']);
    });
  });

  describe('removeEventListener', () => {
    it('should remove a registered listener', () => {
      const bus = new LWEventBus();
      const listener = bus.addEventListener('test', () => {});
      bus.removeEventListener(listener);
      assert.equal(Object.keys(bus.listeners['test']).length, 0);
    });

    it('should not throw when removing from non-existent event', () => {
      const bus = new LWEventBus();
      assert.doesNotThrow(() => {
        bus.removeEventListener({ eventName: 'nonexistent', key: 999 });
      });
    });

    it('should only remove the specified listener', () => {
      const bus = new LWEventBus();
      const listener1 = bus.addEventListener('test', () => {});
      bus.addEventListener('test', () => {});
      bus.removeEventListener(listener1);
      assert.equal(Object.keys(bus.listeners['test']).length, 1);
    });
  });

  describe('dispatchEvent', () => {
    it('should call listener callback with event data', async () => {
      const bus = new LWEventBus();
      let receivedEvent = null;
      bus.addEventListener('test', event => {
        receivedEvent = event;
      });
      bus.dispatchEvent('test', { message: 'hello' });
      // dispatchEvent uses setTimeout, so we need to wait
      await new Promise(r => setTimeout(r, 50));
      assert.ok(receivedEvent);
      assert.equal(receivedEvent.eventName, 'test');
      assert.deepEqual(receivedEvent.data, { message: 'hello' });
    });

    it('should call all listeners for the event', async () => {
      const bus = new LWEventBus();
      let count = 0;
      bus.addEventListener('test', () => count++);
      bus.addEventListener('test', () => count++);
      bus.dispatchEvent('test');
      await new Promise(r => setTimeout(r, 50));
      assert.equal(count, 2);
    });

    it('should not throw when dispatching event with no listeners', () => {
      const bus = new LWEventBus();
      assert.doesNotThrow(() => {
        bus.dispatchEvent('nonexistent', { data: 'test' });
      });
    });

    it('should default data to null', async () => {
      const bus = new LWEventBus();
      let receivedEvent = null;
      bus.addEventListener('test', event => {
        receivedEvent = event;
      });
      bus.dispatchEvent('test');
      await new Promise(r => setTimeout(r, 50));
      assert.equal(receivedEvent.data, null);
    });
  });
});
