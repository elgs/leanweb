import webpack from 'webpack';
import * as utils from './utils.js';
import fs from 'fs';
import fse from 'fs-extra';
// const minify = require('html-minifier').minify;
import { minify } from 'html-minifier';
import CleanCSS from 'clean-css';

import { createRequire } from "module";
const require = createRequire(import.meta.url);

let env = '';
const args = process.argv;
if (args.length >= 3) {
   env = args[2];
}

(async () => {
   const project = require(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

   await utils.exec(`npx lw clean`);
   await utils.exec(`npx lw build ${env}`);

   const webpackConfig = utils.getWebPackConfig(utils.dirs.dist, project);

   const compiler = webpack({
      ...webpackConfig,
      mode: 'production',
      devtool: 'source-map',
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

      const indexHTML = fs.readFileSync(`./${utils.dirs.build}/index.html`, 'utf8');
      const minifiedIndexHtml = minify(indexHTML, {
         caseSensitive: true,
         collapseWhitespace: true,
         minifyCSS: true,
         minifyJS: true,
         caseSensitive: true,
      });
      fs.writeFileSync(`./${utils.dirs.dist}/index.html`, minifiedIndexHtml);

      const appCSS = fs.readFileSync(`./${utils.dirs.build}/${project.name}.css`, 'utf8');
      const minifiedAppCss = new CleanCSS({}).minify(appCSS);
      fs.writeFileSync(`./${utils.dirs.dist}/${project.name}.css`, minifiedAppCss.styles);

      fse.copySync(`./${utils.dirs.build}/favicon.svg`, `./${utils.dirs.dist}/favicon.svg`);
      project.resources?.forEach(resource => {
         fse.copySync(`./${utils.dirs.build}/${resource}`, `./${utils.dirs.dist}/${resource}`, { dereference: true });
      });

      if (fs.statSync(`./post-dist`).isFile()) {
         await utils.exec(`./post-dist`);
      }
   });
})();