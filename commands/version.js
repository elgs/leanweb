import { createRequire } from "module";
const require = createRequire(import.meta.url);

const packageJSON = require('../package.json');
console.log(packageJSON.name, packageJSON.version);