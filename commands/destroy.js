const fs = require('fs');

const args = process.argv;
if (args.length < 3) {
   console.log('Usage: lw destroy project-name');
   console.log('This will delete build/ dist/ and src/ lib/')
   return;
}

const projectName = args[2];

const project = require(`${process.cwd()}/src/leanweb.json`);

if (projectName !== project.name) {
   console.error('Error: project name doesn\'t match.');
   return;
}

fs.rmdirSync('build/', { recursive: true });
fs.rmdirSync('dist/', { recursive: true });
fs.rmdirSync('src/', { recursive: true });