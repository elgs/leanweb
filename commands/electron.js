(async () => {
   const fs = require('fs');
   const utils = require('./utils.js');
   if (!fs.existsSync(process.cwd() + '/src/electron.js')) {
      utils.exec(`cp ${__dirname}/../templates/electron.js ${process.cwd()}/src/`);
   }
   utils.exec(`npx leanweb build`);
   utils.exec(`npx electron ${process.cwd()}/build/electron.js`);
})();