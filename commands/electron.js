(async () => {
   const fs = require('fs');
   const utils = require('./utils.js');
   if (!fs.existsSync(process.cwd() + '/src/electron.js')) {
      utils.exec(`cp ${__dirname}/../templates/electron.js ${process.cwd()}/src/`);
   }

   const leanwebJSONPath = `${process.cwd()}/leanweb.json`;
   const leanwebJSON = require(leanwebJSONPath);
   if (!leanwebJSON.electron) {
      utils.exec(`npm i -D electron --loglevel=error`);
      leanwebJSON.electron = true;
      fs.writeFileSync(leanwebJSONPath, JSON.stringify(leanwebJSON, null, 2));
   }

   utils.exec(`npx leanweb build`);
   utils.exec(`npx electron ${process.cwd()}/build/electron.js`);
})();