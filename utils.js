const { exec } = require('child_process');
const sass = require('node-sass');

module.exports.exec = command => new Promise((res =>
  exec(command, (err, stdout, stderr) => {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    res();
  })
));

module.exports.buildCSS = scssString => {
  if (scssString.trim()) {
    const cssResult = sass.renderSync({ data: scssString });
    return cssResult.css.toString().trim();
  }
  return '';
};