# leanweb
Tool set for generating web components based web project.

## Installation

* `npm install leanweb -g` as a global tool, or
* `npm install leanweb -D` in the project as a dev dependency.

If leanweb is installed as a dev dependency of the project, you will need to
run `npx leanweb`, otherwise just run `leanweb` if it is installed as global
tool.

I don't see any reason leanweb should be installed as `npm install leanweb`.

## Background

I like the idea in Angular that 3 files (html/js/scss) as a component are be in
charge of a box, like a div, a rectangle area. But I don't like Angular in that
my code has to be depending on so many bloated dependencies to run. I created
leanweb as a set of tools to help me create web components based web projects,
which:
* come with zero dependency
* are based on native web components api
* are built to last

The principle is simply that 3 files (html/js/scss) as a web component will
control a box.

## Getting started

In this demo, I assume leanweb is installed as a global tool by running
```
npm i leanweb -g
```

### leanweb init

Create a directory called `demo` for this demo project.
```bash
$ mkdir demo
$ cd demo
demo$ leanweb init
demo$
```

Now a `leanweb.json` file and a `src/` directory are created at the project
root. `leanweb.json` looks like:
```json
{
  "name": "demo",
  "title": "demo",
  "components": [
    "demo-root"
  ]
}
```
which suggests a root web component `demo-root` is created by `leanweb init`.
In `src/` directory, an empty `demo.scss` file is created, in which we can add
global styling scss code. `demo-root` web component directory is created at
`src/components/demo-root/`. There are 3 files in this directory:

* demo-root.html
* demo-root.js
* demo-root.scss 

`demo-root.html`
```html
<span>root works</span>
```

`demo-root.js`
```javascript
customElements.define('demo-root',
  class extends HTMLElement {
    constructor() {
      super();

      const templateNode = document.querySelector('#demo-root').content.cloneNode(true);
      // attach to shadow dom
      this.attachShadow({ mode: 'open' }).appendChild(templateNode);
      // attach to normal dom
      // this.appendChild(templateNode);
    }

    // connectedCallback() {
    //   console.log(this.isConnected);
    //   console.log('Element added to page.');
    // }

    // disconnectedCallback() {
    //   console.log('Element removed from page.');
    // }

    // adoptedCallback() {
    //   console.log('Element moved to new page.');
    // }

    // static get observedAttributes() {
    //   return [];
    // }

    // attributeChangedCallback(name, oldValue, newValue) {
    //   console.log(name, oldValue, newValue);
    // }
  }
);
```

`demo-root.scss` is empty.

Now if you run `leanweb build` or `leanweb b`, a `build/` directory will be
created. There will be 3 files inside:
* index.html
* demo.js
* demo.css

If you deploy these 3 files to a web server, you should see `root works` in
browser.

### leanweb generate

Let's create a `login` web component with `leanweb generate` or `leanweb g`.
```bash
demo$ leanweb g login
demo$
```

Now the `leabweb.json` has one more entry in the component list:
```json
{
  "name": "demo",
  "title": "demo",
  "components": [
    "demo-root",
    "demo-login"
  ]
}
```
`demo-login` is the newly generated web component. The web component name is
prefixed with project name `demo`. Inside `src/components/`, a new web
web component directory `demo-login` is created containing 3 files:
* demo-login.html
* demo-login.js
* demo-login.scss

### leanweb build

Let's open `src/components/demo-root/demo-root.html`, which previously looks 
like:
```html
<span>root works</span>
```

Now let's add one line to this file:
```html
<span>root works</span>
<demo-login></demo-login>
```

then run:
```bash
demo$ leanweb build
```

You should see `root works login works` in the browser.