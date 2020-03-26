const fs = require('fs');

(async () => {
   fs.rmdirSync('build/', { recursive: true });
   fs.rmdirSync('dist/', { recursive: true });
})();