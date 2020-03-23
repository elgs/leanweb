const webpack = require('webpack');
const utils = require('./utils.js');

(async () => {
   const buildDir = 'build';
   const distDir = 'dist';
   const project = require(`${process.cwd()}/leanweb.json`);

   await utils.exec(`npx leanweb clean`);
   await utils.exec(`npx leanweb build`);

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
               test: process.cwd() + `/${buildDir}/`,
               exclude: /(node_modules)/,
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

      await utils.exec(`cp -R ./${buildDir}/index.html ./${distDir}/`);
      await utils.exec(`cp -R ./${buildDir}/test.css ./${distDir}/`);
   });
})();