import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createRequire } from "module";
const require = createRequire(import.meta.url);

import fs from 'fs';
import fse from 'fs-extra';
import { minify } from 'html-minifier';
import * as utils from './utils.js';
import * as parser from '../lib/lw-html-parser.js';

let env;
const args = process.argv;
if (args.length >= 3) {
  env = args[2];
}

const leanwebPackageJSON = require(`${__dirname}/../package.json`);

const buildModule = (projectPath) => {

  const project = require(`${projectPath}/${utils.dirs.src}/leanweb.json`);

  fs.mkdirSync(utils.dirs.build, { recursive: true });

  const copySrc = () => {
    fse.copySync(`${projectPath}/${utils.dirs.src}/`, utils.dirs.build, { filter: utils.copyFilter });
  };

  const copyEnv = () => {
    if (env) {
      fse.copySync(`${utils.dirs.build}/env/${env}.js`, `${utils.dirs.build}/env.js`, { filter: utils.copyFilter });
    }
  };

  const buildJS = () => {
    const jsString = project.components.reduce((acc, cur) => {
      const cmpName = utils.getComponentName(cur);
      let importString = `import './components/${cur}/${cmpName}.js';`;
      return acc + importString + '\n';
    }, '');
    utils.writeIfChanged(`${utils.dirs.build}/${project.name}.js`, jsString);
  };

  const buildHTML = () => {
    project.components.forEach(cmp => {
      const cmpName = utils.getComponentName(cmp);
      const htmlFilename = `${utils.dirs.build}/components/${cmp}/${cmpName}.html`;
      const htmlFileExists = fs.existsSync(htmlFilename);
      if (htmlFileExists) {
        const cssFilename = `${utils.dirs.build}/components/${cmp}/${cmpName}.css`;
        const cssFileExists = fs.existsSync(cssFilename);
        let cssString = `@import "global-styles.css";\n`;
        if (cssFileExists) {
          cssString += fs.readFileSync(cssFilename, 'utf8');
        }
        cssString += '\n[lw-false],[lw-for]{display:none !important;}\n';
        const htmlString = fs.readFileSync(htmlFilename, 'utf8');
        const minifiedHtml = minify(htmlString, {
          caseSensitive: true,
          collapseWhitespace: true,
          minifyCSS: true,
          minifyJS: true,
          removeComments: true,
        });
        const ast = parser.parse(minifiedHtml);
        ast.css = cssString;
        ast.componentFullName = project.name + '-' + cmp.replace(/\//g, '-');
        ast.runtimeVersion = project.version;
        ast.builderVersion = leanwebPackageJSON.version;
        utils.writeIfChanged(`${utils.dirs.build}/components/${cmp}/ast.js`, `export default ${JSON.stringify(ast, null, 0)};`);
      }
    });
  };

  copySrc();
  copyEnv();
  buildJS();
  buildHTML();

  return project.name;
};

buildModule(process.cwd());
