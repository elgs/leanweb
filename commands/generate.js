(async () => {
   const fs = require('fs');
   const utils = require('./utils.js');

   const args = process.argv;
   if (args.length < 3) {
      console.error('Error: leanweb generate component-names');
      return;
   }

   const leanwebJSONPath = `${process.cwd()}/leanweb.json`;
   const leanwebJSON = require(leanwebJSONPath);
   const cmps = args.slice(2);

   for (const cmpJSON of leanwebJSON.components) {
      for (const cmp of cmps) {
         if (cmpJSON === cmp) {
            console.error(`Error: component ${cmpJSON} existed.`);
            return;
         }
      }
   }

   leanwebJSON.components.push(...cmps);
   fs.writeFileSync(leanwebJSONPath, JSON.stringify(leanwebJSON, null, 2));

   for (const cmp of cmps) {
      const cmpName = utils.getComponentName(cmp);
      const cmpPath = `src/components/${cmp}`;
      await utils.exec(`mkdir -p ${cmpPath}/`);

      if (!fs.existsSync(`${cmpPath}/${cmpName}.js`)) {
         let jsString = fs.readFileSync(`${__dirname}/../templates/component.js`, 'utf8');
         jsString = jsString.replace(/\$\{projectName\}/g, leanwebJSON.name);
         jsString = jsString.replace(/\$\{component\}/g, cmp.replace(/\//g, '-'));
         jsString = jsString.replace(/\$\{pathLevels\}/g, utils.getPathLevels(cmp));

         fs.writeFileSync(`${cmpPath}/${cmpName}.js`, jsString);
      }

      if (!fs.existsSync(`${cmpPath}/${cmpName}.html`)) {
         fs.writeFileSync(`${cmpPath}/${cmpName}.html`, `<slot></slot>\n<span lw>name</span> works!`);
      }

      if (!fs.existsSync(`${cmpPath}/${cmpName}.scss`)) {
         fs.writeFileSync(`${cmpPath}/${cmpName}.scss`, '');
      }
   }
})();