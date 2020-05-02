const fs = require('fs');
const utils = require('./utils.js');

(async () => {
   fs.rmdirSync(utils.dirs.build + '/', { recursive: true });
   fs.rmdirSync(utils.dirs.dist + '/', { recursive: true });
   fs.rmdirSync(utils.dirs.serve + '/', { recursive: true });
})();