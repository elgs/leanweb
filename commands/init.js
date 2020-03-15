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

   const projectNameLower = projectName.toLowerCase();

   const leanwebData = {
      name: projectNameLower,
      title: projectName,
      components: []
   };
   fs.writeFileSync('leanweb.json', JSON.stringify(leanwebData, null, 2));

   await utils.exec(`npx leanweb generate root`);

   await utils.exec(`cp -R ${__dirname}/../templates/lib ./src/`);
   let htmlString = fs.readFileSync(`${__dirname}/../templates/index.html`, 'utf8');
   htmlString = htmlString.replace(/\$\{project\.name\}/g, projectNameLower);
   htmlString = htmlString.replace(/\$\{project\.title\}/g, projectName);
   fs.writeFileSync(`./src/index.html`, htmlString);
   fs.writeFileSync(`./src/${projectNameLower}.scss`, '');
})();