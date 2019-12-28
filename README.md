# leanweb
Tool set for generating web components based web project.

### Installation

* `npm install leanweb -g` as a global tool, or
* `npm install leanweb -D` in the project as a dev dependency.

If leanweb is installed as a dev dependency of the project, you will need to
run `npx leanweb`, otherwise just run `leanweb` if it is installed as global
tool.

I don't see any reason leanweb should be installed as `npm install leanweb`.

### Background

I like the idea in Angular that 3 files (html/js/scss) as a component to be in
charge of a box, like a div, a rectangle area. But I don't like Angular in that
my code has to be depending on their bloated dependencies to run. So I created
leanweb as a set of tools to help me quickly create web components based web
projects, which:
* come with zero dependency
* are based on native web components api
* are built to last

The design principle is simply that 3 files (html/js/scss) as a web component
to control a box.

### Getting started