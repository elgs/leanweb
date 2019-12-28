#!/usr/bin/env node

const fs = require('fs');
const utils = require('./utils.js');

const args = process.argv;

if (args.length < 3) {
  utils.exec('npx leanweb help');
  return;
}

let target = args[2];

const targetCandidates = Object.keys(utils.targets).filter(t => t.startsWith(target));
if (targetCandidates.length === 0) {
  console.error(`Error: target ${target} not found.`);
  return;
} else if (targetCandidates.length > 1) {
  targetCandidates.forEach(t => {
    console.log(t);
  });
  return;
}

target = targetCandidates[0];

const leanwebJSONExisted = fs.existsSync(`${process.cwd()}/leanweb.json`);

if (!leanwebJSONExisted && target !== 'init') {
  console.error('Error: leanweb.json not found.');
  return;
}
utils.exec(`node ${__dirname}/${utils.targets[target].file} ${args.slice(3).join(' ')}`);
