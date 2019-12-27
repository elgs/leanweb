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
      let jsString = '';
      if (fileExists) {
        jsString = fs.readFileSync(jsFilename, 'utf8');
      }
      return acc + jsString + '\n';
    }, '');
    fs.writeFileSync(`${output}/${project.name}.js`, jsString);
  };

  const buildHTML = () => {
    const templates = project.components.reduce((acc, cur) => {
      const templateFilename = `./app/${cur}/${cur}.html`;
      const fileExists = fs.existsSync(templateFilename);
      if (fileExists) {
        const componenetHTML = fs.readFileSync(templateFilename);
        const templateString = `<template id="${cur}">\n${componenetHTML}\n</template>`
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


  await utils.exec(`mkdir -p ${output}`);
  buildJS();
  buildHTML();
})();