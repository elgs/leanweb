import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Tests for 4.3 light-DOM content projection (lw-slot): a component's
// initial children are re-homed into its template's <lw-slot> and stay
// owned by the component that wrote them — parent context, parent
// expressions, parent updates. The projected-into component never
// processes them (its AST doesn't know their keys).

function setupDOM() {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', { url: 'http://localhost' });
  const win = dom.window;

  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.Node = win.Node;
  globalThis.NodeFilter = win.NodeFilter;
  globalThis.CSSStyleSheet = class CSSStyleSheet { replaceSync() {} };
  globalThis.location = win.location;
  globalThis.addEventListener = win.addEventListener.bind(win);
  globalThis.customElements = win.customElements;

  delete globalThis.leanweb;

  return dom;
}

function makeAST(overrides = {}) {
  return {
    runtimeVersion: '1.0.0',
    builderVersion: '1.0.0',
    componentFullName: 'app-root',
    html: '',
    css: '',
    shadowDom: false,
    ...overrides,
  };
}

async function loadLWElement() {
  const mod = await import(`../templates/lib/lw-element.js?t=${Date.now()}-${Math.random()}`);
  return mod.default;
}

const expr = e => ({ type: 'ExpressionStatement', expression: e });
const ident = name => ({ type: 'Identifier', name });
const member = (objName, propName) => ({ type: 'MemberExpression', computed: false, object: ident(objName), property: ident(propName) });
const call = name => ({ type: 'CallExpression', callee: ident(name), arguments: [] });

const tick = () => new Promise(r => setTimeout(r, 0));

// A card with its own bound chrome and a slot. Children projected into it
// must render from the HOST's state; the card's AST has no idea about them.
function defineCard(LWElement, win) {
  class Card extends LWElement {
    constructor() {
      super(makeAST({
        componentFullName: 'app-card',
        html: '<div class="chrome"><span class="card-title" lw-elem lw="kTitle"></span><lw-slot></lw-slot></div>',
        'kTitle': { ast: [expr(ident('title'))], loc: {} },
      }));
      this.title = 'CARD';
    }
  }
  win.customElements.define('app-card', Card);
}

function defineHost(LWElement, win, { html, ast = {}, fields = {} }) {
  class Host extends LWElement {
    constructor() {
      super(makeAST({ componentFullName: 'app-host', html, ...ast }));
      Object.assign(this, fields);
    }
    bump() { this.bumps++; }
  }
  win.customElements.define('app-host', Host);
  // Parser path, not createElement: constructors that build DOM are only
  // legal on parsed/upgraded elements — exactly how leanweb apps run.
  win.document.body.innerHTML = '<app-host></app-host>';
  return win.document.body.firstElementChild;
}

