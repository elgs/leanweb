const fs = require('fs');
const utils = require('./utils.js');
const liveServer = require("live-server");

(async () => {

   let port = 2020;
   let host = '127.0.0.1';

   if (process.argv.length > 2) {
      port = process.argv[2] * 1;
   }
   if (process.argv.length > 3) {
      host = process.argv[3];
   }

   const build = (eventType, filename) => {
      // console.log(eventType + ': ', filename);
      utils.exec(`npx leanweb build`);
   };

   const throttledBuild = utils.throttle(build);
   fs.watch(process.cwd() + '/src/', { recursive: true }, (eventType, filename) => {
      throttledBuild(eventType, filename);
   });

   const params = {
      port,
      host,
      root: process.cwd() + "/",
      open: true,
      wait: 1000,
      logLevel: 0, // 0 = errors only, 1 = some, 2 = lots
   };
   liveServer.start(params);
})();