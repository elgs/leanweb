# <a href="https://leanweb.app"><img src='https://leanweb.app/favicon.svg' alt='Leanweb' width='32'/></a> Leanweb

A set of tools (as opposed to framework) to generate web components based web
project.

## Installation

- `npm install leanweb -g` as a global tool, or
- `npm install leanweb -D` in the project as a dev dependency.

If leanweb is installed as a dev dependency, you will need to run
`npx lw`, otherwise just run `lw` if it is installed as global tool.

I don't see any reason leanweb should be installed as `npm install leanweb`.

## Background

I like the idea in Angular that 3 files (html/js/scss) as a component are in
charge of a box, like a div, a rectangle area. But I don't like Angular in that
my code has to be depending on so many bloated dependencies to run. I created
leanweb as a set of tools to help create web components based web projects,
which:

- are based on native DOM and web components api
- are pure Javascript, no fancy framework
- are assistive, not restrictive
- are more standards, less proprietary
- are built to last

The principle is simply that 3 files (html/js/scss) as a web component will
control a box.

## Getting started

In this demo, I assume leanweb is installed as a global tool by running

```
npm i leanweb -g
```

### `leanweb init` or `lw init`

Create a directory called `demo` for this demo project.

```bash
$ mkdir demo
$ cd demo
demo$ lw init
demo$
```

Now a `src/` directory are created at the project root. `src/leanweb.json`
looks like:

```json
{
  "name": "demo",
  "version": "0.4.5",
  "components": ["root"],
  "resources": ["resources/"]
}
```

which suggests a root web component `demo-root` is created. In `src/` directory,
an `index.html`, an empty `demo.scss` and an empty `global-styles.scss` files
are created, in `global-styles.scss` we can add global styles. `demo-root` web
component directory is created at `src/components/root/`. There are 3 files in
this directory:

- root.html
- root.js
- root.scss

`root.html`

```html
<div>demo-root works!</div>
```

`root.js` defines your new web component `demo-root`, which is a web component
based on standard DOM api.
`root.js`

```javascript
import LWElement from "~/src/lib/lw-element.js";
import ast from "./ast.js";

customElements.define('f-root',
  class extends LWElement { // LWElement extends HTMLElement
    constructor() {
      super(ast);
    }
  }
);
```

`root.scss` is empty, which is for you to add web component specific styles.

### `leanweb serve` or `lw serve`

Run `lw serve` and you should see a browser window open. Try make some
changes in the code, and save, the browser should refresh automatically to
reflect your changes.
<img src='https://leanweb.app/images/leanweb-serve.png' alt='lw serve' width='640'/>

### `leanweb electron` or `lw electron`

Run `lw electron` or even `lw elec` and you should see an electron app window
open as follows:

<img src='https://leanweb.app/images/leanweb-electron.png' alt='lw electron' width='640'/>

### `leanweb generate` or `lw generate`

Let's create a `login` web component with `lw generate` or `lw g`.

```bash
demo$ lw g login
demo$
```

Now the `leanweb.json` has one more entry in the component list:

```json
{
  "name": "demo",
  "version": "0.4.5",
  "components": ["root", "login"],
  "resources": ["resources/"]
}
```

`demo-login` is the newly generated web component. The web component name is
prefixed with project name `demo-`. Inside `src/components/`, a new web
component directory `login` is created containing 3 files:

- login.html
- login.js
- login.scss

Now let's make two changes, first open up `src/components/root/root.html`, and
add a new line `<demo-login></demo-login>`. The new `root.html` should look
like the following after the change:

```html
<div>demo-root works!</div>
<demo-login></demo-login>
```

Then open up `src/components/login/login.scss`, and add the following style:

```scss
div {
  color: red;
}
```

And you should see the changes in the browser. Please note the styles added to
the `login` component does not affect other components.

<img src='https://leanweb.app/images/leanweb-serve-1.png' alt='lw serve' width='640'/>

