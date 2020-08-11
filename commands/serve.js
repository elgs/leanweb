const fse = require('fs-extra');
const utils = require('./utils.js');
const webpack = require('webpack');
const watch = require('node-watch');
const WebpackDevServer = require('webpack-dev-server');

(async () => {

   const project = require(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

   await utils.exec(`npx lw build`);

   const build = async (eventType, filename) => {
      // console.log(eventType + ': ', filename);
      await utils.exec(`npx lw build ` + filename);

      fse.copySync(`./${utils.dirs.build}/index.html`, `./${utils.dirs.serve}/index.html`);
      fse.copySync(`./${utils.dirs.build}/${project.name}.css`, `./${utils.dirs.serve}/${project.name}.css`);
      fse.copySync(`./${utils.dirs.build}/favicon.svg`, `./${utils.dirs.serve}/favicon.svg`);
      project.resources.forEach(resource => {
         fse.copySync(`./${utils.dirs.build}/${resource}`, `./${utils.dirs.serve}/${resource}`);
      });
   };

   const throttledBuild = utils.throttle(build);
   watch(process.cwd() + `/${utils.dirs.src}/`, { recursive: true }, (eventType, filename) => {
      throttledBuild(eventType, filename);
   });

   fse.copySync(`./${utils.dirs.build}/index.html`, `./${utils.dirs.serve}/index.html`);
   fse.copySync(`./${utils.dirs.build}/${project.name}.css`, `./${utils.dirs.serve}/${project.name}.css`);
   fse.copySync(`./${utils.dirs.build}/favicon.svg`, `./${utils.dirs.serve}/favicon.svg`);
   project.resources && project.resources.forEach(resource => {
      fse.copySync(`./${utils.dirs.build}/${resource}`, `./${utils.dirs.serve}/${resource}`);
   });

   const webpackConfig = utils.getWebPackConfig(utils.dirs.serve, project);

   const webpackDevConfig = {
      ...webpackConfig,
      mode: 'development',
      watch: true,
      devtool: 'eval-cheap-module-source-map',
      performance: {
         hints: false,
      },
   };

   const compiler = webpack(webpackDevConfig);

   const devServerOptions = {
      ...webpackDevConfig.devServer,
      contentBase: process.cwd() + `/${utils.dirs.serve}/`,
      watchContentBase: true,
      publicPath: '/',
      hot: true,
      open: true,
      stats: 'errors-warnings',
   };
   const server = new WebpackDevServer(compiler, devServerOptions);

   let port = 2020;
   while (await utils.portInUse(port)) {
      ++port;
   }
   server.listen(port, '127.0.0.1');
})();
