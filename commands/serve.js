const fse = require('fs-extra');
const utils = require('./utils.js');
const webpack = require('webpack');
const watch = require('node-watch');
const WebpackDevServer = require('webpack-dev-server');

let env = '';
const args = process.argv;
if (args.length >= 3) {
   env = args[2];
}

const host = process.env.host || '127.0.0.1';
let port = process.env.port || 2020;
const noopen = process.env.noopen || false;

(async () => {

   const project = require(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

   const build = async (eventType, filename) => {
      // console.log(eventType + ': ', filename);
      try {
         await utils.exec(`npx lw build ${env}`);
         fse.copySync(`./${utils.dirs.build}/index.html`, `./${utils.dirs.serve}/index.html`);
         fse.copySync(`./${utils.dirs.build}/${project.name}.css`, `./${utils.dirs.serve}/${project.name}.css`);
         fse.copySync(`./${utils.dirs.build}/favicon.svg`, `./${utils.dirs.serve}/favicon.svg`);
         project.resources?.forEach(resource => {
            fse.copySync(`./${utils.dirs.build}/${resource}`, `./${utils.dirs.serve}/${resource}`, { dereference: true });
         });
      } catch (e) {
         console.error(e);
      }
   };

   const throttledBuild = utils.throttle(build);
   watch(process.cwd() + `/${utils.dirs.src}/`, { recursive: true }, (eventType, filename) => {
      throttledBuild(eventType, filename);
   });

   build();

   const webpackConfig = utils.getWebPackConfig(utils.dirs.serve, project);

   const webpackDevConfig = {
      ...webpackConfig,
      mode: 'development',
      // watch: true,
      devtool: 'eval-cheap-module-source-map',
      performance: {
         hints: false,
      },
   };

   const compiler = webpack(webpackDevConfig);

   while (await utils.portInUse(port, host)) {
      ++port;
   }

   const devServerOptions = {
      ...webpackDevConfig.devServer,
      static: {
         directory: process.cwd() + `/${utils.dirs.serve}/`,
         watch: true,
      },
      port,
      host,
      open: !noopen,
   };
   const server = new WebpackDevServer(devServerOptions, compiler);

   server.start();
})();
