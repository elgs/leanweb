const path = require('path');
const webpack = require('webpack');
const utils = require('./utils.js');
const fs = require('fs');
const fse = require('fs-extra');
const minify = require('html-minifier').minify;
const CleanCSS = require('clean-css');

(async () => {
   const buildDir = 'build';
   const distDir = 'dist';
   const project = require(`${process.cwd()}/src/leanweb.json`);

   utils.exec(`npx lw clean`);
   utils.exec(`npx lw build`);

   const compiler = webpack({
      mode: 'production',
      devtool: 'source-map',
      entry: [process.cwd() + `/${buildDir}/${project.name}.js`],
      output: {
         path: process.cwd() + `/${distDir}/`,
         filename: `${project.name}.js`
      },
      performance: {
         hints: 'warning'
      },
      module: {
         rules: [
            {
               test: path.resolve(process.cwd() + `/${buildDir}/`),
               exclude: /node_modules/,
               loader: 'babel-loader',
               options: {
                  presets: ['@babel/preset-env',
                     {
                        'plugins': [
                           '@babel/plugin-proposal-class-properties',
                           '@babel/plugin-transform-runtime'
                        ]
                     }
                  ]
               }
            }
         ]
      }
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

      const indexHTML = fs.readFileSync(`./${buildDir}/index.html`, 'utf8');
      const minifiedIndexHtml = minify(indexHTML, {
         caseSensitive: true,
         collapseWhitespace: true,
         minifyCSS: true,
         minifyJS: true,
      });
      fs.writeFileSync(`./${distDir}/index.html`, minifiedIndexHtml);

      const appCSS = fs.readFileSync(`./${buildDir}/${project.name}.css`, 'utf8');
      const minifiedAppCss = new CleanCSS({}).minify(appCSS);
      fs.writeFileSync(`./${distDir}/${project.name}.css`, minifiedAppCss.styles);

      // fse.copySync(`./${buildDir}/index.html`, `./${distDir}/index.html`);
      // fse.copySync(`./${buildDir}/${project.name}.css`, `./${distDir}/${project.name}.css`);
      fse.copySync(`./${buildDir}/favicon.svg`, `./${distDir}/favicon.svg`);
      project.resources.forEach(resource => {
         fse.copySync(`./${buildDir}/${resource}`, `./${distDir}/${resource}`);
      });
   });
})();