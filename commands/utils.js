const { execSync } = require('child_process');
const sass = require('node-sass');

module.exports.exec = command => execSync(command, { encoding: 'utf8', stdio: 'inherit' });

module.exports.buildCSS = scssString => {
   if (scssString.trim()) {
      const cssResult = sass.renderSync({ data: scssString });
      return cssResult.css.toString().trim();
   }
   return '';
};

module.exports.getComponentName = cmp => {
   const indexOfLastSlash = cmp.lastIndexOf('/');
   if (indexOfLastSlash > -1) {
      return cmp.substring(indexOfLastSlash + 1);
   }
   return cmp;
};

module.exports.getPathLevels = cmp => {
   const numSlashes = cmp.replace(/[^\/]/g, "").length;
   let ret = '';
   for (let i = 0; i < numSlashes; ++i) {
      ret += '../';
   }
   return ret;
};

module.exports.throttle = (callback, limit = 1000) => {
   let wait = false;
   return function () {
      if (!wait) {
         callback.apply(null, arguments);
         wait = true;
         setTimeout(() => {
            wait = false;
         }, limit);
      }
   };
};

const initNote = `Usage: leanweb init or leanweb init project-name
leanweb init will initialize a leanweb project with the name of the current
working directory, otherwise, if a project-name is provided, the provided
project-name will be used as the leanweb project name.

leanweb init command will create leanweb.json file, which looks like:
{
  "name": "demo",
  "components": [
    "demo-root",
  ]
}
where demo is the project name.

A src directory will be created, and the top level web component demo-root
will be created. demo-root web component contains 3 files:

demo-root.html
demo-root.js
demo-root.scss

Under src directory, demo.scss is created for global styling. global styling
will note affect web components styling if they are attached to shadow DOMs.
`;

const generateNote = `Usage: leanweb generate component-name
For example leanweb g login will create demo-login web component in
src/components directory. The leanweb.json will be updated to look like:

{
  "name": "demo",
  "title": "demo",
  "components": [
    "demo-root",
    "demo-login"
  ]
}

demo-login web component will contain 3 files:

demo-login.html
demo-login.js
demo-login.scss

Now, the demo-login component can be added in demo-root.html as follows:
<demo-login></demo-login>
`;

const serveNote = ``;

const buildNote = `Usage: leanweb build
This will create a build directory in which js files for all components will be
copied over to, plus index.html, $project-name.js and $project-name.css.

index.html
demo.js
demo.css
demo-root.js
demo-login.js
`;

const distNote = `Usage: leanweb dist
This will create a dist directory in which 3 files will be created:

index.html
demo.js
demo.css

These 3 files could be deployed to a web server.
`;

const cleanNote = `Usage: leanweb clean
This will remove the build and dist directory.
`;

const destroyNote = `Usage leanweb destroy project-name
This will remove the leanweb.json file, src, build and dist directory. Please
note the src directory will be deleted by this command.
`

const helpNote = `Usage: leanweb help target-name
This will show help information of each target. All target names could be
abbreviated as long as there is no ambiguity. For example:
leanweb help build is the same as leanweb h b
leanweb generate login is the same as leanweb g login
`;

const versionNote = `Usage: leanweb version
Print version information for leanweb.`;

module.exports.targets = {
   'init': { file: 'init.js', note: initNote },
   'generate': { file: 'generate.js', note: generateNote },
   'serve': { file: 'serve.js', daemon: true, note: serveNote },
   'build': { file: 'build.js', note: buildNote },
   'dist': { file: 'dist.js', note: distNote },
   'clean': { file: 'clean.js', note: cleanNote },
   'destroy': { file: 'destroy.js', note: destroyNote },
   'help': { file: 'help.js', note: helpNote },
   'version': { file: 'version.js', note: versionNote },
};