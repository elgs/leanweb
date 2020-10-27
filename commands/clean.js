const fs = require('fs');
const utils = require('./utils.js');

(async () => {
   fs.rmSync(utils.dirs.build + '/', { recursive: true, force: true });
   fs.rmSync(utils.dirs.dist + '/', { recursive: true, force: true });
   fs.rmSync(utils.dirs.serve + '/', { recursive: true, force: true });
})();