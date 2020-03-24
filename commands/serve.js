const fs = require('fs');
const utils = require('./utils.js');

(async () => {
   const build = (eventType, filename) => {
      console.log(eventType + ': ', filename);
      utils.exec(`npx leanweb build`);
   };

   const throttledBuild = utils.throttle(build);
   fs.watch(process.cwd() + '/src/', { recursive: true }, (eventType, filename) => {
      throttledBuild(eventType, filename);
   });
})();