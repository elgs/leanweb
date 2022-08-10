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
      const isMain = process.cwd() === projectPath;

      const buildDir = isMain ? utils.dirs.build : `${utils.dirs.build}/_dependencies/${project.name}`;
      fs.mkdirSync(buildDir, { recursive: true });

      let depImports = '';
      project.imports?.forEach(im => {
         let depPath;
         if (im.indexOf('/') < 0) {
            depPath = `${process.cwd()}/node_modules/${im}`;
         } else {
            if (im.startsWith('./')) {
               depPath = `${process.cwd()}/${im}`;
            } else if (im.startsWith('/')) {
               depPath = im;
            } else {
               depPath = `${process.cwd()}/node_modules/${im}`;
            }
         }
         const depName = buildModule(depPath);
         if (isMain) {
            depImports += `import './_dependencies/${depName}/${depName}.js';\n`;
         } else {
            depImports += `import '../${depName}/${depName}.js';\n`;
         }

      });

      const copySrc = () => {
         fse.copySync(`${projectPath}/${utils.dirs.src}/`, buildDir, { filter: utils.copySymbolLinkFilter });
      };

      const copyEnv = () => {
         if (env) {
            fse.copySync(`${buildDir}/env/${env}.js`, `${buildDir}/env.js`);
         }
      };

      const buildJS = () => {
         const jsString = project.components.reduce((acc, cur) => {
            const cmpName = utils.getComponentName(cur);
            let importString = `import './components/${cur}/${cmpName}.js';`;
            return acc + importString + '\n';
         }, depImports + '\n');
         fs.writeFileSync(`${buildDir}/${project.name}.js`, jsString);
      };

      const buildHTML = () => {
         project.components.forEach(cmp => {
            const cmpName = utils.getComponentName(cmp);
            const htmlFilename = `${buildDir}/components/${cmp}/${cmpName}.html`;
            const htmlFileExists = fs.existsSync(htmlFilename);
            if (htmlFileExists) {

               const scssFilename = `${buildDir}/components/${cmp}/${cmpName}.scss`;
               const scssFileExists = fs.existsSync(scssFilename);
               let cssString = '';
               if (scssFileExists) {
                  let scssString = `@use "global-styles.scss";\n`;
                  scssString += fs.readFileSync(scssFilename, 'utf8');
                  scssString += '\n[lw-false],[lw-for]{display:none !important;}\n';
                  cssString = utils.buildCSS(scssString, buildDir, `${buildDir}/components/${cmp}`);
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
               fs.writeFileSync(`${buildDir}/components/${cmp}/ast.js`, `export default ${JSON.stringify(ast, null, 0)};`);
            }
         });
         const htmlString = fs.readFileSync(`${buildDir}/index.html`, 'utf8');
         fs.writeFileSync(`${buildDir}/index.html`, htmlString);
      };

      const buildSCSS = () => {
         const projectScssFilename = `${projectPath}/${utils.dirs.src}/${project.name}.scss`;
         let projectCssString = '';
         if (fs.existsSync(projectScssFilename)) {
            const projectScssString = fs.readFileSync(projectScssFilename, 'utf8');
            projectCssString += utils.buildCSS(projectScssString, buildDir);
         }
         fs.writeFileSync(`${buildDir}/${project.name}.css`, projectCssString);
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