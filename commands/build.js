(async () => {
   const fs = require('fs');
   const utils = require('./utils.js');
   const parser = require('../lib/lw-html-parser.js');

   const output = 'build';
   const project = require(`${process.cwd()}/leanweb.json`);

   const buildJS = async () => {
      const jsString = await project.components.reduce(async (acc, cur) => {
         await utils.exec(`mkdir -p ./${output}/components/${cur}/`);
         await utils.exec(`cp -p ./src/components/${cur}/${cur}.js ./${output}/components/${cur}/`);
         let importString = `import './components/${cur}/${cur}.js';`
         return acc + importString + '\n';
      }, '');
      fs.writeFileSync(`${output}/${project.name}.js`, jsString);
   };

   const buildHTML = () => {
      const templates = project.components.reduce((acc, cur) => {
         const htmlFilename = `./src/components/${cur}/${cur}.html`;
         const htmlFileExists = fs.existsSync(htmlFilename);
         if (htmlFileExists) {

            const scssFilename = `./src/components/${cur}/${cur}.scss`;
            const scssFileExists = fs.existsSync(scssFilename);
            let cssString = '';
            if (scssFileExists) {
               const scssString = fs.readFileSync(scssFilename, 'utf8');
               cssString = utils.buildCSS(scssString);
            }
            const styleString = !!cssString ? `<style>${cssString}</style>\n` : '';
            const htmlString = fs.readFileSync(htmlFilename, 'utf8');
            const parsed = parser.parse(htmlString);
            const templateString = `<template id="${cur}">\n<link rel="stylesheet" href="./${project.name}.css">\n${styleString}${parsed.html}\n</template>`
            fs.appendFileSync(`${output}/components/${cur}/${cur}.js`, `component.ast = ${JSON.stringify(parsed.ast)};`);
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
   await buildJS();
   buildCSS();
   buildHTML();
})();