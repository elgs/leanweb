const fs = require('fs');

const args = process.argv;
if (args.length < 3) {
   console.log('Usage: leanweb destroy project-name');
   console.log('This will delete leanweb.json, build/ dist/ and src/ lib/')
   return;
}

const projectName = args[2];

const project = require(`${process.cwd()}/leanweb.json`);

if (projectName !== project.name) {
   console.error('Error: project name doesn\'t match.');
   return;
}

fs.unlinkSync('leanweb.json');
fs.rmdirSync('build/', { recursive: true });
fs.rmdirSync('dist/', { recursive: true });
fs.rmdirSync('src/', { recursive: true });