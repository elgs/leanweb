#!/usr/bin/env node

const fs = require('fs');
const utils = require('./utils.js');

const args = process.argv;


if (args.length < 3) {
  console.error('Usage: leanweb target parameters');
  return;
}

const targets = {
  'build': 'build.js',
  'clean': 'clean.js',
  'generate': 'generate.js',
  'init': 'init.js',
  'destroy': 'destroy.js'
};

let target = args[2];

const targetCandidates = Object.keys(targets).filter(t => t.startsWith(target));
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
utils.exec(`node ${__dirname}/${target}.js ${args.slice(3).join(' ')}`);

