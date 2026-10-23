// Regressionen der beiden Herstellerfixes plus Archiv-Roundtrip am fertigen Bundle.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {Readable} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const tar = require(path.resolve(process.argv[2] || 'bundle/index.js'));

async function main() {
  for (const api of ['create', 'extract', 'replace', 'list', 'Header', 'Pax', 'Parser']) {
    assert.equal(typeof tar[api], 'function', api);
  }
  assert.equal(new tar.Header({size: -1000}).size, undefined);
  assert.equal(tar.Pax.parse('14 size=-1000\n').size, undefined);
  assert.equal(tar.Pax.parse('13 size=1000\n').size, 1000);
  assert.equal(new tar.Parser().maxDecompressionRatio, 1000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbtr-tar-test-'));
  try {
    fs.writeFileSync(path.join(dir, 'sample.txt'), 'hello\n'.repeat(1000));
    fs.mkdirSync(path.join(dir, 'out'));
    const chunks = [];
    for await (const chunk of tar.c({cwd: dir, gzip: true}, ['sample.txt'])) chunks.push(chunk);
    const archive = Buffer.concat(chunks);
    assert.ok(archive.length < 8192);
    await pipeline(Readable.from([archive]), tar.x({cwd: path.join(dir, 'out')}));
    assert.equal(fs.readFileSync(path.join(dir, 'out/sample.txt'), 'utf8'), 'hello\n'.repeat(1000));
    await assert.rejects(new Promise((resolve, reject) => {
      const parser = new tar.Parser({maxDecompressionRatio: 1, onentry: entry => entry.resume()});
      parser.on('error', reject).on('end', resolve);
      parser.end(archive);
    }), /max decompression ratio exceeded/);
  } finally {
    // Ausschliesslich das unmittelbar hier erzeugte Verzeichnis.
    fs.rmSync(dir, {recursive: true});
  }
  console.log('tar-Bundle: API, Header/PAX-Grenzen, Dekompressionslimit und Roundtrip bestanden');
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