describe('content projection (lw-slot)', () => {
  it('should re-home initial children into the slot and render them with parent state', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    defineCard(LWElement, win);
    const host = defineHost(LWElement, win, {
      html: '<app-card><span class="msg" lw-elem lw="kMsg"></span></app-card>',
      ast: { 'kMsg': { ast: [expr(ident('msg'))], loc: {} } },
      fields: { msg: 'hello' },
    });
    await tick();

    const card = host.querySelector('app-card');
    const slot = card.querySelector('lw-slot');
    const msg = card.querySelector('.msg');
    assert.ok(slot, 'the card template rendered');
    assert.equal(msg.parentElement, slot, 'projected content re-homed into the slot');
    assert.ok(msg.hasAttribute('lw-projected'), 'projected root is marked');
    assert.equal(card['lw-projected-roots'].length, 1);
    assert.equal(card['lw-projected-roots'][0], msg);
    assert.equal(msg.innerText, 'hello', 'rendered from the HOST state');
    assert.equal(card.querySelector('.card-title').innerText, 'CARD', 'card chrome rendered from the card state');
  });

  it('should keep projected content the parent\'s: parent updates flow in, child updates skip it', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    defineCard(LWElement, win);
    const host = defineHost(LWElement, win, {
      html: '<app-card><span class="msg" lw-elem lw="kMsg"></span></app-card>',
      ast: { 'kMsg': { ast: [expr(ident('msg'))], loc: {} } },
      fields: { msg: 'hello' },
    });
    await tick();
    const card = host.querySelector('app-card');
    const msg = card.querySelector('.msg');

    host.msg = 'world';
    host.update();
    assert.equal(msg.innerText, 'world', 'host update reached the projected content');

    // The card's AST has no 'kMsg'. If its walker didn't skip projected
    // nodes, this would throw — and would clobber the host-rendered text.
    card.title = 'X';
    card.update();
    assert.equal(msg.innerText, 'world', 'card update left projected content alone');
    assert.equal(card.querySelector('.card-title').innerText, 'X');
  });

  it('should bind projected events to the parent component, once', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    defineCard(LWElement, win);
    const host = defineHost(LWElement, win, {
      html: '<app-card><button class="go" lw-elem lw-elem-bind lw-on:click="kGo"></button></app-card>',
      ast: { 'kGo': { ast: [expr(call('bump'))], lwValue: 'click', loc: {} } },
      fields: { bumps: 0 },
    });
    await tick();

    // Repeated host updates must not stack duplicate listeners.
    host.update();
    host.update();
    host.querySelector('.go').click();
    assert.equal(host.bumps, 1, 'projected click ran the HOST method exactly once');
  });

  it('should park and restore projected lw-if content through the slot', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    defineCard(LWElement, win);
    const host = defineHost(LWElement, win, {
      html: '<app-card><span class="note" lw-elem lw-if="kShow" lw="kNote"></span></app-card>',
      ast: {
        'kShow': { ast: [expr(ident('show'))], loc: {} },
        'kNote': { ast: [expr(ident('note'))], loc: {} },
      },
      fields: { show: true, note: 'n1' },
    });
    await tick();
    const card = host.querySelector('app-card');
    const slot = card.querySelector('lw-slot');
    assert.ok(card.querySelector('.note'), 'visible while true');

    host.show = false;
    host.update();
    assert.equal(card.querySelector('.note'), null, 'parked');
    assert.ok([...slot.childNodes].some(n => n.nodeType === 8 && n.textContent === 'lw-if'),
      'the HOST\'s placeholder sits inside the slot');
    assert.equal(host._ifPlaceholders.size, 1, 'registered on the host, not the card');
    assert.equal(card._ifPlaceholders.size, 0);

    host.show = true;
    host.update();
    const note = card.querySelector('.note');
    assert.ok(note, 'restored');
    assert.equal(note.parentElement, slot, 'restored back inside the slot');
    assert.equal(note.innerText, 'n1', 'rendered with host state after restore');
  });

  it('should drive projected lw-for through extraction and the parent sweep', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    defineCard(LWElement, win);
    const [a, b, c] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
    const host = defineHost(LWElement, win, {
      html: '<app-card><div class="row" lw-elem lw-for="kFor" lw="kRow"></div></app-card>',
      ast: {
        'kFor': { astItems: [expr(ident('items'))], itemExpr: 'it', indexExpr: 'idx', loc: {} },
        'kRow': { ast: [expr(member('it', 'name'))], loc: {} },
      },
      fields: { items: [a, b] },
    });
    await tick();
    const card = host.querySelector('app-card');
    const slot = card.querySelector('lw-slot');
    const rows = () => [...card.querySelectorAll('.row[lw-for-parent]')].map(n => n.innerText);

    assert.deepEqual(rows(), ['a', 'b'], 'rows rendered from host items into the slot');
    assert.ok([...slot.childNodes].some(n => n.nodeType === 8 && n.textContent === 'lw-for'),
      'template extracted onto an anchor inside the slot');
    assert.ok(host._forTemplates.size >= 1, 'anchor registered on the host');

    card.update(); // must not throw: card AST knows neither kFor nor kRow
    assert.deepEqual(rows(), ['a', 'b']);

    host.items = [a, b, c];
    host.update();
    assert.deepEqual(rows(), ['a', 'b', 'c'], 'host update re-rendered the projected list');

    host.items = [c, a];
    host.update();
    assert.deepEqual(rows(), ['c', 'a']);
  });

  it('should leave children of a slotless component in place (compat)', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    class Bare extends LWElement {
      constructor() {
        super(makeAST({ componentFullName: 'app-bare', html: '<div class="chrome"></div>' }));
      }
    }
    win.customElements.define('app-bare', Bare);
    const host = defineHost(LWElement, win, {
      html: '<app-bare><span class="static">hi</span></app-bare>',
    });
    await tick();

    const bare = host.querySelector('app-bare');
    const span = bare.querySelector('.static');
    assert.equal(span.parentElement, bare, 'stays a direct child');
    assert.equal(bare.firstElementChild, span, 'still ahead of the template, as before 4.3');
    assert.ok(!span.hasAttribute('lw-projected'), 'not marked');
    assert.equal(bare['lw-projected-roots'], undefined);
    host.update();
    assert.equal(span.textContent, 'hi');
  });

  it('should treat whitespace-only children as no projection', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    defineCard(LWElement, win);
    const host = defineHost(LWElement, win, { html: '<app-card>\n   </app-card>' });
    await tick();

    const card = host.querySelector('app-card');
    assert.equal(card['lw-projected-roots'], undefined);
    assert.equal(card.querySelector('lw-slot').childNodes.length, 0, 'slot stays empty');
  });

  it('should keep a host placeholder alive while a child parks the subtree around it', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    // A collapsible: the slot sits under the card's own lw-if.
    class Fold extends LWElement {
      constructor() {
        super(makeAST({
          componentFullName: 'app-fold',
          html: '<div class="chrome" lw-elem lw-if="kOpen"><lw-slot></lw-slot></div>',
          'kOpen': { ast: [expr(ident('open'))], loc: {} },
        }));
        this.open = true;
      }
    }
    win.customElements.define('app-fold', Fold);
    const host = defineHost(LWElement, win, {
      html: '<app-fold><span class="deep" lw-elem lw-if="kShow" lw="kNote"></span></app-fold>',
      ast: {
        'kShow': { ast: [expr(ident('show'))], loc: {} },
        'kNote': { ast: [expr(ident('note'))], loc: {} },
      },
      fields: { show: true, note: 'n' },
    });
    await tick();
    const fold = host.querySelector('app-fold');
    assert.ok(fold.querySelector('.deep'));

    // Host hides its projected span; its placeholder now sits in the slot.
    host.show = false;
    host.update();
    assert.equal(host._ifPlaceholders.size, 1);

    // The fold collapses: the chrome — with the HOST's placeholder inside —
    // leaves the DOM, parked by the FOLD.
    fold.open = false;
    fold.update();
    assert.equal(fold.querySelector('.chrome'), null, 'chrome parked');

    // The host's sweep must not mistake its riding placeholder for dead.
    host.update();
    assert.equal(host._ifPlaceholders.size, 1, 'entry survived the child\'s park');

    fold.open = true;
    fold.update();
    host.show = true;
    host.update();
    const deep = fold.querySelector('.deep');
    assert.ok(deep, 'restored after the fold reopened');
    assert.equal(deep.innerText, 'n');

    // And a subtree that truly dies still purges: park again, then remove
    // the fold outright (no parked marker on a plain removal).
    host.show = false;
    host.update();
    assert.equal(host._ifPlaceholders.size, 1);
    fold.remove();
    host.update();
    assert.equal(host._ifPlaceholders.size, 0, 'dead subtree purged');
  });

  // A pane with a named slot carrying fallback content of its own, plus a
  // default slot. Fallback is the PANE's: its expression lives in the pane's
  // AST and renders from pane state.
  function definePane(LWElement, win) {
    class Pane extends LWElement {
      constructor() {
        super(makeAST({
          componentFullName: 'app-pane',
          html: '<div class="head"><lw-slot name="extra"><em class="fb" lw-elem lw="kFb"></em></lw-slot></div><div class="body"><lw-slot></lw-slot></div>',
          'kFb': { ast: [expr(ident('fb'))], loc: {} },
        }));
        this.fb = 'fallback';
      }
    }
    win.customElements.define('app-pane', Pane);
  }

  it('should distribute children into named slots and the rest into the default', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    definePane(LWElement, win);
    const host = defineHost(LWElement, win, {
      html: '<app-pane><button slot="extra" class="act" lw-elem lw="kAct"></button> <span class="main" lw-elem lw="kMain"></span></app-pane>',
      ast: {
        'kAct': { ast: [expr(ident('act'))], loc: {} },
        'kMain': { ast: [expr(ident('main'))], loc: {} },
      },
      fields: { act: 'go', main: 'body' },
    });
    await tick();

    const pane = host.querySelector('app-pane');
    const act = pane.querySelector('.act');
    const main = pane.querySelector('.main');
    assert.equal(act.parentElement, pane.querySelector('.head > lw-slot'), 'slot="extra" landed in the named slot');
    assert.equal(main.parentElement, pane.querySelector('.body > lw-slot'), 'unnamed child landed in the default slot');
    assert.equal(act.innerText, 'go', 'named-slotted content rendered from HOST state');
    assert.equal(main.innerText, 'body');
    assert.equal(pane['lw-projected-roots'].length, 2, 'both roots tracked');
    assert.ok([...pane.querySelector('.body > lw-slot').childNodes].some(n => n.nodeType === Node.TEXT_NODE),
      'stray text rides along into the default slot');

    host.act = 'go!';
    host.update();
    assert.equal(act.innerText, 'go!', 'host updates reach named-slotted content');
  });

  it('should keep fallback content, component-rendered, when a slot gets nothing', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    definePane(LWElement, win);
    const host = defineHost(LWElement, win, {
      html: '<app-pane><span class="main" lw-elem lw="kMain"></span></app-pane>',
      ast: { 'kMain': { ast: [expr(ident('main'))], loc: {} } },
      fields: { main: 'm' },
    });
    await tick();

    const pane = host.querySelector('app-pane');
    const fb = pane.querySelector('.fb');
    assert.ok(fb, 'fallback kept in the unfilled slot');
    assert.equal(fb.innerText, 'fallback', 'fallback rendered from the PANE state');
    assert.ok(!fb.hasAttribute('lw-projected'), 'fallback is component-owned, not projected');
    assert.equal(pane.querySelector('.main').innerText, 'm');

    pane.fb = 'changed';
    pane.update();
    assert.equal(fb.innerText, 'changed', 'pane updates drive its own fallback');
  });

  it('should replace fallback content when the slot is filled', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    definePane(LWElement, win);
    const host = defineHost(LWElement, win, {
      html: '<app-pane><b slot="extra" class="given" lw-elem lw="kG"></b></app-pane>',
      ast: { 'kG': { ast: [expr(ident('g'))], loc: {} } },
      fields: { g: 'supplied' },
    });
    await tick();

    const pane = host.querySelector('app-pane');
    assert.equal(pane.querySelector('.fb'), null, 'fallback gone');
    const given = pane.querySelector('.given');
    assert.equal(given.parentElement, pane.querySelector('.head > lw-slot'));
    assert.equal(given.innerText, 'supplied', 'rendered from host state');
    // The pane's walker must not choke on its removed fallback expression.
    pane.update();
    assert.equal(given.innerText, 'supplied');
  });

  it('should route an unmatched slot name to the default slot, or ahead of the template without one', async () => {
    setupDOM();
    const LWElement = await loadLWElement();
    const win = globalThis.window;
    definePane(LWElement, win);
    class Rigid extends LWElement {
      constructor() {
        super(makeAST({
          componentFullName: 'app-rigid',
          html: '<div class="chrome"><lw-slot name="only"></lw-slot></div>',
        }));
      }
    }
    win.customElements.define('app-rigid', Rigid);
    const host = defineHost(LWElement, win, {
      html: '<app-pane><i slot="nope" class="lost" lw-elem lw="kL"></i></app-pane><app-rigid><i slot="nope" class="lost" lw-elem lw="kL"></i></app-rigid>',
      ast: { 'kL': { ast: [expr(ident('l'))], loc: {} } },
      fields: { l: 'found' },
    });
    await tick();

    const pane = host.querySelector('app-pane');
    const inPane = pane.querySelector('.lost');
    assert.equal(inPane.parentElement, pane.querySelector('.body > lw-slot'), 'fell back to the default slot');
    assert.equal(inPane.innerText, 'found');

    const rigid = host.querySelector('app-rigid');
    const inRigid = rigid.querySelector('.lost');
    assert.equal(inRigid.parentElement, rigid, 'no default slot: sits ahead of the template');
    assert.equal(rigid.firstElementChild, inRigid);
    assert.ok(inRigid.hasAttribute('lw-projected'), 'still projected and host-rendered');
    assert.equal(inRigid.innerText, 'found');
  });
});
