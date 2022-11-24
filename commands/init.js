import fs from 'fs';
import fse from 'fs-extra';
import git from 'isomorphic-git';
import { globby } from 'globby';
import * as utils from './utils.js';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { createRequire } from "module";
const require = createRequire(import.meta.url);

(async () => {
   const args = process.argv;

   const leanwebJSONExisted = fs.existsSync(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

   const lwPackage = require(`${__dirname}/../package.json`);

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
      version: lwPackage.version,
      components: [],
      imports: [],
      resources: [
         'resources/'
      ],
   };

   const projectScss = `// html,
// body {
   // height: 100%;
   // width: 100%;
   // margin: 0 auto;
   // padding: 0;

   // font-family: "Roboto", "Helvetica", "Arial", sans-serif;
// }
`

   const globalScss = `// div {
//    color: tomato;
// }
`;

   fs.mkdirSync(`${utils.dirs.src}/resources/`, { recursive: true });
   fs.writeFileSync(`${utils.dirs.src}/leanweb.json`, JSON.stringify(leanwebData, null, 2));

   utils.exec(`npx leanweb generate root`);

   fse.copySync(`${__dirname}/../templates/lib`, `./${utils.dirs.src}/lib/`);

   let htmlString = fs.readFileSync(`${__dirname}/../templates/index.html`, 'utf8');
   htmlString = htmlString.replace(/\$\{project\.name\}/g, projectName);
   fs.writeFileSync(`./${utils.dirs.src}/index.html`, htmlString);
   fs.writeFileSync(`./src/${projectName}.scss`, projectScss);
   fs.writeFileSync(`./${utils.dirs.src}/global-styles.scss`, globalScss);
   fse.copySync(`${__dirname}/../templates/favicon.svg`, `./${utils.dirs.src}/favicon.svg`);
   fse.copySync(`${__dirname}/../templates/env.js`, `./${utils.dirs.src}/env.js`);
   fse.copySync(`${__dirname}/../templates/env/`, `./${utils.dirs.src}/env/`);

   if (!(fs.existsSync(`${process.cwd()}/.git/`) && fs.statSync(`${process.cwd()}/.git/`).isDirectory())) {
      await git.init({ fs, dir: process.cwd() });

      if (fs.existsSync(`${process.cwd()}/.gitignore`) && fs.statSync(`${process.cwd()}/.gitignore`).isFile()) {
         fs.appendFileSync(`${process.cwd()}/.gitignore`, `\nnode_modules/\n${utils.dirs.build}/\n${utils.dirs.dist}/\n${utils.dirs.serve}/\n`, 'utf8');
      } else {
         fs.writeFileSync(`${process.cwd()}/.gitignore`, `node_modules/\n${utils.dirs.build}/\n${utils.dirs.dist}/\n${utils.dirs.serve}/\n`, 'utf8');
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
         message: 'lw init'
      });
      console.log('\nSome useful commands:');
      console.log('"lw s" to start the dev server.');
      console.log('"lw di" to build for production. The output will be in dist/ directory.');
      console.log('"lw g my-new-component" to generate a new standard web component.');
      console.log('"lw h" to get more help information.');
   }
})();