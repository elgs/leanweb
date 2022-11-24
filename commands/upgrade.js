import fs from 'fs';
import fse from 'fs-extra';
import semver from 'semver';
import * as utils from './utils.js';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const leanwebPackageJSON = require(`${__dirname}/../package.json`);
const projectLeanwebJSON = require(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

const upgradeTo088 = () => {
   utils.exec(`npm i -D @babel/runtime --loglevel=error`);
};

const upgradeAvailable = semver.gt(leanwebPackageJSON.version, projectLeanwebJSON.version);
if (upgradeAvailable) {
   fse.copySync(`${__dirname}/../templates/lib`, `./${utils.dirs.src}/lib/`, { dereference: true });
   const oldVersion = projectLeanwebJSON.version;
   projectLeanwebJSON.version = leanwebPackageJSON.version;
   fs.writeFileSync(`${process.cwd()}/${utils.dirs.src}/leanweb.json`, JSON.stringify(projectLeanwebJSON, null, 2));

   if (semver.gte(leanwebPackageJSON.version, '0.8.8') && semver.lt(oldVersion, '0.8.8')) {
      upgradeTo088();
   }

   console.log('Leanweb upgraded:', oldVersion, '=>', leanwebPackageJSON.version);
}
