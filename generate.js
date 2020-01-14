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
      if (cmpJSON === `${leanwebJSON.name}-${cmp.toLowerCase()}`) {
        console.error(`Error: component ${cmpJSON} existed.`);
        return;
      }
    }
  }

  leanwebJSON.components.push(...cmps.map(cmp => `${leanwebJSON.name}-${cmp.toLowerCase()}`));
  fs.writeFileSync(leanwebJSONPath, JSON.stringify(leanwebJSON, null, 2));

  for (const cmp of cmps) {
    const cmpName = `${leanwebJSON.name.toLowerCase()}-${cmp.toLowerCase()}`;
    const cmpPath = `src/components/${cmpName}/`;
    await utils.exec(`mkdir -p ${cmpPath}`);

    if (!fs.existsSync(`${cmpPath}/${cmpName}.js`)) {
      let jsString = fs.readFileSync(`${__dirname}/templates/component.js`, 'utf8');
      jsString = jsString.replace(/\$\{component\}/g, cmpName);

      fs.writeFileSync(`${cmpPath}/${cmpName}.js`, jsString);
    }

    if (!fs.existsSync(`${cmpPath}/${cmpName}.html`)) {
      fs.writeFileSync(`${cmpPath}/${cmpName}.html`, `<span lw-eval>name</span> works!`);
    }

    if (!fs.existsSync(`${cmpPath}/${cmpName}.scss`)) {
      fs.writeFileSync(`${cmpPath}/${cmpName}.scss`, '');
    }
  }
})();