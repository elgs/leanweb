import fs from 'fs';
import * as utils from './utils.js';

fs.rmSync(utils.dirs.build + '/', { recursive: true, force: true });
fs.rmSync(utils.dirs.dist + '/', { recursive: true, force: true });