import { execSync } from 'child_process';
import path from 'path';
import net from 'net';
import fs from 'fs';
import fse from 'fs-extra';

export const dirs = {
  src: 'src',
  build: 'build',
  dist: 'dist',
};

export const copyFilter = (src, dest) => {
  const srcStats = fse.existsSync(src) && fse.lstatSync(src);
  const destStats = fse.existsSync(dest) && fse.lstatSync(dest);
  if (srcStats?.isFile?.() && destStats?.isFile?.()) {
    const srcBuf = fs.readFileSync(src);
    const destBuf = fs.readFileSync(dest);
    if (srcBuf.equals(destBuf)) {
      return false;
    }
  }
  return !destStats?.isSymbolicLink?.();
};

export const writeIfChanged = (file, string) => {
  const stats = fse.existsSync(file) && fse.lstatSync(file);
  if (stats?.isFile?.()) {
    const data = fs.readFileSync(file, 'utf8');
    if (data === string) {
      return;
    }
  }
  fs.writeFileSync(file, string);
};

export const exec = command => execSync(command, { encoding: 'utf8', stdio: 'inherit' });

export const getComponentName = cmp => {
  const indexOfLastSlash = cmp.lastIndexOf('/');
  if (indexOfLastSlash > -1) {
    return cmp.substring(indexOfLastSlash + 1);
  }
  return cmp;
};

export const getComponentPath = cmp => {
  const indexOfLastSlash = cmp.lastIndexOf('/');
  if (indexOfLastSlash > -1) {
    return cmp.substring(0, indexOfLastSlash);
  }
  return '';
};

export const getPathLevels = filePath => {
  filePath = path.normalize(filePath);
  const numSlashes = filePath.replace(/[^\/]/g, '').length;
  let ret = '';
  for (let i = 0; i < numSlashes; ++i) {
    ret += '../';
  }
  return ret;
};

export const throttle = (callback, limit = 100) => {
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

export const portInUse = (port, address = '127.0.0.1') => {
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
root.css

Under src/ directory, global-styles.css is created for global styling.
`;

const generateNote = `Usage: leanweb generate component-names
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
login.css

Now, the demo-login component can be added in root.html as follows:
<demo-login></demo-login>
`;

const addpageNote = `Usage: leanweb addpage page-names`;

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

export const targets = {
  'init': { file: 'init.js', note: initNote },
  'addpage': { file: 'addpage.js', note: addpageNote },
  'generate': { file: 'generate.js', note: generateNote },
  'serve': { file: 'serve.js', note: serveNote },
  'build': { file: 'build.js', note: buildNote },
  'dist': { file: 'dist.js', note: distNote },
  'upgrade': { file: 'upgrade.js', note: upgradeNote },
  'clean': { file: 'clean.js', note: cleanNote },
  'destroy': { file: 'destroy.js', note: destroyNote },
  'help': { file: 'help.js', note: helpNote },
  'version': { file: 'version.js', note: versionNote },
};