const semver = require('semver');
const fs = require('fs');
const fse = require('fs-extra');

const leanwebPackageJSON = require(`${__dirname}/../package.json`);
const projectLeanwebJSON = require(`${process.cwd()}/src/leanweb.json`);

const upgradeAvailable = semver.gt(leanwebPackageJSON.version, projectLeanwebJSON.version);
if (upgradeAvailable) {
   fse.copySync(`${__dirname}/../templates/lib`, `./src/lib/`);
   const oldVersion = projectLeanwebJSON.version;
   projectLeanwebJSON.version = leanwebPackageJSON.version;
   fs.writeFileSync(`${process.cwd()}/src/leanweb.json`, JSON.stringify(projectLeanwebJSON, null, 2));
   console.log('Leanweb upgraded:', oldVersion, '=>', leanwebPackageJSON.version);
}