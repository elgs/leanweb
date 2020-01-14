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

  projectNameLower = projectName.toLowerCase();

  const leanwebData = {
    name: projectNameLower,
    title: projectName,
    components: []
  };
  fs.writeFileSync('leanweb.json', JSON.stringify(leanwebData, null, 2));

  await utils.exec(`cp -R ${__dirname}/../lib ${process.cwd()}`);
  
  await utils.exec(`npx leanweb generate root`);
  fs.writeFileSync(`../src/${projectNameLower}.scss`, '');
})();