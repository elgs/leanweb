import { createRequire } from "module";
const require = createRequire(import.meta.url);

import * as utils from './utils.js';
import fs from 'fs';
import fse from 'fs-extra';
import { minify } from 'html-minifier';
import CleanCSS from 'clean-css';

import esbuild from 'esbuild';

let env = '';
const args = process.argv;
if (args.length >= 3) {
  env = args[2];
}

const verbose = process.env.verbose || false;

(async () => {
  const project = require(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

  await utils.exec(`npx leanweb clean`);
  await utils.exec(`npx leanweb build ${env}`);

  fs.mkdirSync(utils.dirs.dist, { recursive: true });
  const result = await esbuild.build({
    entryPoints: [`./${utils.dirs.build}/${project.name}.js`],
    bundle: true,
    minify: true,
    sourcemap: true,
    format: 'esm',
    outfile: `./${utils.dirs.dist}/${project.name}.js`,
    metafile: !!verbose,
  });
  if (verbose) {
    const text = await esbuild.analyzeMetafile(result.metafile);
    console.log(text);
  }

  const indexHTML = fs.readFileSync(`./${utils.dirs.build}/index.html`, 'utf8');
  const minifiedIndexHtml = minify(indexHTML, {
    caseSensitive: true,
    collapseWhitespace: true,
    minifyCSS: true,
    minifyJS: true,
    removeComments: true,
  });
  fs.writeFileSync(`./${utils.dirs.dist}/index.html`, minifiedIndexHtml);

  const appCSS = fs.readFileSync(`./${utils.dirs.build}/${project.name}.css`, 'utf8');
  const minifiedAppCss = new CleanCSS({}).minify(appCSS);
  fs.writeFileSync(`./${utils.dirs.dist}/${project.name}.css`, minifiedAppCss.styles);

  fse.copySync(`./${utils.dirs.build}/favicon.svg`, `./${utils.dirs.dist}/favicon.svg`);
  project.resources?.forEach(resource => {
    const source = `./${utils.dirs.build}/${resource}`;
    if (fs.existsSync(source)) {
      fse.copySync(source, `./${utils.dirs.dist}/${resource}`, { dereference: true });
    }
  });

  const postDistFile = './post-dist';
  if (fs.existsSync(postDistFile) && fs.statSync(postDistFile).isFile()) {
    await utils.exec(postDistFile);
  }
})();