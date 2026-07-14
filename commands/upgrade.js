import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createRequire } from "module";
const require = createRequire(import.meta.url);

import fs from 'fs';
import fse from 'fs-extra';
import semver from 'semver';
import * as utils from './utils.js';

import { spawnSync } from 'child_process';

const leanwebPackageJSON = require(`${__dirname}/../package.json`);
const projectLeanwebJSON = require(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

// `lw upgrade --diff`: a dry run. Upgrading copies the CLI's templates/lib
// over the project's lib, silently overwriting local modifications (vendored
// bug fixes, experiments). This shows exactly what would change — per-file
// unified diffs — and writes nothing.
if (process.argv.includes('--diff')) {
  const templateDir = `${__dirname}/../templates/lib`;
  const projectDir = `${process.cwd()}/${utils.dirs.src}/lib`;
  const templateFiles = fs.readdirSync(templateDir);
  let changes = 0;
  for (const f of templateFiles) {
    const projectFile = `${projectDir}/${f}`;
    const templateFile = `${templateDir}/${f}`;
    if (!fs.existsSync(projectFile)) {
      console.log(`\nNEW      lib/${f} (upgrade would add it)`);
      changes++;
      continue;
    }
    if (fs.readFileSync(projectFile, 'utf8') === fs.readFileSync(templateFile, 'utf8')) {
      continue;
    }
    changes++;
    console.log(`\nCHANGED  lib/${f} (project -> leanweb ${leanwebPackageJSON.version})`);
    const res = spawnSync('diff', ['-u', projectFile, templateFile], { encoding: 'utf8' });
    if (res.error) {
      console.log('  files differ (no `diff` binary available to show contents)');
    } else {
      console.log(res.stdout);
    }
  }
  if (fs.existsSync(projectDir)) {
    for (const f of fs.readdirSync(projectDir).filter(f => !templateFiles.includes(f))) {
      console.log(`\nPROJECT-ONLY  lib/${f} (kept — upgrade does not delete files)`);
    }
  }
  if (changes === 0) {
    console.log(`Project lib is identical to leanweb ${leanwebPackageJSON.version}.`);
  }
  console.log(`\nDry run — nothing written. Run 'lw upgrade' to apply.`);
  process.exit(0);
}

const upgradeTo088 = () => {
  utils.exec(`npm i -D @babel/runtime --loglevel=error`);
};

const upgradeAvailable = semver.gt(leanwebPackageJSON.version, projectLeanwebJSON.version);
if (upgradeAvailable) {
  fse.copySync(`${__dirname}/../templates/lib`, `./${utils.dirs.src}/lib/`, { dereference: true });
  const oldVersion = projectLeanwebJSON.version;
  projectLeanwebJSON.version = leanwebPackageJSON.version;

  // Existing projects default to shadow DOM for backward compatibility
  if (projectLeanwebJSON.shadowDom === undefined) {
    projectLeanwebJSON.shadowDom = true;
  }

  fs.writeFileSync(`${process.cwd()}/${utils.dirs.src}/leanweb.json`, JSON.stringify(projectLeanwebJSON, null, 2));

  if (semver.gte(leanwebPackageJSON.version, '0.8.8') && semver.lt(oldVersion, '0.8.8')) {
    upgradeTo088();
  }

  console.log('Leanweb upgraded:', oldVersion, '=>', leanwebPackageJSON.version);
}
