const { execSync } = require('child_process');
const sass = require('sass');
const path = require('path');
const net = require('net');

const dirs = {
   src: 'src',
   build: 'build',
   serve: 'serve',
   dist: 'dist',
   electron: 'electron',
};

module.exports.exec = command => execSync(command, { encoding: 'utf8', stdio: 'inherit' });

module.exports.buildCSS = (scssString, currentPaths) => {
   if (scssString.trim()) {
      const includePaths = [currentPaths, path.resolve(process.cwd(), dirs.build), path.resolve(process.cwd(), 'node_modules')];
      const cssResult = sass.renderSync({ data: scssString, includePaths });
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

module.exports.getPathLevels = filePath => {
   filePath = path.normalize(filePath);
   const numSlashes = filePath.replace(/[^\/]/g, '').length;
   let ret = '';
   for (let i = 0; i < numSlashes; ++i) {
      ret += '../';
   }
   return ret;
};

module.exports.throttle = (callback, limit = 100) => {
   let wait = false;
   return function () {
      if (!wait) {
         wait = true;
         setTimeout(() => {
            wait = false;
            callback.apply(null, arguments);
         }, limit);
      }
   };
};

module.exports.getWebPackConfig = (outputDir, project) => {
   return {
      entry: process.cwd() + `/${dirs.build}/${project.name}.js`,
      output: {
         path: process.cwd() + `/${outputDir}/`,
         filename: `${project.name}.js`,
      },
      module: {
         rules: [{
            test: path.resolve(process.cwd()),
            exclude: /node_modules/,
            loader: require.resolve('babel-loader'),
            options: {
               presets: [require.resolve('@babel/preset-env'), {
                  plugins: [
                     // '@babel/plugin-proposal-class-properties',
                     '@babel/plugin-transform-runtime'
                  ].map(require.resolve)
               }]
            },
         }, {
            test: /\.(scss|sass)$/i,
            use: [
               {
                  loader: require.resolve('css-loader'),
               },
               {
                  loader: require.resolve('sass-loader'),
                  options: {
                     sassOptions: {
                        includePaths: [path.resolve(process.cwd(), 'node_modules')],
                     }
                  }
               },
            ],
         }, {
            test: /\.json$/i,
            loader: require.resolve('json5-loader'),
            options: {
               esModule: true,
            },
            type: 'javascript/auto',
         }, {
            loader: require.resolve('raw-loader'),
            exclude: [
               /\.(js|mjs|jsx|ts|tsx)$/i,
               /\.(json|json5)$/i,
               /\.(css|scss|sass)$/i
            ],
         }]
      },
   }
};

module.exports.portInUse = (port, address = '127.0.0.1') => {
   return new Promise((resolve, reject) => {
      const server = net.createServer(socket => socket.pipe(socket));

      server.listen(port, address);
      server.on('error', e => {
         resolve(true);
      });
      server.on('listening', e => {
         server.close();
         resolve(false);
      });
   });
};

module.exports.dirs = dirs;

const initNote = `Usage: leanweb init or leanweb init project-name
leanweb init will initialize a leanweb project with the name of the current
working directory, otherwise, if a project-name is provided, the provided
project-name will be used as the leanweb project name.

leanweb init command will create src/leanweb.json file, which looks like:
{
  "name": "demo",
  "version": "0.4.5",
  "components": [
    "demo-root",
  ],
  "resources": [
   "resources/"
  ]
}
where demo is the project name.

A src/ directory will be created, and the top level web component demo-root
will be created. demo-root web component contains 3 files:

root.html
root.js
root.scss

Under src/ directory, global-styles.scss is created for global styling.
`;

const generateNote = `Usage: leanweb generate component-name
For example leanweb g login will create demo-login web component in
src/components directory. The leanweb.json will be updated to look like:

{
  "name": "demo",
  "version": "0.4.5",
  "components": [
    "root",
    "login"
  ],
  "resources": [
   "resources/"
  ]
}

demo-login web component will contain 3 files:

login.html
login.js
login.scss

Now, the demo-login component can be added in root.html as follows:
<demo-login></demo-login>
`;

const serveNote = `Usage: leabweb [env] serve or lw s [env]
Running this command will start the dev server and open the app in a new 
browser window. Any chances to the source code will cause the dev server to
reload the app and the browser will be automatically refreshed.
`;

const buildNote = `Usage: leanweb build [env]
This will build the app and the output files will be stored in the build/
directory. In this phase, the build doesn't transpile the app code. So likely
the build file will only work with latest Chrome. However, the dist will 
produce output for most desktop and mobile browsers.
`;

const distNote = `Usage: leanweb dist [env]
This will transpile the source code and produce output compatible with most
desktop and mobile browsers. The output will be stored in dist/ directory.
`;

const cleanNote = `Usage: leanweb clean
This will remove the build and dist directory.
`;

const upgradeNote = `Usage: leanweb upgrade
This will upgrade leanweb runtime in the src/lib directory.
`;

const electronNote = `Usage: leanweb electron [env]
This will run the app as native desktop app using Electron.
`;

const destroyNote = `Usage leanweb destroy project-name
This will remove the src/, build/ and dist/ directory. Please
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
   'serve': { file: 'serve.js', note: serveNote },
   'build': { file: 'build.js', note: buildNote },
   'dist': { file: 'dist.js', note: distNote },
   'upgrade': { file: 'upgrade.js', note: upgradeNote },
   'clean': { file: 'clean.js', note: cleanNote },
   'electron': { file: 'electron.js', note: electronNote },
   'destroy': { file: 'destroy.js', note: destroyNote },
   'help': { file: 'help.js', note: helpNote },
   'version': { file: 'version.js', note: versionNote },
};