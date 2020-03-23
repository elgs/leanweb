(async () => {
   const fs = require('fs');
   const utils = require('./utils.js');
   const parser = require('../lib/lw-html-parser.js');

   const output = 'build';
   const project = require(`${process.cwd()}/leanweb.json`);

   const replaceNodeModulesImport = (str, cmp) => {
      // match import not starting with dot or slash
      return str.replace(/^(\s*import\s+.*?from\s+['"])([^\.^\/].+?)(['"].*)$/gm, (m, a, b, c) => {
         if (b.toLowerCase().endsWith('.js') || b.indexOf('/') > -1) {
            if (!b.endsWith('.js')) {
               b += '.js';
            }
            return a + `./../../../${utils.getPathLevels(cmp)}node_modules/` + b + c;
         } else {
            const nodeModulePath = `${process.cwd()}/node_modules/` + b + '/package.json';
            const package = require(nodeModulePath);
            return a + `./../../../${utils.getPathLevels(cmp)}node_modules/` + b + '/' + package.main + c;
         }
      });
   };

   const copyLIB = () => {
      utils.exec(`cp -R ./src/lib ./${output}/`);
   };

   const buildJS = async () => {
      const mkdirPromises = project.components.map(async cur => {
         await utils.exec(`mkdir -p ./${output}/components/${cur}/`);
      });
      await Promise.all(mkdirPromises);

      const jsString = project.components.reduce((acc, cur) => {
         const cmpName = utils.getComponentName(cur);
         let jsFileString = fs.readFileSync(`./src/components/${cur}/${cmpName}.js`, 'utf8');
         jsFileString = replaceNodeModulesImport(jsFileString, cur);
         fs.writeFileSync(`./${output}/components/${cur}/${cmpName}.js`, jsFileString);
         let importString = `import './components/${cur}/${cmpName}.js';`;
         return acc + importString + '\n';
      }, '');
      fs.writeFileSync(`${output}/${project.name}.js`, jsString);
   };

   const buildHTML = () => {
      const templates = project.components.reduce((acc, cur) => {
         const cmpName = utils.getComponentName(cur);
         const htmlFilename = `./src/components/${cur}/${cmpName}.html`;
         const htmlFileExists = fs.existsSync(htmlFilename);
         if (htmlFileExists) {

            const scssFilename = `./src/components/${cur}/${cmpName}.scss`;
            const scssFileExists = fs.existsSync(scssFilename);
            let cssString = '';
            if (scssFileExists) {
               const scssString = fs.readFileSync(scssFilename, 'utf8');
               cssString = utils.buildCSS(scssString);
            }
            const styleString = !!cssString ? `<style>${cssString}</style>\n` : '';
            const htmlString = fs.readFileSync(htmlFilename, 'utf8');
            const parsed = parser.parse(htmlString);
            const templateString = `<template id="${project.name}-${cur.replace(/\//g, '-')}">\n<link rel="stylesheet" href="./${project.name}.css">\n${styleString}${parsed.html}\n</template>`;
            fs.writeFileSync(`${output}/components/${cur}/interpolation.js`, `export default ${JSON.stringify(parsed.interpolation, null, 0)};`);
            return `${acc}${templateString}\n\n`
         } else {
            return acc;
         }
      }, '\n');
      const htmlString = fs.readFileSync(`./src/index.html`, 'utf8') + templates;
      fs.writeFileSync(`${output}/index.html`, htmlString);
   };

   const buildCSS = () => {
      const scssFilename = `./src/${project.name}.scss`;
      const scssFileExists = fs.existsSync(scssFilename);
      let cssString = '[lw-false],[lw-for]{display:none;}\n';
      if (scssFileExists) {
         const scssString = fs.readFileSync(scssFilename, 'utf8');
         cssString += utils.buildCSS(scssString);
      }
      fs.writeFileSync(`${output}/${project.name}.css`, cssString);
   };

   await utils.exec(`mkdir -p ${output}`);

   copyLIB();
   await buildJS();
   buildCSS();
   buildHTML();
})();