Run `lw electron` again, and you will see the same changes reflected in
the electron app.

<img src='https://leanweb.app/images/leanweb-electron-1.png' alt='lw electron' width='640'/>

### `leanweb dist` or `lw dist`

Run `lw dist`, and a `dist` directory will be created with minified files
for production.

### `leanweb clean` or `lw clean`

`lw clean` will delete `build/` and `dist/` directories.

### `leanweb upgrade` or `lw u`

`lw upgrade` will upgrade `src/lib/` directory if there is a new version
available.

### `leanweb destroy` or `lw destroy`

`lw destroy project-name` will remove the `src/`, `build/` and `dist/`
directory. Please note the `src/` directory will be deleted by this command.

### `leanweb help` or `lw help`

`lw help command-name` will print help information for the command. For
example, `lw help dist` or `lw h di` will print help information for
`lean dist`.

### `leanweb version` or `lw version`

`lw version` will print version information.

## lw directives

### lw

Contents inside a tag with `lw` directive are considered expressions that will
be evaluated. In the example below, the `<span lw>name</span>` will be
evaluated as `<span>Leanweb</span>`, because the variable `name` is defined
in the web component js file with the value `Leanweb`.

```html
Hello <span lw>name</span>!
```

```javascript
// ...
name = "Leanweb";
// ...
```

```
Hello Leanweb!
```

### lw-if

```html
<span lw-if='name==="Leanweb"'>Leanweb</span>
```

The `span` DOM node will be shown if `name==="Leanweb"` will evaluate true,
otherwise, it will not be shown.

### lw-for

The following example shows how `lw-for` directive helps to generate DOM nodes
for each `item` in the `items` array.

```html
<div lw lw-for="item, $index in items">$index+': '+item</div>
```

```javascript
// ...
items = ["one", "two", "three"];
// ...
```

```
0: one
1: two
2: three
```

### lw-model and lw-on:

```html
<input type="text" lw-model="name" />
<span lw>name</span>
<br />
<button lw-on:click="resetName()">Reset Name</button>
```

```javascript
// ...
resetName() {
  this.name = 'Leanweb';
}
// ...
```

<img src='https://leanweb.app/images/lw-model.gif' alt='lw-model'/>

### lw-class:

```html
<div lw lw-for="item, $index in items" lw-class:active="isActive($index)">
  item
</div>
```

```javascript
// ...
items = ['one', 'two', 'three'];
isActive(index) {
  return index === 1;
}
// ...
```

```scss
.active {
  color: red;
}
```

<img src='https://leanweb.app/images/lw-class.png' alt='lw-class' width='640'/>

### lw-bind:

```html
<img lw-bind:src="imgSrc" lw-bind:width="imageWidth" />
```

```javascript
// ...
imgSrc = "https://leanweb.app/images/az.gif";
imageWidth = 400;
// ...
```

<img src='https://leanweb.app/images/lw-bind.png' alt='lw-bind' width='640'/>

### lw-input:

`lw-input` is used to pass and share data from parent to children.

`demo-parent.html`

```html
<demo-child lw-input:userData="user"></demo-child>
```

`demo-parent.js`

```javascript
// ...
user = { firstname: "Qian", lastname: "Chen" };
// ...
```

The child is able to access the `user` object passed in with `lw-input:`
directive from `inputReady()` method.
`demo-child.js`

```javascript
// ...
inputReady() {
  console.log(this.userData);
}
// ...
```

## Form Binding

Here is a few examples how Leanweb helps web components work with form binding.

### Checkbox

```javascript
// ...
items = ['one', 'two', 'three'];
toggleCheckboxes() {
  if (this.checkedValues.length) {
    this.checkedValues.length = 0;
  } else {
    this.checkedValues = [...this.items];
  }
}
checkedValues = [];
// ...
```

```html
<button lw-on:click="toggleCheckboxes()">Toggle Checkboxes</button>
<div lw-for="item, $index in items">
  <input type="checkbox" lw-bind:value="item" lw-model="checkedValues" />
  <span lw>item</span>
</div>
<span lw>checkedValues</span>
```

