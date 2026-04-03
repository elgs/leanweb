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

  const useShadowDom = project.shadowDom ?? false;

  const buildJS = () => {
    const prefix = useShadowDom ? `import './global-styles.js';\n` : `globalThis.leanweb ??= {};\n`;
    const jsString = project.components.reduce((acc, cur) => {
      const cmpName = utils.getComponentName(cur);
      let importString = `import './components/${cur}/${cmpName}.js';`;
      return acc + importString + '\n';
    }, prefix);
    utils.writeIfChanged(`${utils.dirs.build}/${project.name}.js`, jsString);
  };

  const buildGlobalStyles = () => {
    const globalCssPath = `${utils.dirs.build}/global-styles.css`;
    const globalCss = fs.existsSync(globalCssPath) ? fs.readFileSync(globalCssPath, 'utf8') : '';

    // Strip CSS comments, then extract @import statements and create a JS module that sets up the global styles
    const imports = [];
    const uncommented = globalCss.replace(/\/\*[\s\S]*?\*\//g, '');
    const inlineCss = uncommented.replace(/@import\s+(?:url\()?['"]?([^'"\)]+)['"]?\)?[^;]*;/g, (_, url) => {
      imports.push(url);
      return '';
    });
    const jsModule = `globalThis.leanweb ??= {};\nconst sheet = new CSSStyleSheet();\nsheet.replaceSync(${JSON.stringify(inlineCss)});\nglobalThis.leanweb.__lw_globalStyleSheet = sheet;\nglobalThis.leanweb.__lw_globalStyleImports = ${JSON.stringify(imports)};\n`;
    utils.writeIfChanged(`${utils.dirs.build}/global-styles.js`, jsModule);
  };

  const buildHTML = () => {
    try {
      project.components.forEach(cmp => {
        const cmpName = utils.getComponentName(cmp);
        const htmlFilename = `${utils.dirs.build}/components/${cmp}/${cmpName}.html`;
        const htmlFileExists = fs.existsSync(htmlFilename);
        if (htmlFileExists) {
          const cssFilename = `${utils.dirs.build}/components/${cmp}/${cmpName}.css`;
          const cssFileExists = fs.existsSync(cssFilename);
          let cssString = '';
          if (cssFileExists) {
            cssString += fs.readFileSync(cssFilename, 'utf8');
          }
          cssString += '\n[lw-false],[lw-for]{display:none !important;}\n';
          const componentFullName = project.name + '-' + cmp.replace(/\//g, '-');
          if (!useShadowDom) {
            cssString = cssString.replace(/:host\(([^)]*)\)/g, '&$1').replace(/:host/g, '&');
            cssString = `${componentFullName} {\n${cssString}\n}\n`;
          }
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
          ast.componentFullName = componentFullName;
          ast.shadowDom = useShadowDom;
          ast.runtimeVersion = project.version;
          ast.builderVersion = leanwebPackageJSON.version;
          utils.writeIfChanged(`${utils.dirs.build}/components/${cmp}/ast.js`, `export default ${JSON.stringify(ast, null, 0)};`);
        }
      });
    } catch (e) {
      console.error('Error in buildHTML:', e);
    }
  };

  copySrc();
  copyEnv();
  buildJS();
  if (useShadowDom) {
    buildGlobalStyles();
  }
  buildHTML();

  return project.name;
};

buildModule(process.cwd());
