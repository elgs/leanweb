import * as parser from './parser.js';

const domEvents = [
   'abort',
   'afterprint',
   'animationend',
   'animationiteration',
   'animationstart',
   'beforeprint',
   'auxclick',
   'beforeunload',
   'blur',
   'canplay',
   'canplaythrough',
   'change',
   'click',
   'contextmenu',
   'copy',
   'cut',
   'dblclick',
   'drag',
   'dragend',
   'dragenter',
   'dragleave',
   'dragover',
   'dragstart',
   'drop',
   'durationchange',
   'ended',
   'error',
   'focus',
   'focusin',
   'focusout',
   'fullscreenchange',
   'fullscreenerror',
   'hashchange',
   'input',
   'invalid',
   'keydown',
   'keypress',
   'keyup',
   'load',
   'loadeddata',
   'loadedmetadata',
   'loadstart',
   'message',
   'mousedown',
   'mouseenter',
   'mouseleave',
   'mousemove',
   'mouseover',
   'mouseout',
   'mouseup',
   'mousewheel',
   'offline',
   'online',
   'open',
   'pagehide',
   'pageshow',
   'paste',
   'pause',
   'play',
   'playing',
   'popstate',
   'progress',
   'ratechange',
   'resize',
   'reset',
   'scroll',
   'search',
   'seeked',
   'seeking',
   'select',
   'show',
   'stalled',
   'storage',
   'submit',
   'suspend',
   'timeupdate',
   'toggle',
   'touchcancel',
   'touchend',
   'touchmove',
   'touchstart',
   'transitionend',
   'unload',
   'volumechange',
   'waiting'];

export default class LWElement extends HTMLElement {

   constructor(templateId) {
      super();

      const templateNode = document.querySelector('#' + templateId).content.cloneNode(true);
      this.attachShadow({ mode: 'open' }).appendChild(templateNode);

      setTimeout(() => {
         this.update();
         this.bindEventListeners();
      });
   }

   bindEventListeners() {
      for (const e of domEvents) {
         this.shadowRoot.querySelectorAll(`[lw-${e}]`).forEach(evalNode => {
            if (!evalNode[`lw-${e}`]) {
               const expression = evalNode.getAttribute(`lw-${e}`);
               const ast = parser.parse('this.' + expression);
               evalNode[`lw-${e}`] = ast;
            }

            evalNode.addEventListener(e, function (event) {
               this['$event'] = event;
               const ret = parser.eval(evalNode[`lw-${e}`], this);
               delete this['$event'];
               return ret;
            }.bind(this));
         });
      }
   }

   update(selector = '') {
      this.shadowRoot.querySelectorAll(selector.trim() + '[lw]').forEach(evalNode => {
         if (!evalNode['lw-eval']) {
            const expression = evalNode.innerText;
            const ast = parser.parse(expression);
            evalNode['lw-eval'] = ast;
         }

         parser.evalAsync(evalNode['lw-eval'], this).then(value => {
            evalNode.innerText = value;
         });
      });
   }
}