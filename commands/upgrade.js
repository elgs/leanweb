const semver = require('semver');
const fs = require('fs');
const fse = require('fs-extra');
const utils = require('./utils.js');

const leanwebPackageJSON = require(`${__dirname}/../package.json`);
const projectLeanwebJSON = require(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

const upgradeTo045 = () => {
   const projectName = projectLeanwebJSON.name;
   projectLeanwebJSON.components.forEach(cmp => {
      const component = projectName + '-' + cmp;

      const filePath = process.cwd() + `/${utils.dirs.src}/components/` + cmp + '/' + cmp + '.js';
      const oldSrc = fs.readFileSync(filePath, 'utf8');
      const newSrc = oldSrc.replace(/import\s+interpolation\s+from\s+\'.\/ast\.js\';/, 'import ast from \'./ast.js\';')
         .replace(/const\s+component\s+=\s+{\s+id\:\s+'.+?',\s+interpolation\s+};/, '')
         .replace(/component\.id/g, '\'' + component + '\'')
         .replace(/super\(component\);/, 'super(ast);');
      fs.writeFileSync(filePath, newSrc);
   });

   utils.exec(`npm i -D css-loader --loglevel=error`);
   utils.exec(`npm i -D style-loader --loglevel=error`);
   utils.exec(`npm i -D sass-loader --loglevel=error`);
   utils.exec(`npm i -D node-sass --loglevel=error`);
   utils.exec(`npm i -D json5-loader --loglevel=error`);
};

const upgradeAvailable = semver.gt(leanwebPackageJSON.version, projectLeanwebJSON.version);
if (upgradeAvailable) {
   fse.copySync(`${__dirname}/../templates/lib`, `./${utils.dirs.src}/lib/`);
   const oldVersion = projectLeanwebJSON.version;
   projectLeanwebJSON.version = leanwebPackageJSON.version;
   fs.writeFileSync(`${process.cwd()}/${utils.dirs.src}/leanweb.json`, JSON.stringify(projectLeanwebJSON, null, 2));

   if (semver.gte(leanwebPackageJSON.version, '0.4.5') && semver.lt(oldVersion, '0.4.5')) {
      upgradeTo045();
   }

   console.log('Leanweb upgraded:', oldVersion, '=>', leanwebPackageJSON.version);
}
