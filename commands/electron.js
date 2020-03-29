(async () => {
   const fs = require('fs');
   const fse = require('fs-extra');
   const utils = require('./utils.js');
   if (!fs.existsSync(process.cwd() + '/src/electron.js')) {
      fse.copySync(`${__dirname}/../templates/electron.js`, `${process.cwd()}/src/electron.js`);
   }

   const leanwebJSONPath = `${process.cwd()}/src/leanweb.json`;
   const leanwebJSON = require(leanwebJSONPath);
   if (!leanwebJSON.electron) {
      utils.exec(`npm i -D electron --loglevel=error`);
      leanwebJSON.electron = true;
      fs.writeFileSync(leanwebJSONPath, JSON.stringify(leanwebJSON, null, 2));
   }

   utils.exec(`npx lw build`);
   utils.exec(`npx electron ${process.cwd()}/build/electron.js`);
})();
