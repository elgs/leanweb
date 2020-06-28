#!/usr/bin/env node

(async () => {

   const fs = require('fs');
   const semver = require('semver');
   const utils = require('./commands/utils.js');

   const args = process.argv;

   if (args.length < 3) {
      utils.exec('npx lw help');
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

   const leanwebJSONExisted = fs.existsSync(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

   if (!leanwebJSONExisted && target !== 'init' && target !== 'help' && target !== 'version') {
      console.error('Error: leanweb.json not found.');
      return;
   }

   if (leanwebJSONExisted && target === 'version' || target === 'serve' || target === 'dist' || target === 'electron') {
      const leanwebPackageJSON = require(`${__dirname}/package.json`);
      const projectLeanwebJSON = require(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);
      const upgradeAvailable = semver.gt(leanwebPackageJSON.version, projectLeanwebJSON.version);
      if (upgradeAvailable) {
         console.log(`New version of leanweb lib (${projectLeanwebJSON.version} => ${leanwebPackageJSON.version}) is available. Please consider 
running 'lw upgrade' to upgrade your project leanweb lib.`);
      }

      const projectTooNew = semver.gt(projectLeanwebJSON.version, leanwebPackageJSON.version);
      if (projectTooNew) {
         console.log(`Poject version of leanweb (${projectLeanwebJSON.version} > ${leanwebPackageJSON.version}) is newer than local leanweb tools version.
Please consider running 'npm i leanweb -g' to upgrade your local leanweb tools.`);
      }
   }
   const targetData = utils.targets[target];
   const command = `node ${__dirname}/commands/${targetData.file} ${args.slice(3).join(' ')}`;
   utils.exec(command);
})();