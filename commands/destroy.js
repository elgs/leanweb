const fs = require('fs');
const utils = require('./utils.js');

const args = process.argv;
if (args.length < 3) {
   console.log('Usage: lw destroy project-name');
   console.log(`This will delete ${utils.dirs.src}/ ${utils.dirs.build}/ ${utils.dirs.dist}/ ${utils.dirs.serve}/ and ${utils.dirs.electron}/`)
   return;
}

const projectName = args[2];

const project = require(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

if (projectName !== project.name) {
   console.error('Error: project name doesn\'t match.');
   return;
}

fs.rmdirSync(utils.dirs.build + '/', { recursive: true });
fs.rmdirSync(utils.dirs.dist + '/', { recursive: true });
fs.rmdirSync(utils.dirs.src + '/', { recursive: true });
fs.rmdirSync(utils.dirs.serve + '/', { recursive: true });
fs.rmdirSync(utils.dirs.electron + '/', { recursive: true });