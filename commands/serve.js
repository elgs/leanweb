const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const utils = require('./utils.js');
const webpack = require('webpack');
const watch = require('node-watch');
const WebpackDevServer = require('webpack-dev-server');

(async () => {

   const buildDir = 'build';
   const serveDir = 'serve';
   const project = require(`${process.cwd()}/src/leanweb.json`);

   utils.exec(`npx lw build`);

   const build = async (eventType, filename) => {
      // console.log(eventType + ': ', filename);
      await utils.exec(`npx lw build ` + filename);

      fse.copySync(`./${buildDir}/index.html`, `./${serveDir}/index.html`);
      fse.copySync(`./${buildDir}/${project.name}.css`, `./${serveDir}/${project.name}.css`);
   };

   const throttledBuild = utils.throttle(build);
   watch(process.cwd() + '/src/', { recursive: true }, (eventType, filename) => {
      throttledBuild(eventType, filename);
   });

   const webpackConfig = {
      mode: 'development',
      watch: true,
      devtool: 'eval-cheap-module-source-map',
      entry: process.cwd() + `/${buildDir}/${project.name}.js`,
      output: {
         path: process.cwd() + `/${serveDir}/`,
         filename: `${project.name}.js`,
      },
      performance: {
         hints: false,
      },
      module: {
         rules: [{
            test: path.resolve(process.cwd() + `/${buildDir}/`),
            exclude: /node_modules/,
            loader: 'babel-loader',
            options: {
               presets: ['@babel/preset-env', {
                  'plugins': [
                     '@babel/plugin-proposal-class-properties',
                     '@babel/plugin-transform-runtime'
                  ]
               }]
            },
         }]
      },
   };

   const compiler = webpack(webpackConfig);

   const devServerOptions = {
      ...webpackConfig.devServer,
      contentBase: process.cwd() + `/${serveDir}/`,
      publicPath: '/',
      hot: true,
      // open: true,
      stats: 'errors-warnings',
   };
   const server = new WebpackDevServer(compiler, devServerOptions);

   fse.copySync(`./${buildDir}/index.html`, `./${serveDir}/index.html`);
   fse.copySync(`./${buildDir}/${project.name}.css`, `./${serveDir}/${project.name}.css`);
   fse.copySync(`./${buildDir}/favicon.svg`, `./${serveDir}/favicon.svg`);
   project.resources.forEach(resource => {
      fse.copySync(`./${buildDir}/${resource}`, `./${serveDir}/${resource}`);
   });

   server.listen(2020, '127.0.0.1');
})();
