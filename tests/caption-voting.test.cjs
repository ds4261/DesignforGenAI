const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(path, imports) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, module, module.exports);
  return module.exports;
}

function clientMock(results, signedIn = true) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'owner' } : null } }) },
    from(table) {
      const chain = {};
      for (const name of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'maybeSingle']) {
        chain[name] = (...args) => { calls.push({ table, name, args }); return chain; };
      }
      chain.then = (resolve, reject) => Promise.resolve(results.shift()).then(resolve, reject);
      return chain;
    },
    storage: { from: () => ({
      upload: async () => ({ error: null }),
      remove: async (paths) => { calls.push({ cleanup: paths }); return { error: null }; },
    }) },
  };
}

function route(path, client, extras = {}) {
  return load(path, { '@/lib/supabase-server': { createClient: async () => client }, ...extras });
}
const context = { params: Promise.resolve({ id: 'media' }) };
const publish = 'app/api/media/[id]/route.ts';
const votes = 'app/api/media/[id]/vote/route.ts';
function json(body) { return new Request('http://localhost', { method: 'PATCH', body: JSON.stringify(body) }); }

test('publishing defaults to first caption and only updates the owner draft', async () => {
  const client = clientMock([{ data: { id: 'media' }, error: null }]);
  assert.equal((await route(publish, client).PATCH(json({}), context)).status, 200);
  assert.deepEqual(client.calls.find(c => c.name === 'update').args[0], { selected_index: 0, published: true });
  assert.ok(client.calls.some(c => c.name === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'));
  assert.ok(client.calls.some(c => c.name === 'eq' && c.args[0] === 'published' && c.args[1] === false));
});

test('publishing honors a selection and rejects out of range selections', async () => {
  const client = clientMock([{ data: { id: 'media' }, error: null }]);
  assert.equal((await route(publish, client).PATCH(json({ selectedIndex: 2 }), context)).status, 200);
  assert.equal(client.calls.find(c => c.name === 'update').args[0].selected_index, 2);
  for (const selectedIndex of [-1, 3, '1', 1.5]) {
    assert.equal((await route(publish, client).PATCH(json({ selectedIndex }), context)).status, 400);
  }
});

test('retrying the same published choice is safe but changing it is rejected', async () => {
  for (const [index, status] of [[0, 200], [1, 409]]) {
    const client = clientMock([{ data: null, error: null }, { data: { published: true, selected_index: 0 } }]);
    assert.equal((await route(publish, client).PATCH(json({ selectedIndex: index }), context)).status, status);
  }
});

test('signed-out requests cannot publish or vote', async () => {
  const client = clientMock([], false);
  assert.equal((await route(publish, client).PATCH(json({}), context)).status, 401);
  assert.equal((await route(votes, client).PUT(json({}), context)).status, 401);
  assert.equal(client.calls.length, 0);
});

test('votes use duplicate-safe insertion and report the actual count', async () => {
  const client = clientMock([{ data: { id: 'media' } }, { error: null }, { count: 7, error: null }]);
  const response = await route(votes, client).PUT(json({}), context);
  assert.deepEqual(await response.json(), { voted: true, votes: 7 });
  const insert = client.calls.find(c => c.name === 'upsert');
  assert.deepEqual(insert.args, [{ media_id: 'media', user_id: 'owner' }, { onConflict: 'media_id,user_id', ignoreDuplicates: true }]);
});

test('removing a vote only removes the current user vote; drafts cannot be voted on', async () => {
  const client = clientMock([{ data: { id: 'media' } }, { error: null }, { count: 0, error: null }]);
  const response = await route(votes, client).DELETE(json({}), context);
  assert.deepEqual(await response.json(), { voted: false, votes: 0 });
  assert.ok(client.calls.some(c => c.table === 'nyc_caption_votes' && c.name === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'));
  const missing = clientMock([{ data: null }]);
  assert.equal((await route(votes, missing).PUT(json({}), context)).status, 404);
  assert.ok(!missing.calls.some(c => c.name === 'upsert'));
});

test('generation stores original captions, exact prompts, model and photo; failed inserts clean up the photo', async () => {
  const prompts = load('lib/caption-prompts.ts', {});
  const validation = load('lib/caption-upload.ts', {});
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only';
  let payload;
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ captions: ['First', 'Second', 'Third'] }) }] } }] });
  };
  try {
    for (const fail of [false, true]) {
      const client = clientMock([{ error: fail ? { message: 'database failed' } : null }]);
      const form = new FormData(); form.set('photo', new File(['photo'], 'photo.png', { type: 'image/png' }));
      const response = await route('app/api/captions/route.ts', client, {
        '@/lib/caption-prompts': prompts, '@/lib/caption-upload': validation,
      }).POST(new Request('http://localhost', { method: 'POST', body: form }));
      assert.equal(response.status, fail ? 503 : 200);
      const row = client.calls.find(c => c.name === 'insert').args[0];
      assert.equal(row.system_prompt, payload.systemInstruction.parts[0].text);
      assert.equal(row.user_prompt, payload.contents[0].parts[0].text);
      assert.equal(row.selected_index, 0);
      assert.deepEqual(row.captions, ['First', 'Second', 'Third']);
      assert.ok(row.model);
      assert.ok(row.photo_path.startsWith('owner/'));
      assert.equal(client.calls.some(c => c.cleanup), fail);
      if (!fail) assert.equal((await response.json()).mediaId, row.id);
    }
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});
