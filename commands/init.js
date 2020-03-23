(async () => {
   const fs = require('fs');
   const path = require('path');
   const args = process.argv;
   const utils = require('./utils.js');

   const leanwebJSONExisted = fs.existsSync(`${process.cwd()}/leanweb.json`);

   if (leanwebJSONExisted) {
      console.error('Error: leanweb.json existed.');
      return;
   }

   let projectName = path.basename(path.resolve());

   if (args.length >= 3) {
      projectName = args[2];
   }


   const leanwebData = {
      name: projectName,
      components: []
   };
   fs.writeFileSync('leanweb.json', JSON.stringify(leanwebData, null, 2));

   await utils.exec(`npm i -D @babel/core`);
   await utils.exec(`npm i -D babel-loader`);
   await utils.exec(`npm i -D @babel/preset-env`);
   await utils.exec(`npm i -D @babel/plugin-proposal-class-properties`);
   await utils.exec(`npm i -D @babel/plugin-transform-runtime`);

   await utils.exec(`npx leanweb generate root`);

   await utils.exec(`cp -R ${__dirname}/../templates/lib ./src/`);
   let htmlString = fs.readFileSync(`${__dirname}/../templates/index.html`, 'utf8');
   htmlString = htmlString.replace(/\$\{project\.name\}/g, projectName);
   fs.writeFileSync(`./src/index.html`, htmlString);
   fs.writeFileSync(`./src/${projectName}.scss`, '');
})();