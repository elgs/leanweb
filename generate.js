const fs = require('fs');

const args = process.argv;
if (args.length < 3) {
  console.error('leanweb generate component-names');
  return;
}

const leanwebJSONPath = `${process.cwd()}/leanweb.json`;
const leanwebJSON = require(leanwebJSONPath);
const cmps = args.slice(2);
leanwebJSON.components.push(...cmps.map(cmp => `${leanwebJSONPath.name}-${cmp.toLowerCase()}`));
fs.writeFileSync(leanwebJSONPath, JSON.stringify(leanwebJSON, null, 2));
cmps.forEach(cmp => {

});
