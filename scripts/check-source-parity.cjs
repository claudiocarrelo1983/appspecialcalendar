const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const other = path.resolve(process.argv[2] || path.join(root, '..', path.basename(root) === 'Demo' ? 'FTXTeam' : 'Demo'));
function files(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).filter(entry =>
    !entry.isDirectory() || !['build', '.gradle', '.cxx', 'node_modules', '.git'].includes(entry.name)).flatMap(entry => {
    const relative = path.join(prefix, entry.name);
    return entry.isDirectory() ? files(path.join(dir, entry.name), relative) : [relative];
  });
}
const inputs = base => ['App.js', 'index.js', 'package-lock.json', ...['src', 'modules', 'plugins']
  .flatMap(dir => files(path.join(base, dir)).map(file => path.join(dir, file)))];
const current = inputs(root), reference = inputs(other);
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const differences = [...new Set([...current, ...reference])].filter(file => {
  const a = path.join(root, file), b = path.join(other, file);
  return !fs.existsSync(a) || !fs.existsSync(b) || digest(a) !== digest(b);
});
if (differences.length) throw new Error('Shared React Native source differs: ' + differences.join(', '));
const deps = base => {
  const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
  return { main: pkg.main, dependencies: pkg.dependencies, devDependencies: pkg.devDependencies };
};
require('node:assert/strict').deepEqual(deps(root), deps(other), 'Demo and FTX must use the same dependencies.');
console.log(`Shared React Native source and native modules: ${current.length} files and dependencies are identical between ${root} and ${other}.`);
