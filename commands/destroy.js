import fs from 'fs';
import * as utils from './utils.js';

import { createRequire } from "module";
const require = createRequire(import.meta.url);

(async () => {
   const args = process.argv;
   if (args.length < 3) {
      console.log('Usage: lw destroy project-name');
      console.log(`This will delete ${utils.dirs.src}/ ${utils.dirs.build}/ ${utils.dirs.dist}/ and ${utils.dirs.serve}/`)
      return;
   }

   const projectName = args[2];

   const project = require(`${process.cwd()}/${utils.dirs.src}/leanweb.json`);

   if (projectName !== project.name) {
      console.error('Error: project name doesn\'t match.');
      return;
   }

   fs.rmSync(utils.dirs.build + '/', { recursive: true, force: true });
   fs.rmSync(utils.dirs.dist + '/', { recursive: true, force: true });
   fs.rmSync(utils.dirs.src + '/', { recursive: true, force: true });
   fs.rmSync(utils.dirs.serve + '/', { recursive: true, force: true });
})();