<img src='https://leanweb.app/images/leanweb-form-binding-checkbox.gif' alt='Leanweb Form Binding Checkbox'/>

### Select

```javascript
// ...
items = ['one', 'two', 'three'];
selectTwo() {
   this.selectedOption = 'two';
}
selectedOption;
// ...
```

```html
<button lw-on:click="selectTwo()">Select Two</button>
<div>
  <select lw-model="selectedOption">
    <option lw lw-for="item, $index in items">item</option>
  </select>
</div>
<span lw> selectedOption </span>
```

<img src='https://leanweb.app/images/leanweb-form-binding-select.gif' alt='Leanweb Form Binding Select' />

### Multiple Select

```javascript
// ...
items = ['one', 'two', 'three'];
toggleAllOptions() {
  if (this.selectedOptions.length) {
    this.selectedOptions.length = 0;
  } else {
    this.selectedOptions = [...this.items];
  }
}
selectedOptions = [];
// ...
```

```html
<button lw-on:click="toggleAllOptions()">Toggle All</button>
<div>
  <select lw-model="selectedOptions" multiple>
    <option lw lw-for="item, $index in items">item</option>
  </select>
</div>
<span lw> selectedOptions </span>
```

<img src='https://leanweb.app/images/leanweb-form-binding-multiple-select.gif' alt='Leanweb Form Binding Multiple Select' />

### Radio Button

```javascript
// ...
items = ['one', 'two', 'three'];
chooseTwo() {
  this.picked = 'two';
}
picked;
// ...
```

```html
<button lw-on:click="chooseTwo()">Choose Two</button>
<div lw-for="item, $index in items">
  <input
    type="radio"
    name="pickOne"
    lw-bind:value="item"
    lw-model="picked"
  /><span lw>item</span>
</div>
<span lw>picked</span>
```

<img src='https://leanweb.app/images/leanweb-form-binding-radio-button.gif' alt='Leanweb Form Binding Radio Button' />

### Range

```javascript
// ...
selectRange50() {
  this.selectedRange = 50;
}
selectedRange = 10;
// ...
```

```html
<button lw-on:click="selectRange50()">Select Range 50</button> <br />
<input type="range" lw-model="selectedRange" />
<span lw>selectedRange</span>
```

<img src='https://leanweb.app/images/leanweb-form-binding-range.gif' alt='Leanweb Form Binding Range' />

## Import libraries from `node_modules`

Assuming npm module `lodash-es` is installed, you could use any of the
following `import` statements for your web component class:

```javascript
import { get } from "lodash-es"; // find from node_modules
import get from "lodash-es/get.js"; // find from node_modules
import get from "./../../../node_modules/lodash-es/get.js"; // find from path as is
import * as _ from "lodash-es"; // find from node_modules
```

As a shortcut, you could import files relative to project root with `~/`:

```javascript
import { something } from "~/src/some-js-file.js"; // relative to project root
```

Importing a JSON file:
```javascript
import someJSON from "./some.json";
```

Importing CSS/SCSS:
```javascript
import agate from 'highlight.js/scss/agate.scss';

// customElements.define('demo-root',
//  class extends LWElement {  // LWElement extends HTMLElement
//    constructor() {
//      super(ast);
        super.applyStyles(agate);
//    }
//  }
//);

```

assuming `some-js-file.js` exists in the project `src/` directory.

## Component Communication

The following project demonstrates how Leanweb helps web components to talk to
each other.

<img src='https://leanweb.app/images/leanweb-pub-sub.gif' alt='Leanweb Component Communication'/>

`pub.js`

```javascript
// import LWElement from './../../../lib/lw-element.js';
// import ast from './ast.js';

// customElements.define(component.id,
//   class extends LWElement {  // LWElement extends HTMLElement
//     constructor() {
//       super(ast);

         setInterval(() => {
           this.time = new Date(Date.now()).toLocaleString();
           LWElement.eventBus.dispatchEvent("time", this.time);
           this.update();
         }, 1000);

//     }
//   }
// );
```

