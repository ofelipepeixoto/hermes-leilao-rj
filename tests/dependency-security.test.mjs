import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const braces = require('braces');
const fromMicromatch = createRequire(require.resolve('micromatch'));

test('a cadeia micromatch usa a implementação local explicitamente identificada', () => {
  assert.match(fromMicromatch.resolve('braces'), /vendor\/braces-bounded\/index\.js$/);
  assert.equal(require('braces/package.json').name, '@hermes/braces-bounded');
  assert.deepEqual(braces.expand('app/{page,layout}.{ts,tsx}'), ['app/page.ts','app/page.tsx','app/layout.ts','app/layout.tsx']);
  assert.deepEqual(braces.expand('{1..3}'), ['1','2','3']);
  assert.deepEqual(braces('src/{a,{b,c}}'), ['src/(a|(b|c))']);
});
test('padrões profundamente aninhados falham com erro controlado antes dos walkers', () => {
  for (const pattern of ['{'.repeat(2000)+'a,b'+'}'.repeat(2000), '('.repeat(2000)+'x'+')'.repeat(2000), '{'.repeat(2000)]) {
    for (const operation of [braces, braces.parse, braces.compile, braces.stringify, braces.expand]) {
      assert.throws(() => operation(pattern), error => error instanceof SyntaxError && /safe limit/.test(error.message));
    }
  }
  assert.doesNotThrow(() => braces.compile('{'.repeat(32)+'a,b'+'}'.repeat(32)));
});
test('walkers também limitam AST externa profunda, sem depender apenas do parser', () => {
  function ast() { const root = {type:'root',nodes:[]}; let node=root; for(let i=0;i<70;i++) { const child={type:'brace',nodes:[],parent:node}; node.nodes.push(child); node=child; } node.nodes.push({type:'text',value:'x'}); return root; }
  for (const operation of [braces.compile, braces.stringify, braces.expand]) assert.throws(() => operation(ast()), error => error instanceof SyntaxError && /AST nesting/.test(error.message));
});
