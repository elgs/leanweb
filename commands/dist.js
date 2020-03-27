const path = require('path');
const webpack = require('webpack');
const utils = require('./utils.js');
const fse = require('fs-extra');

(async () => {
   const buildDir = 'build';
   const distDir = 'dist';
   const project = require(`${process.cwd()}/leanweb.json`);

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

      fse.copySync(`./${buildDir}/index.html`, `./${distDir}/index.html`);
      fse.copySync(`./${buildDir}/${project.name}.css`, `./${distDir}/${project.name}.css`);
   });
})();