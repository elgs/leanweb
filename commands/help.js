(async () => {

  const utils = require('./utils.js');

  if (process.argv.length < 3) {
    await utils.exec('npx leanweb version');
    console.log('Usage: leanweb target parameters');
    console.log('Targets:\n');
    Object.keys(utils.targets).forEach(t => {
      console.log(t);
    });
    console.log();
    return;
  }

  let target = process.argv[2];

  const targetCandidates = Object.keys(utils.targets).filter(t => t.startsWith(target));

  if (targetCandidates.length === 0) {
    console.error(`Error: target ${target} not found.`);
    return;
  } else if (targetCandidates.length > 1) {
    targetCandidates.forEach(t => {
      console.log(t);
    });
    return;
  }

  target = targetCandidates[0];
  console.log(utils.targets[target].note);
})();