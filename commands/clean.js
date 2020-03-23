(async () => {
   const utils = require('./utils.js');
   await utils.exec(`rm -rf build/ dist/`);
})();