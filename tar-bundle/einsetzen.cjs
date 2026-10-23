// Next vendort tar; ein pnpm-Override erreicht diese kompilierte Kopie nicht.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.dirname(require.resolve('next/package.json', {paths: ['/repo/apps/login']}));
assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version, '16.4.2');
const target = path.join(root, 'dist/compiled/tar/index.min.js');
const oldHash = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
assert.equal(oldHash, 'afc929b535e65468c4891a31b2243f3e6a24874707135b8e183ddc4e7cabba77',
  'Unbekannter Herstellerstand: eingebettetes tar erneut pruefen');
fs.copyFileSync('/tar-bundle/bundle/index.js', target);
fs.copyFileSync('/tar-bundle/bundle/licenses.txt', path.join(root, 'dist/compiled/tar/licenses.txt'));
console.log('Next16.4.2: bekannte tar7.5.11-Kopie durch geprueftes tar7.5.22-Bundle ersetzt');
