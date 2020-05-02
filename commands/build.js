(async () => {
   const fs = require('fs');
   const path = require('path');
   const fse = require('fs-extra');
   const utils = require('./utils.js');
   const parser = require('../lib/lw-html-parser.js');

   const project = require(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

   // const args = process.argv;
   // const changedFiles = args.slice(2);
   // console.log(changedFiles);

   const replaceNodeModulesImport = (str, filePath) => {
      // match import not starting with dot or slash
      return str.replace(/^(\s*import.+?['"])([^\.|\/].+?)(['"].*)$/gm, (m, a, b, c) => {
         if (b.indexOf('/') > -1) {
            if (b.startsWith('~/')) {
               return a + path.normalize(`./${utils.getPathLevels(filePath)}` + b.substring(2)) + c;
            }
            return a + path.normalize(`./${utils.getPathLevels(filePath)}node_modules/` + b) + c;
         } else {
            const nodeModulePath = `${process.cwd()}/node_modules/` + b + '/package.json';
            const package = require(nodeModulePath);
            return a + path.normalize(`./${utils.getPathLevels(filePath)}node_modules/` + b + '/' + package.main) + c;
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
      if (filePath.toLowerCase().endsWith('.js') && !filePath.toLowerCase().endsWith('/ast.js') && !filePath.startsWith(`${utils.dirs.build}/lib/`)) {
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

   const buildJS = () => {
      walkDirSync(`./${utils.dirs.build}/`, buildDirFilter, preprocessJsImport);

      const jsString = project.components.reduce((acc, cur) => {
         const cmpName = utils.getComponentName(cur);
         let importString = `import './components/${cur}/${cmpName}.js';`;
         return acc + importString + '\n';
      }, '');
      fs.writeFileSync(`${utils.dirs.build}/${project.name}.js`, jsString);
   };

   const buildHTML = () => {
      project.components.forEach(cmp => {
         const cmpName = utils.getComponentName(cmp);
         const htmlFilename = `./${utils.dirs.src}/components/${cmp}/${cmpName}.html`;
         const htmlFileExists = fs.existsSync(htmlFilename);
         if (htmlFileExists) {

            const scssFilename = `./${utils.dirs.src}/components/${cmp}/${cmpName}.scss`;
            const scssFileExists = fs.existsSync(scssFilename);
            let cssString = '';
            if (scssFileExists) {
               const scssString = fs.readFileSync(scssFilename, 'utf8');
               cssString = utils.buildCSS(scssString);
            }
            const styleString = !!cssString ? cssString : '';
            const htmlString = fs.readFileSync(htmlFilename, 'utf8');
            const ast = parser.parse(htmlString);
            ast.css = styleString;
            fs.writeFileSync(`${utils.dirs.build}/components/${cmp}/ast.js`, `export default ${JSON.stringify(ast, null, 0)};`);
         }
      });
      const htmlString = fs.readFileSync(`./${utils.dirs.src}/index.html`, 'utf8');
      fs.writeFileSync(`${utils.dirs.build}/index.html`, htmlString);
   };

   const buildCSS = () => {
      const scssFilename = `./${utils.dirs.src}/global-styles.scss`;
      const scssFileExists = fs.existsSync(scssFilename);
      let cssString = '[lw-false],[lw-for]{display:none;}\n';
      if (scssFileExists) {
         const scssString = fs.readFileSync(scssFilename, 'utf8');
         cssString += utils.buildCSS(scssString);
      }
      fs.writeFileSync(`${utils.dirs.build}/global-styles.css`, cssString);
   };

   const copySrc = () => {
      fse.copySync(`./${utils.dirs.src}/`, `./${utils.dirs.build}/`)
   };

   fs.mkdirSync(utils.dirs.build, { recursive: true });

   copySrc();
   buildJS();
   buildCSS();
   buildHTML();
})();