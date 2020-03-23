const fs = require('fs');
const parcel = require('parcel-bundler');
const utils = require('./utils.js');

const options = {
   outDir: process.cwd() + '/dist/',
   outFile: 'index.html',
   publicUrl: './',
   watch: false,
   cache: true,
   cacheDir: process.cwd() + '/.cache',
   contentHash: true,
   // global: 'moduleName', // Expose modules as UMD under this name, disabled by default
   minify: true,
   scopeHoist: false,
   target: 'browser',
   sourceMaps: true,
   detailedReport: true,
   autoInstall: true,
};

(async () => {
   await utils.exec(`npx leanweb clean`);
   await utils.exec(`npx leanweb build`);

   const index = fs.readFileSync(process.cwd() + '/build/index.html', 'utf8');

   const scripts = [];
   let _index = index.replace(/<script\s+type\s*=\s*["']module["']\s+src\s*=(.*?)><\/script>/g, (m, a) => {
      scripts.push(a);
      return '';
   });
   _index += scripts.map(script => `<script src=${script}></script>`).join('\n');
   fs.writeFileSync(process.cwd() + '/build/_index.html', _index);

   const babelrc = '{"plugins":["@babel/plugin-proposal-class-properties"],"presets":[["env",{"targets":{"browsers":["last 2 Chrome versions"]}}]]}';
   fs.writeFileSync(process.cwd() + '/.babelrc', babelrc);

   const bundler = new parcel(process.cwd() + '/build/_index.html', options);
   await bundler.bundle();
   fs.unlinkSync(process.cwd() + '/.babelrc');
   fs.unlinkSync(process.cwd() + '/build/_index.html');
})();