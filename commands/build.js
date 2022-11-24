import fs from 'fs';
import fse from 'fs-extra';
import { minify } from 'html-minifier';
import * as utils from './utils.js';
import * as parser from '../lib/lw-html-parser.js';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { createRequire } from "module";
const require = createRequire(import.meta.url);

(async () => {
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
      fse.copySync(`${projectPath}/${utils.dirs.src}/`, utils.dirs.build, { filter: utils.copySymbolLinkFilter });
    };

    const copyEnv = () => {
      if (env) {
        fse.copySync(`${utils.dirs.build}/env/${env}.js`, `${utils.dirs.build}/env.js`);
      }
    };

    const buildJS = () => {
      const jsString = project.components.reduce((acc, cur) => {
        const cmpName = utils.getComponentName(cur);
        let importString = `import './components/${cur}/${cmpName}.js';`;
        return acc + importString + '\n';
      }, depImports + '\n');
      fs.writeFileSync(`${utils.dirs.build}/${project.name}.js`, jsString);
    };

    const buildHTML = () => {
      project.components.forEach(cmp => {
        const cmpName = utils.getComponentName(cmp);
        const htmlFilename = `${utils.dirs.build}/components/${cmp}/${cmpName}.html`;
        const htmlFileExists = fs.existsSync(htmlFilename);
        if (htmlFileExists) {

          const scssFilename = `${utils.dirs.build}/components/${cmp}/${cmpName}.scss`;
          const scssFileExists = fs.existsSync(scssFilename);
          let cssString = '';
          if (scssFileExists) {
            let scssString = `@use "global-styles.scss";\n`;
            scssString += fs.readFileSync(scssFilename, 'utf8');
            scssString += '\n[lw-false],[lw-for]{display:none !important;}\n';
            cssString = utils.buildCSS(scssString, utils.dirs.build, `${utils.dirs.build}/components/${cmp}`);
          }
          const styleString = cssString || '';
          const htmlString = fs.readFileSync(htmlFilename, 'utf8');
          const minifiedHtml = minify(htmlString, {
            caseSensitive: true,
            collapseWhitespace: true,
            minifyCSS: true,
            minifyJS: true,
            removeComments: true,
          });
          const ast = parser.parse(minifiedHtml);
          ast.css = styleString;
          ast.componentFullName = project.name + '-' + cmp.replace(/\//g, '-');
          ast.runtimeVersion = project.version;
          ast.builderVersion = leanwebPackageJSON.version;
          fs.writeFileSync(`${utils.dirs.build}/components/${cmp}/ast.js`, `export default ${JSON.stringify(ast, null, 0)};`);
        }
      });
      const htmlString = fs.readFileSync(`${utils.dirs.build}/index.html`, 'utf8');
      fs.writeFileSync(`${utils.dirs.build}/index.html`, htmlString);
    };

    const buildSCSS = () => {
      const projectScssFilename = `${projectPath}/${utils.dirs.src}/${project.name}.scss`;
      let projectCssString = '';
      if (fs.existsSync(projectScssFilename)) {
        const projectScssString = fs.readFileSync(projectScssFilename, 'utf8');
        projectCssString += utils.buildCSS(projectScssString, utils.dirs.build);
      }
      fs.writeFileSync(`${utils.dirs.build}/${project.name}.css`, projectCssString);
    };

    copySrc();
    copyEnv();
    buildJS();
    buildSCSS();
    buildHTML();

    return project.name;
  };

  buildModule(process.cwd());

})();