class LWEvent {
   constructor(event, data) {
      this.event = event;
      this.data = data;
   }
}

class LWEventListener {
   static key = 0;
   constructor(event, callback) {
      this.event = event;
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

   addEventListener(event, callback) {
      const listener = new LWEventListener(event, callback);
      this.listeners[listener.event] = this.listeners[listener.event] || {};
      const events = this.listeners[listener.event];
      events[listener.key] = listener;
      return listener;
   }

   removeEventListener(listener) {
      if (this.listeners[listener.event]) {
         delete this.listeners[listener.event][listener.key];
      }
   }

   dispatchEvent(event, data = null) {
      if (this.listeners[event]) {
         Object.values(this.listeners[event]).forEach(listener => {
            listener.callback.call(void 0, new LWEvent(event, data));
         });
      }
   }
}