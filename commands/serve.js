import { createRequire } from "module";
const require = createRequire(import.meta.url);

import fs from 'fs';
import fse from 'fs-extra';
import * as utils from './utils.js';
import watch from 'node-watch';
import liveServer from 'live-server';


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
    await utils.exec(`npx leanweb build ${env}`);
  };

  const throttledBuild = utils.throttle(build);
  watch(process.cwd() + `/${utils.dirs.src}/`, { recursive: true }, (eventType, filename) => {
    throttledBuild(eventType, filename);
  });

  build();

  const params = {
    port,
    host,
    root: utils.dirs.build,
    open: !noopen,
    file: 'index.html',
    wait: 1000,
    logLevel: 1,
  };
  liveServer.start(params);
})();
