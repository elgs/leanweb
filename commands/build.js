(async () => {
   const fs = require('fs');
   const path = require('path');
   const fse = require('fs-extra');
   const utils = require('./utils.js');
   const parser = require('../lib/lw-html-parser.js');

   let env;
   const args = process.argv;
   if (args.length >= 3) {
      env = args[2];
   }

   const replaceNodeModulesImport = (str, filePath) => {
      // match import not starting with dot or slash
      return str.replace(/^(\s*import.+?['"])([^\.|\/].+?)(['"].*)$/gm, (m, a, b, c) => {
         if (b.startsWith(`~`)) {
            // ~/package.json
            return a + path.normalize(`${process.cwd()}/` + b.substring(1)) + c;
         } else if (!b.startsWith('http://') && !b.startsWith('https://') && b.indexOf('/') > -1) {
            // lodash-es/get.js
            return a + path.normalize(`${process.cwd()}/node_modules/` + b) + c;
         } else {
            const nodeModulePath = `${process.cwd()}/node_modules/` + b + '/package.json';
            const package = require(nodeModulePath);
            // lodash-es
            return a + path.normalize(`${process.cwd()}/node_modules/` + b + '/' + package.main) + c;
         }
      });
   };

   const walkDirSync = (dir, accept = null, callback) => {
      fs.readdirSync(dir).forEach(f => {
         let dirPath = path.join(dir, f);
         const isDirectory = fs.statSync(dirPath).isDirectory() && (!accept || (typeof accept === 'function' && accept(dirPath, f)));
         isDirectory ? walkDirSync(dirPath, accept, callback) : callback(path.join(dirPath));
      });
   };

   const preprocessJsImport = filePath => {
      if (
         filePath.toLowerCase().endsWith('.js') &&
         !filePath.toLowerCase().endsWith('/ast.js') &&
         !filePath.startsWith(`${utils.dirs.build}/lib/`) &&
         !filePath.startsWith(`${utils.dirs.build}/resources/`)
      ) {
         let jsFileString = fs.readFileSync(filePath, 'utf8');
         jsFileString = replaceNodeModulesImport(jsFileString, filePath);
         fs.writeFileSync(filePath, jsFileString);
      }
   };

   const buildDirFilter = dirPath => {
      if (dirPath.startsWith(`${utils.dirs.build}/lib/`)) {
         return false;
      }
      return true;
   };

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
         walkDirSync(buildDir, buildDirFilter, preprocessJsImport);

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
            const htmlFilename = `${projectPath}/${buildDir}/components/${cmp}/${cmpName}.html`;
            const htmlFileExists = fs.existsSync(htmlFilename);
            if (htmlFileExists) {

               const scssFilename = `${projectPath}/${buildDir}/components/${cmp}/${cmpName}.scss`;
               const scssFileExists = fs.existsSync(scssFilename);
               let cssString = '';
               if (scssFileExists) {
                  let scssString = `@use "global-styles.scss";\n`;
                  scssString += fs.readFileSync(scssFilename, 'utf8');
                  scssString += '\n[lw-false],[lw-for]{display:none !important;}\n';
                  cssString = utils.buildCSS(scssString, `${projectPath}/${buildDir}/components/${cmp}`);
               }
               const styleString = cssString || '';
               const htmlString = fs.readFileSync(htmlFilename, 'utf8');
               const ast = parser.parse(htmlString);
               ast.css = styleString;
               ast.componentFullName = project.name + '-' + cmp.replace(/\//g, '-');
               ast.runtimeVersion = project.version;
               ast.builderVersion = leanwebPackageJSON.version;
               fs.writeFileSync(`${buildDir}/components/${cmp}/ast.js`, `export default ${JSON.stringify(ast, null, 0)};`);
            }
         });
         const htmlString = fs.readFileSync(`${projectPath}/${buildDir}/index.html`, 'utf8');
         fs.writeFileSync(`${buildDir}/index.html`, htmlString);
      };

      const buildSCSS = () => {
         const projectScssFilename = `${projectPath}/src/${project.name}.scss`;
         let projectCssString = '';
         if (fs.existsSync(projectScssFilename)) {
            const projectScssString = fs.readFileSync(projectScssFilename, 'utf8');
            projectCssString += utils.buildCSS(projectScssString, `${projectPath}/${buildDir}`);
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