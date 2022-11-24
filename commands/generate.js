import fs from 'fs';
import * as utils from './utils.js';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { createRequire } from "module";
const require = createRequire(import.meta.url);

(async () => {
  const args = process.argv;
  if (args.length < 3) {
    console.error('Usage: lw generate component-names');
    return;
  }

  const leanwebJSONPath = `${process.cwd()}/${utils.dirs.src}/leanweb.json`;
  const leanwebJSON = require(leanwebJSONPath);
  const cmps = args.slice(2);

  for (const cmpJSON of leanwebJSON.components) {
    for (const cmp of cmps) {
      if (cmpJSON === cmp) {
        console.error(`Error: component ${cmpJSON} existed.`);
        return;
      }
    }
  }

  leanwebJSON.components.push(...cmps);
  fs.writeFileSync(leanwebJSONPath, JSON.stringify(leanwebJSON, null, 2));

  for (const cmp of cmps) {
    const cmpName = utils.getComponentName(cmp);
    const cmpPath = `${utils.dirs.src}/components/${cmp}`;

    fs.mkdirSync(cmpPath, { recursive: true });

    if (!fs.existsSync(`${cmpPath}/${cmpName}.js`)) {
      let jsString = fs.readFileSync(`${__dirname}/../templates/component.js`, 'utf8');
      jsString = jsString.replace(/\$\{projectName\}/g, leanwebJSON.name);
      jsString = jsString.replace(/\$\{component\}/g, cmp.replace(/\//g, '-'));
      jsString = jsString.replace(/\$\{pathLevels\}/g, utils.getPathLevels(cmp));

      fs.writeFileSync(`${cmpPath}/${cmpName}.js`, jsString);
    }

    if (!fs.existsSync(`${cmpPath}/${cmpName}.html`)) {
      fs.writeFileSync(`${cmpPath}/${cmpName}.html`, `<div>${leanwebJSON.name}-${cmpName} works!</div>`);
    }

    if (!fs.existsSync(`${cmpPath}/${cmpName}.scss`)) {
      fs.writeFileSync(`${cmpPath}/${cmpName}.scss`, '');
    }
  }
})();