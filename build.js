#!/usr/bin/env node

(async () => {
  const fs = require('fs');
  const utils = require('./utils.js');

  const args = process.argv;
  const isDist = args && args.length >= 3 && args[2] === 'dist';
  const output = isDist ? 'dist' : 'build';
  const project = require(`${process.cwd()}/leanweb.json`);

  const buildJS = () => {
    const jsString = project.components.reduce((acc, cur) => {
      const jsFilename = `./app/${cur}/${cur}.js`;
      const fileExists = fs.existsSync(jsFilename);
      return fileExists ? `${acc}import '${jsFilename}';\n` : acc;
    }, '');
    fs.writeFileSync(`${output}/${project.name}.js`, jsString);
  };

  const buildHTML = () => {
    const templates = project.components.reduce((acc, cur) => {
      const templateFilename = `./app/${cur}/${cur}.html`;
      const fileExists = fs.existsSync(templateFilename);
      if (fileExists) {
        const templateString = fs.readFileSync(templateFilename);
        return `${acc}${templateString}\n`
      } else {
        return acc;
      }
    }, '');

    let htmlString = fs.readFileSync(`${__dirname}/templates/index.html`, 'utf8');
    htmlString = htmlString.replace(/\$\{project\.name\}/g, project.name);
    htmlString = htmlString.replace(/\$\{project\.title\}/g, project.title);
    htmlString = htmlString.replace(/\$\{templates\}/g, templates);

    fs.writeFileSync(`${output}/index.html`, htmlString);
  };


  await utils.exec(`mkdir -p ${output}`);
  buildJS();
  buildHTML();
})();