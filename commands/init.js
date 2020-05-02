(async () => {
   const fs = require('fs');
   const fse = require('fs-extra');
   const path = require('path');
   const git = require('isomorphic-git');
   const globby = require('globby');
   const args = process.argv;
   const utils = require('./utils.js');

   const leanwebJSONExisted = fs.existsSync(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);
   const packageJSONExisted = fs.existsSync(`${process.cwd()}/package.json`);

   const lwPackage = require(`${__dirname}/../package.json`);

   if (leanwebJSONExisted) {
      console.error('Error: leanweb.json existed.');
      return;
   }

   if (!packageJSONExisted) {
      utils.exec(`npm init -y`);
   }

   let projectName = path.basename(path.resolve());

   if (args.length >= 3) {
      projectName = args[2];
   }

   const leanwebData = {
      name: projectName,
      version: lwPackage.version,
      components: [],
      resources: [
         'resources/'
      ],
   };
   fs.mkdirSync(`${utils.dirs.src}/resources/`, { recursive: true });
   fs.writeFileSync(`${utils.dirs.src}/leanweb.json`, JSON.stringify(leanwebData, null, 2));

   utils.exec(`npm i -D @babel/core --loglevel=error`);
   utils.exec(`npm i -D babel-loader --loglevel=error`);
   utils.exec(`npm i -D @babel/preset-env --loglevel=error`);
   utils.exec(`npm i -D @babel/plugin-proposal-class-properties --loglevel=error`);
   utils.exec(`npm i -D @babel/plugin-transform-runtime --loglevel=error`);

   utils.exec(`npx lw generate root`);

   fse.copySync(`${__dirname}/../templates/lib`, `./${utils.dirs.src}/lib/`);

   let htmlString = fs.readFileSync(`${__dirname}/../templates/index.html`, 'utf8');
   htmlString = htmlString.replace(/\$\{project\.name\}/g, projectName);
   fs.writeFileSync(`./${utils.dirs.src}/index.html`, htmlString);
   fs.writeFileSync(`./${utils.dirs.src}/global-styles.scss`, '');
   fse.copySync(`${__dirname}/../templates/favicon.svg`, `./${utils.dirs.src}/favicon.svg`);

   if (!(fs.existsSync(`${process.cwd()}/.git/`) && fs.statSync(`${process.cwd()}/.git/`).isDirectory())) {
      await git.init({ fs, dir: process.cwd() });

      if (fs.existsSync(`${process.cwd()}/.gitignore`) && fs.statSync(`${process.cwd()}/.gitignore`).isFile()) {
         fs.appendFileSync(`${process.cwd()}/.gitignore`, `\nnode_modules/\n${utils.dirs.build}/\n${utils.dirs.dist}/\n${utils.dirs.serve}/\n${utils.dirs.electron}/\n`, 'utf8');
      } else {
         fs.writeFileSync(`${process.cwd()}/.gitignore`, `node_modules/\n${utils.dirs.build}/\n${utils.dirs.dist}/\n${utils.dirs.serve}/\n${utils.dirs.electron}/\n`, 'utf8');
      }

      const paths = await globby(['./**', './**/.*'], { gitignore: true });
      for (const filepath of paths) {
         await git.add({ fs, dir: process.cwd(), filepath });
      }
      await git.commit({
         fs,
         dir: process.cwd(),
         author: {
            name: 'Leanweb',
            email: 'leanweb@leanweb.app',
         },
         message: 'Init commit.'
      })
   }
})();