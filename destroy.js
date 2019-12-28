const utils = require('./utils.js');

const args = process.argv;
if (args.length < 3) {
  console.log('Usage: leanweb destroy project-name');
  console.log('This will delete leanweb.json, build/ dist/ and src/')
  return;
}

const projectName = args[2];

const project = require(`${process.cwd()}/leanweb.json`);

if (projectName !== project.name) {
  console.error('Error: project name doesn\'t match.');
  return;
}

utils.exec(`rm -rf leanweb.json build/ dist/ src/`);