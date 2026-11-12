// Run with: node --test tests/quoted-search.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const script = scripts.at(-1)[1];
const source = script.slice(script.indexOf('function quotedTerms'), script.indexOf('function url()'));

function matcher(fetch) {
  const context = vm.createContext({ fetch, encodeURIComponent });
  vm.runInContext(source, context);
  return context;
}

test('quoted search terms match complete words and literal punctuation', () => {
  const search = matcher();
  assert.deepEqual(Array.from(search.quotedTerms('tool "raw" "pixel art"')), ['raw', 'pixel art']);
  assert.equal(search.wholePhrase('RAW converter', 'raw'), true);
  assert.equal(search.wholePhrase('draw', 'raw'), false);
  assert.equal(search.wholePhrase('éraw', 'raw'), false);
  assert.equal(search.wholePhrase('raw-file', 'raw'), true);
  assert.equal(search.wholePhrase('C++ tools', 'c++'), true);
});

test('selected fields and README fallback determine matches', async () => {
  let calls = 0;
  const search = matcher(async () => {
    calls++;
    return { ok: true, text: async () => 'A raw image converter' };
  });
  const repo = { name: 'draw', full_name: 'example/draw', description: 'Drawing software' };
  assert.equal(await search.matchesQuotedTerms(repo, ['raw'], ['name', 'description'], {}), false);
  assert.equal(calls, 0);
  assert.equal(await search.matchesQuotedTerms(repo, ['raw'], ['name', 'readme'], {}), true);
  assert.equal(calls, 1);
  assert.equal(await search.matchesQuotedTerms({ ...repo, name: 'raw-tool' }, ['raw'], ['name', 'readme'], {}), true);
  assert.equal(calls, 1);
});

test('missing README is excluded and rate limits are surfaced', async () => {
  const repo = { name: 'draw', full_name: 'example/draw' };
  assert.equal(await matcher(async () => ({ ok: false, status: 404 })).matchesQuotedTerms(repo, ['raw'], ['readme'], {}), false);
  await assert.rejects(matcher(async () => ({ ok: false, status: 403 })).matchesQuotedTerms(repo, ['raw'], ['readme'], {}), /rate limit/i);
});

test('application script parses', () => {
  assert.doesNotThrow(() => new vm.Script(script));
});
