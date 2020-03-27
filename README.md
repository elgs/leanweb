# leanweb
A set of tools (as opposed to framework) to generate web components based web 
project.

## Installation
* `npm install leanweb -g` as a global tool, or
* `npm install leanweb -D` in the project as a dev dependency.

If leanweb is installed as a dev dependency, you will need to run 
`npx lw`, otherwise just run `lw` if it is installed as global tool.

I don't see any reason leanweb should be installed as `npm install leanweb`.

## Background
I like the idea in Angular that 3 files (html/js/scss) as a component are in
charge of a box, like a div, a rectangle area. But I don't like Angular in that
my code has to be depending on so many bloated dependencies to run. I created
leanweb as a set of tools to help create web components based web projects,
which:
* are assistive, not restrictive
* are based on native DOM and web components api
* are built to last

The principle is simply that 3 files (html/js/scss) as a web component will
control a box.

## Getting started
In this demo, I assume leanweb is installed as a global tool by running
```
npm i leanweb -g
```

### `leanweb` init or `lw init`
Create a directory called `demo` for this demo project.
```bash
$ mkdir demo
$ cd demo
demo$ npm init -y # create package.json, skip this step if it's done before
demo$ lw init
demo$
```

Now a `leanweb.json` file and a `src/` directory are created at the project
root. `leanweb.json` looks like:
```json
{
  "name": "demo",
  "components": [
    "root"
  ]
}
```
which suggests a root web component `demo-root` is created. In `src/` directory, 
an `index.html` an empty `demo.scss` files are created, in `demo.scss` we can add
global styles. `demo-root` web component directory is created at 
`src/components/root/`. There are 3 files in this directory:

* root.html
* root.js
* root.scss 

`root.html`
```html
<slot></slot>
<div>demo-root works!</div>
```

`root.js`
```javascript
import LWElement from './../../lib/lw-element.js';
import interpolation from './interpolation.js';

const component = { id: 'demo-root', interpolation };
customElements.define(component.id,
   class extends LWElement {  // LWElement extends HTMLElement
      constructor() {
         super(component);
      }

      name = component.id;

      // connectedCallback() {
      //    console.log(this.isConnected);
      //    console.log('Element added to page.');
      // }

      // disconnectedCallback() {
      //    console.log('Element removed from page.');
      // }

      // adoptedCallback() {
      //    console.log('Element moved to new page.');
      // }

      // static get observedAttributes() {
      //    return [];
      // }

      // attributeChangedCallback(name, oldValue, newValue) {
      //    console.log(name, oldValue, newValue);
      // }
   }
);
```

`root.scss` is empty, which is for you to add web component specific styles.


### `leanweb serve` or `lw serve`
Run `lw serve` and you should see a browser window open. Try make some 
changes in the code, and save, the browser should refresh automatically to 
reflect your changes.
<img src='https://leanweb.app/leanweb-serve.png' alt='lw serve' width='640'/>


### `leanweb electron` or `lw electron`
Run `lw electron` or even `lw elec` and you should see an electron app window
open as follows:

<img src='https://leanweb.app/leanweb-electron.png' alt='lw electron' width='640'/>


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
  "components": [
    "root",
    "login"
  ]
}
```
`demo-login` is the newly generated web component. The web component name is
prefixed with project name `demo-`. Inside `src/components/`, a new web 
component directory `login` is created containing 3 files:
* login.html
* login.js
* login.scss


Now let's make two changes, first open up `src/components/root/root.html`, and
add a new line `<demo-login></demo-login>`. The new `root.html` should look 
like the following after the change:

```html
<slot></slot>
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

<img src='https://leanweb.app/leanweb-serve-1.png' alt='lw serve' width='640'/>

Run `lw electron` again, and you will see the same changes reflected in 
the electron app.

<img src='https://leanweb.app/leanweb-electron-1.png' alt='lw electron' width='640'/>

### `leanweb dist` or `lw dist`
Run `lw dist`, and a `dist` directory will be created with minified files
for production.

### `leanweb clean` or `lw clean`
`lw clean` will delete `build/` and `dist/` directories.

### `leanweb destroy` or `lw destroy`
`lw destrory project-name` will remove the `leanweb.json` file, `src/`, 
`build/` and `dist/` directory. Please note the `src/` directory will be 
deleted by this command.

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
// const component = { id: 'demo-root', interpolation };
// customElements.define(component.id,
//    class extends LWElement {  // LWElement extends HTMLElement
//       constructor() {
//          super(component);
//       }
         name = 'Leanweb';
//    }
// );

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
// const component = { id: 'demo-root', interpolation };
// customElements.define(component.id,
//    class extends LWElement {  // LWElement extends HTMLElement
//       constructor() {
//          super(component);
//       }
         items = ['one', 'two', 'three'];
//    }
// );
```
```
0: one
1: two
2: three
```

### lw-model and lw-on:
```html
<input type="text" lw-model="name">
<span lw>name</span>
<br>
<button lw-on:click="resetName()"> Reset Name </button>
```
```javascript
// const component = { id: 'demo-root', interpolation };
// customElements.define(component.id,
//    class extends LWElement {  // LWElement extends HTMLElement
//       constructor() {
//          super(component);
//       }
         resetName() {
            this.name = 'Leanweb';
            this.update();
         }
//    }
// );
```
<img src='https://leanweb.app/lw-model.gif' alt='lw-model' width='640'/>

### lw-class:
```html
<div lw lw-for='item, $index in items' lw-class:active='isActive($index)'>item</div>
```
```javascript
// const component = { id: 'demo-root', interpolation };
// customElements.define(component.id,
//    class extends LWElement {  // LWElement extends HTMLElement
//       constructor() {
//          super(component);
//       }
         items = ['one', 'two', 'three'];
         isActive(index) {
            return index === 1;
         }
//    }
// );
```
<img src='https://leanweb.app/lw-active.png' alt='lw-active' width='640'/>

### lw-bind:
```html
<img lw-bind:src='imgSrc' lw-bind:width='imageWidth'>
```
```javascript
// const component = { id: 'demo-root', interpolation };
// customElements.define(component.id,
//    class extends LWElement {  // LWElement extends HTMLElement
//       constructor() {
//          super(component);
//       }
         imgSrc = 'https://leanweb.app/az.gif';
         imageWidth = 480;
//    }
// );
```
<img src='https://leanweb.app/lw-bind.png' alt='lw-bind' width='640'/>

## More examples and tutorials
https://leanweb.app