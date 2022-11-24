class LWEvent {
  constructor(eventName, data) {
    this.eventName = eventName;
    this.data = data;
  }
}

class LWEventListener {
  static key = 0;
  constructor(eventName, callback) {
    this.eventName = eventName;
    this.callback = callback;
    this.key = ++LWEventListener.key;
  }
}

// const listeners = {
//   event0: {
//     key0: listener0,
//     key1: listener1,
//   },
//   event0: {},
//   event0: {},
// };

export default class LWEventBus {
  constructor() {
    this.listeners = {};
  }

  addEventListener(eventName, callback) {
    const listener = new LWEventListener(eventName, callback);
    this.listeners[listener.eventName] = this.listeners[listener.eventName] || {};
    const events = this.listeners[listener.eventName];
    events[listener.key] = listener;
    return listener;
  }

  removeEventListener(listener) {
    if (this.listeners[listener.eventName]) {
      delete this.listeners[listener.eventName][listener.key];
    }
  }

  dispatchEvent(eventName, data = null) {
    if (this.listeners[eventName]) {
      Object.values(this.listeners[eventName]).forEach(listener => {
        setTimeout(() => {
          listener.callback.call(void 0, new LWEvent(eventName, data));
        });
      });
    }
  }
}