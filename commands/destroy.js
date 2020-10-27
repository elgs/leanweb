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

fs.rmSync(utils.dirs.build + '/', { recursive: true, force: true });
fs.rmSync(utils.dirs.dist + '/', { recursive: true, force: true });
fs.rmSync(utils.dirs.src + '/', { recursive: true, force: true });
fs.rmSync(utils.dirs.serve + '/', { recursive: true, force: true });
fs.rmSync(utils.dirs.electron + '/', { recursive: true, force: true });