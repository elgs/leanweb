#!/usr/bin/env node

const fs = require('fs');

const args = process.argv;
const utils = require('./utils.js');

if (args.length < 3) {
  console.error('leanweb target parameters');
  return;
}

const target = args[2];

const leanwebJSONExisted = fs.existsSync(`${process.cwd()}/leanweb.json`);

if (target === 'init') {
  if (args.length < 4) {
    console.error('leanweb init project-name');
    return;
  }
  if (leanwebJSONExisted) {
    console.error('leanweb.json existed.');
    return;
  } else {
    const leanwebData = {
      name: args[3],
      title: args[3],
      components: [`${args[3].toLowerCase()}-root`]
    };
    fs.writeFileSync('leanweb.json', JSON.stringify(leanwebData, null, 2));
  }
} else {
  if (!leanwebJSONExisted) {
    console.error('leanweb.json not found.');
    return;
  } else {
    utils.exec(`node ${__dirname}/${target}.js ${args.slice(3).join(' ')}`);
  }
}
