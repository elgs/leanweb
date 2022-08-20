import fse from 'fs-extra';
import * as utils from './utils.js';
import webpack from 'webpack';
import watch from 'node-watch';
import WebpackDevServer from 'webpack-dev-server';

import { createRequire } from "module";
const require = createRequire(import.meta.url);

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
         await utils.exec(`npx leanweb build ${env}`);
         fse.copySync(`./${utils.dirs.build}/index.html`, `./${utils.dirs.serve}/index.html`);
         fse.copySync(`./${utils.dirs.build}/${project.name}.css`, `./${utils.dirs.serve}/${project.name}.css`);
         fse.copySync(`./${utils.dirs.build}/favicon.svg`, `./${utils.dirs.serve}/favicon.svg`);
         project.resources?.forEach(resource => {
            const source = `./${utils.dirs.build}/${resource}`;
            if (fs.existsSync(source)) {
               fse.copySync(source, `./${utils.dirs.serve}/${resource}`, { filter: utils.copySymbolLinkFilter });
            }
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
