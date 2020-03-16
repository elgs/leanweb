(async () => {
   const fs = require('fs');
   const utils = require('./utils.js');
   const parser = require('../lib/lw-html-parser.js');

   const output = 'build';
   const project = require(`${process.cwd()}/leanweb.json`);

   const copyLIB = () => {
      utils.exec(`cp -R ./src/lib ./${output}/`);
   };

   const buildJS = async () => {
      project.components.map(async cur => {
         const cmpName = utils.getComponentName(cur);
         await utils.exec(`mkdir -p ./${output}/components/${cur}/`);
         await utils.exec(`cp ./src/components/${cur}/${cmpName}.js ./${output}/components/${cur}/`);
      });

      const jsString = project.components.reduce((acc, cur) => {
         const cmpName = utils.getComponentName(cur);
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
      let cssString = '';
      if (scssFileExists) {
         const scssString = fs.readFileSync(scssFilename, 'utf8');
         cssString = utils.buildCSS(scssString);
      }
      fs.writeFileSync(`${output}/${project.name}.css`, cssString);
   };

   await utils.exec(`mkdir -p ${output}`);

   copyLIB();
   await buildJS();
   buildCSS();
   buildHTML();
})();