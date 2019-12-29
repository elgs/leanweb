(async () => {
  const fs = require('fs');
  const utils = require('./utils.js');

  const output = 'dist';
  const project = require(`${process.cwd()}/leanweb.json`);

  const buildJS = () => {
    const jsString = project.components.reduce((acc, cur) => {
      const jsFilePath = `./src/components/${cur}/${cur}.js`;
      const fileExists = fs.existsSync(jsFilePath);
      let jsString = '';
      if (fileExists) {
        jsString = fs.readFileSync(jsFilePath, 'utf8');
      }
      return acc + jsString + '\n';
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
        const templateString = `<template id="${cur}">\n${styleString}${htmlString}\n</template>`
        return `${acc}${templateString}\n\n`
      } else {
        return acc;
      }
    }, '\n');

    let htmlString = fs.readFileSync(`${__dirname}/templates/index.html`, 'utf8');
    htmlString = htmlString.replace(/\$\{project\.name\}/g, project.name);
    htmlString = htmlString.replace(/\$\{project\.title\}/g, project.title);
    htmlString = htmlString.replace(/\$\{templates\}/g, templates);

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
  buildJS();
  buildCSS();
  buildHTML();
})();