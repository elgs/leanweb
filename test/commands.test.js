import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commandsDir = path.join(__dirname, '..', 'commands');

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Creates a temp project directory containing src/leanweb.json.
const makeTempProject = leanwebJSON => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leanweb-test-'));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'leanweb.json'), JSON.stringify(leanwebJSON, null, 2));
  return dir;
};

const addComponent = (dir, cmp, html) => {
  const cmpDir = path.join(dir, 'src', 'components', cmp);
  fs.mkdirSync(cmpDir, { recursive: true });
  fs.writeFileSync(path.join(cmpDir, `${cmp}.html`), html);
};

// Runs a command script with the temp project as cwd; never throws so tests
// can assert on the exit status directly.
const runCommand = (file, args, cwd) => {
  try {
    const stdout = execFileSync('node', [path.join(commandsDir, file), ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return { status: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
};

describe('commands', () => {

  describe('addpage', () => {
    it('should use the project name from leanweb.json, not the directory name', () => {
      const dir = makeTempProject({ name: 'customname', version: '1.0.0', components: [] });
      const result = runCommand('addpage.js', ['about'], dir);

      assert.equal(result.status, 0, result.stderr);
      const html = fs.readFileSync(path.join(dir, 'src', 'about.html'), 'utf8');
      assert.ok(html.includes('customname.js'), 'page should reference the bundle by the configured project name');
      assert.ok(!html.includes(path.basename(dir)), 'page should not reference the directory name');
    });
  });

  describe('build', () => {
    it('should build components and exit 0 on success', () => {
      const dir = makeTempProject({ name: 'demo', version: '1.0.0', components: ['root'] });
      addComponent(dir, 'root', '<div lw>1 + 1</div>');

      const result = runCommand('build.js', [], dir);

      assert.equal(result.status, 0, result.stderr);
      assert.ok(fs.existsSync(path.join(dir, 'build', 'demo.js')), 'entry module should be generated');
      const astFile = path.join(dir, 'build', 'components', 'root', 'ast.js');
      assert.ok(fs.existsSync(astFile), 'ast.js should be generated');
      assert.match(fs.readFileSync(astFile, 'utf8'), /^export default /);
    });

    it('should exit non-zero on an invalid template but still build the remaining components', () => {
      const dir = makeTempProject({ name: 'demo', version: '1.0.0', components: ['bad', 'good'] });
      addComponent(dir, 'bad', '<div lw-for="items">broken</div>');
      addComponent(dir, 'good', '<div lw>2 + 2</div>');

      const result = runCommand('build.js', [], dir);

      assert.notEqual(result.status, 0, 'build must fail so scripts and CI can detect it');
      assert.match(result.stderr, /Error building component bad/);
      assert.match(result.stderr, /Invalid lw-for expression/);
      assert.ok(!fs.existsSync(path.join(dir, 'build', 'components', 'bad', 'ast.js')), 'broken component should not produce an ast');
      assert.ok(fs.existsSync(path.join(dir, 'build', 'components', 'good', 'ast.js')), 'components after the broken one should still build');
    });
  });
});
