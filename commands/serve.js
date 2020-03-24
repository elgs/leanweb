const fs = require('fs');
const utils = require('./utils.js');
const liveServer = require("live-server");

(async () => {
   const build = (eventType, filename) => {
      // console.log(eventType + ': ', filename);
      utils.exec(`npx leanweb build`);
   };

   const throttledBuild = utils.throttle(build);
   fs.watch(process.cwd() + '/src/', { recursive: true }, (eventType, filename) => {
      throttledBuild(eventType, filename);
   });

   const params = {
      port: 2020,
      host: "127.0.0.1",
      root: process.cwd() + "/build/",
      open: true,
      ignore: 'node_modules/', // comma-separated string for paths to ignore
      file: "index.html",
      wait: 1000,
      logLevel: 0, // 0 = errors only, 1 = some, 2 = lots
   };
   liveServer.start(params);
})();