`pub.html`

```html
<div class="pub">
  <span>Time Publisher</span>
  <span lw>time</span>
</div>
```

`sub.js`

```javascript
// import LWElement from './../../../lib/lw-element.js';
// import ast from './ast.js';

// customElements.define(component.id,
//   class extends LWElement {  // LWElement extends HTMLElement
//     constructor() {
//       super(ast);
//     }

       sub() {
         this.listener = LWElement.eventBus.addEventListener('time', event => {
           this.time = event.data;
           this.update();
         });
         this.subscribed = true;
       }

       unsub() {
         LWElement.eventBus.removeEventListener(this.listener);
         this.subscribed = false;
       }
//   }
// );
```

`sub.html`

```html
<div class="sub">
  <span>Time Subscriber</span>
  <span lw>time</span>
  <div class="buttons">
    <button lw-bind:disabled="subscribed" lw-on:click="sub()">
      Subscribe Time
    </button>
    <button lw-bind:disabled="!subscribed" lw-on:click="unsub()">
      UnSubscribe Time
    </button>
  </div>
</div>
```

Source code of this demo https://github.com/elgs/leanweb-pub-sub-demo.

## API

### LWElement

`LWElement` extends `HTMLElement`, and Leanweb components extend `LWElement`.
So Leanweb components are just more specific versions of the stand
`HTMLElement`. `LWElement` helps to wire up the `lw` directives in the HTML and
provides some convenient methods to update the DOM.

#### LWElement.update(rootNode = this.shadowRoot)

The `update` method provides a convenient way to update the DOM when the model
changes. You should feel free to use old way to update DOM. The `update` just
makes life a little easier. `update` takes `rootNode` as parameter, which
allows you to specify which DOM element to start with. The default value is
the current`shadowRoot`.

LWElement will call update in the following scenarios:

1. after all `lw` directives are initially bound to DOM;
2. after `lw-on:` event is fired;
3. after `lw-model` change is fired;

You may need to call the `update()` method manually in other events. For
example:

1. in your setTimeout/setInterval callbacks;
2. in `LWEventBus` callbacks;
3. in any network api callbacks;

#### LWElement.domReady()

`domReady()` will be called after all initial DOM events are bound, and all
DOM interpolations are evaluated. This method is meant to be overridden and is a
great place to send events to the event bus.

#### LWElement.inputReady()

`inputReady()` will be called after all input data from parent's `lw-input:` is
ready. In this method, children are able to access the passed in data shared
by parents.

#### LWElement.applyStyles(styles)
`applyStyles` will apply the styles that is imported from a css or scss into
the web component DOM.

### LWEventBus

`LWElement` comes with an instance of `LWEventBus` that helps web components to
talk to each other by sending and receiving events and data. You could use your
own way for component communication. `LWEventBus` is however a choice for you.

#### LWEventBus.addEventListener(eventName, callback)

You can use `LWElement.eventBus` to get the instance of event bus, and use
`LWElement.eventBus.addEventListener(eventName, callback)` to subscribe to a
type of event from the event bus. `addEventListener` takes two parameters. The
first `eventName` is the name of the event, and the second `callback` is a
function that will get called when a event is sent to the event bus. The
`callback` function takes a parameter `event`, which contains `eventName`
and `data` fields. `addEventListener` returns the eventListener instance
being added, which could be passed in `removeEventListener` as parameter.

#### LWEventBus.removeEventListener(listener)

`removeEventListener` removes the listener from the event bus, so it stops
being notified when a next event is fired.

#### LWEventBus.dispatchEvent(eventName, data = null)

`dispatchEvent` is used to send an event to the event bus. It takes two
parameter. `eventName` is the name of the event, and `data` is the payload data
of the event.

## More examples and tutorials

https://leanweb.app
