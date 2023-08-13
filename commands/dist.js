import { createRequire } from "module";
const require = createRequire(import.meta.url);

import * as utils from './utils.js';
import fs from 'fs';
import fse from 'fs-extra';
import { minify } from 'html-minifier';

import esbuild from 'esbuild';

let env = '';
const args = process.argv;
if (args.length >= 3) {
  env = args[2];
}

const verbose = process.env.verbose || false;

const project = require(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

utils.exec(`npx leanweb clean`);
utils.exec(`npx leanweb build ${env}`);

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

const minimizePage = page => {
  const html = fs.readFileSync(`./${utils.dirs.build}/${page}.html`, 'utf8');
  const minifiedIndexHtml = minify(html, {
    caseSensitive: true,
    collapseWhitespace: true,
    minifyCSS: true,
    minifyJS: true,
    removeComments: true,
  });

  const pageName = utils.getComponentName(page);
  const pagePath = `${utils.dirs.dist}/${utils.getComponentPath(page)}`;
  fs.mkdirSync(pagePath, { recursive: true });
  fs.writeFileSync(`${pagePath}/${pageName}.html`, minifiedIndexHtml);
};

project.pages.push('index');
project.pages.forEach(minimizePage);

const appCSS = fs.readFileSync(`./${utils.dirs.build}/${project.name}.css`, 'utf8');
fs.writeFileSync(`./${utils.dirs.dist}/${project.name}.css`, appCSS);

fse.copySync(`./${utils.dirs.build}/favicon.svg`, `./${utils.dirs.dist}/favicon.svg`);
fse.copySync(`./${utils.dirs.build}/global-styles.css`, `./${utils.dirs.dist}/global-styles.css`);
project.resources?.forEach(resource => {
  const source = `./${utils.dirs.build}/${resource}`;
  if (fs.existsSync(source)) {
    fse.copySync(source, `./${utils.dirs.dist}/${resource}`, { dereference: true });
  }
});

const postDistFile = './post-dist';
if (fs.existsSync(postDistFile) && fs.statSync(postDistFile).isFile()) {
  utils.exec(postDistFile);
}