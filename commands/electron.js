
import fs from 'fs';
import fse from 'fs-extra';
import webpack from 'webpack';
import * as utils from './utils.js';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { createRequire } from "module";
const require = createRequire(import.meta.url);

(async () => {
   let env = '';
   const args = process.argv;
   if (args.length >= 3) {
      env = args[2];
   }

   if (!fs.existsSync(process.cwd() + `/${utils.dirs.src}/electron.js`)) {
      fse.copySync(`${__dirname}/../templates/electron.js`, `${process.cwd()}/${utils.dirs.src}/electron.js`);
   }

   const leanwebJSONPath = `${process.cwd()}/${utils.dirs.src}/leanweb.json`;
   const project = require(leanwebJSONPath);
   if (!project.electron) {
      utils.exec(`npm i -D electron --loglevel=error`);
      project.electron = true;
      fs.writeFileSync(leanwebJSONPath, JSON.stringify(project, null, 2));
   }

   await utils.exec(`npx lw clean`);
   await utils.exec(`npx lw build ${env}`);

   fse.copySync(`./${utils.dirs.build}/electron.js`, `./${utils.dirs.electron}/electron.js`);
   fse.copySync(`./${utils.dirs.build}/index.html`, `./${utils.dirs.electron}/index.html`);
   fse.copySync(`./${utils.dirs.build}/${project.name}.css`, `./${utils.dirs.electron}/${project.name}.css`);
   fse.copySync(`./${utils.dirs.build}/favicon.svg`, `./${utils.dirs.electron}/favicon.svg`);
   project.resources?.forEach(resource => {
      fse.copySync(`./${utils.dirs.build}/${resource}`, `./${utils.dirs.electron}/${resource}`, { dereference: true });
   });

   const webpackConfig = utils.getWebPackConfig(utils.dirs.electron, project);

   const compiler = webpack({
      ...webpackConfig,
      mode: 'development',
      devtool: 'eval-cheap-module-source-map',
      performance: {
         hints: false,
      },
   });

   compiler.run(async (err, stats) => {
      if (err) {
         console.log(err);
      }
      if (stats.compilation.errors.length) {
         console.log(stats.compilation.errors);
      }
      if (stats.compilation.warnings.length) {
         console.log(stats.compilation.warnings);
      }
      await utils.exec(`npx electron ${process.cwd()}/${utils.dirs.electron}/electron.js`);
   });
})();
