import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createRequire } from "module";
const require = createRequire(import.meta.url);

import fs from 'fs';
import * as utils from './utils.js';

(async () => {
  const args = process.argv;
  if (args.length < 3) {
    console.error('Usage: lw addpage page names');
    return;
  }

  const leanwebJSONPath = `${process.cwd()}/${utils.dirs.src}/leanweb.json`;
  const leanwebJSON = require(leanwebJSONPath);
  const pages = args.slice(2);

  const projectName = path.basename(path.resolve());

  leanwebJSON.pages = leanwebJSON.pages ?? [];
  for (const pageJSON of leanwebJSON.pages) {
    for (const page of pages) {
      if (pageJSON === page) {
        console.error(`Error: page ${pageJSON} existed.`);
        return;
      }
    }
  }

  leanwebJSON.pages.push(...pages);
  fs.writeFileSync(leanwebJSONPath, JSON.stringify(leanwebJSON, null, 2));

  for (const page of pages) {
    const pageName = utils.getComponentName(page);
    const pagePath = `${utils.dirs.src}/${utils.getComponentPath(page)}`;
    fs.mkdirSync(pagePath, { recursive: true });
    if (!fs.existsSync(`${pagePath}/${pageName}.html`)) {
      let htmlString = fs.readFileSync(`${__dirname}/../templates/page.html`, 'utf8');
      htmlString = htmlString.replace(/\$\{project\.name\}/g, projectName);
      htmlString = htmlString.replace(/\$\{page\.name\}/g, pageName);
      htmlString = htmlString.replace(/\$\{pathLevels\}/g, utils.getPathLevels(page));
      fs.writeFileSync(`${pagePath}/${pageName}.html`, htmlString);
    }
  }
})();