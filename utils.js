const { exec } = require('child_process');

module.exports.exec = command => new Promise((res =>
  exec(command, (err, stdout, stderr) => {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    res();
  })
));