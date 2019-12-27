#!/usr/bin/env node

const fs = require('fs');

const args = process.argv;
const utils = require('./utils.js');

if (args.length < 3) {
  console.error('leanweb target parameters');
  return;
}

const targets = {
  'build': 'build.js',
  'clean': 'clean.js',
  'generate': 'generate.js',
  'init': null
};

let target = args[2];

const targetCandidates = Object.keys(targets).filter(t => t.startsWith(target));
if (targetCandidates.length === 0) {
  console.error(`Target ${target} not found.`);
  return;
} else if (targetCandidates.length > 1) {
  targetCandidates.forEach(t => {
    console.log(t);
  });
  return;
}

target = targetCandidates[0];

const leanwebJSONExisted = fs.existsSync(`${process.cwd()}/leanweb.json`);

if (target === 'init') {
  if (args.length < 4) {
    console.error('leanweb init project-name');
    return;
  } else if (leanwebJSONExisted) {
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
