const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(path, imports) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
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
      for (const name of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'maybeSingle', 'order', 'range']) {
        chain[name] = (...args) => { calls.push({ table, name, args }); return chain; };
      }
      chain.then = (resolve, reject) => Promise.resolve(results.shift()).then(resolve, reject);
      return chain;
    },
    rpc: async (name, args) => { calls.push({ rpc: name, args }); return results.shift(); },
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
  assert.deepEqual(client.calls.find(c => c.name === 'update').args[0], { selected_index: 0, selected_indices: [0], published: true });
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
    const client = clientMock([{ data: null, error: null }, { data: { published: true, selected_indices: [0] } }]);
    assert.equal((await route(publish, client).PATCH(json({ selectedIndex: index }), context)).status, status);
  }
});

test('signed-out requests cannot publish or vote', async () => {
  const client = clientMock([], false);
  assert.equal((await route(publish, client).PATCH(json({}), context)).status, 401);
  assert.equal((await route(votes, client).PUT(json({}), context)).status, 401);
  assert.equal(client.calls.length, 0);
});

test('multiple choices are normalized; empty selection defaults to first; invalid choices rejected', async () => {
  for (const [choices, expected] of [[[2, 0, 2], [0, 2]], [[], [0]], [[0, 1, 2], [0, 1, 2]]]) {
    const client = clientMock([{ data: { id: 'media' }, error: null }]);
    assert.equal((await route(publish, client).PATCH(json({ selectedIndices: choices }), context)).status, 200);
    assert.deepEqual(client.calls.find(c => c.name === 'update').args[0].selected_indices, expected);
  }
  for (const choices of [[3], ['1'], null, 'all', [0, 1, 2, 0]]) {
    if (choices === null) continue;
    assert.equal((await route(publish, clientMock([])).PATCH(json({ selectedIndices: choices }), context)).status, 400);
  }
});

test('heart and downvote upserts replace the same user reaction per caption', async () => {
  for (const direction of [1, -1]) {
    const client = clientMock([{ data: { id: 'media', selected_indices: [0, 2] } }, { error: null }, { count: 7 }, { count: 2 }]);
    const response = await route(votes, client).PUT(json({ captionIndex: 2, direction }), context);
    assert.deepEqual(await response.json(), { reaction: direction, hearts: 7, downvotes: 2 });
    assert.deepEqual(client.calls.find(c => c.name === 'upsert').args, [
      { media_id: 'media', caption_index: 2, user_id: 'owner', direction },
      { onConflict: 'media_id,caption_index,user_id' },
    ]);
  }
});

test('removing a reaction is limited to the current user and caption', async () => {
  const client = clientMock([{ data: { id: 'media', selected_indices: [0] } }, { error: null }, { count: 0 }, { count: 1 }]);
  const response = await route(votes, client).DELETE(json({ captionIndex: 0 }), context);
  assert.deepEqual(await response.json(), { reaction: 0, hearts: 0, downvotes: 1 });
  assert.ok(client.calls.some(c => c.table === 'nyc_caption_votes' && c.name === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'));
  assert.ok(client.calls.some(c => c.table === 'nyc_caption_votes' && c.name === 'eq' && c.args[0] === 'caption_index' && c.args[1] === 0));
});

test('drafts and unselected captions cannot receive reactions', async () => {
  for (const media of [null, { id: 'media', selected_indices: [1] }]) {
    const client = clientMock([{ data: media }]);
    assert.equal((await route(votes, client).PUT(json({ captionIndex: 0, direction: 1 }), context)).status, 404);
    assert.ok(!client.calls.some(c => c.name === 'upsert'));
  }
});

test('invalid reactions never reach the database', async () => {
  for (const body of [{}, { captionIndex: 0, direction: 0 }, { captionIndex: 3, direction: 1 }, { captionIndex: '0', direction: -1 }]) {
    const client = clientMock([]);
    assert.equal((await route(votes, client).PUT(json(body), context)).status, 400);
    assert.equal(client.calls.length, 0);
  }
});

test('My captions filters by the authenticated owner; the public gallery filters published media', async () => {
  for (const mine of [true, false]) {
    const client = clientMock([{ data: [], error: null, count: 0 }]);
    const collection = load('app/gallery/CaptionCollection.tsx', {
      '@/lib/supabase-server': { createClient: async () => client },
      'next/link': { default: 'Link' },
      './VoteButton': { default: 'VoteButton' },
      '@/app/captions/DraftPublisher': { default: 'DraftPublisher' },
      '@/app/my-captions/DeleteCaptionButton': { default: 'DeleteCaptionButton' },
      'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    }).default;
    await collection({ mine });
    const filter = client.calls.find(c => c.name === 'eq');
    assert.deepEqual(filter.args, mine ? ['user_id', 'owner'] : ['published', true]);
    assert.ok(client.calls.some(c => c.name === 'eq' && c.args[0] === 'published' && c.args[1] === true));
  }
});

test('signed-out visitors cannot load the personal collection', async () => {
  const client = clientMock([], false);
  const collection = load('app/gallery/CaptionCollection.tsx', {
    '@/lib/supabase-server': { createClient: async () => client },
    'next/link': { default: 'Link' }, './VoteButton': { default: 'VoteButton' },
    '@/app/captions/DraftPublisher': { default: 'DraftPublisher' },
      '@/app/my-captions/DeleteCaptionButton': { default: 'DeleteCaptionButton' },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
  }).default;
  await collection({ mine: true });
  assert.equal(client.calls.length, 0);
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


test('deletion requires sign-in, a valid choice, and ownership', async () => {
  const anonymous = clientMock([], false);
  assert.equal((await route(publish, anonymous).DELETE(json({ captionIndex: 0 }), context)).status, 401);
  assert.equal(anonymous.calls.length, 0);
  for (const captionIndex of [undefined, -1, 3, '0', 1.5]) {
    const client = clientMock([]);
    assert.equal((await route(publish, client).DELETE(json({ captionIndex }), context)).status, 400);
    assert.equal(client.calls.length, 0);
  }
  const client = clientMock([{ data: null, error: null }]);
  assert.equal((await route(publish, client).DELETE(json({ captionIndex: 0 }), context)).status, 404);
  assert.ok(client.calls.some(c => c.name === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'));
  assert.ok(!client.calls.some(c => c.rpc));
});

test('deleting one caption preserves the photo; deleting the last caption or draft cleans it up', async () => {
  for (const [published, captionIndex, photoPath] of [[true, 2, null], [true, 0, 'owner/photo.png'], [false, null, 'owner/draft.png']]) {
    const client = clientMock([{ data: { id: 'media', published }, error: null }, { data: photoPath, error: null }]);
    const response = await route(publish, client).DELETE(json({ captionIndex }), context);
    assert.deepEqual(await response.json(), { deleted: true });
    assert.deepEqual(client.calls.find(c => c.rpc), { rpc: 'delete_own_nyc_caption', args: { p_media_id: 'media', p_caption_index: captionIndex } });
    assert.deepEqual(client.calls.filter(c => c.cleanup), photoPath ? [{ cleanup: [photoPath] }] : []);
  }
});

test('deletion errors do not remove photos and draft/saved choices cannot be mixed', async () => {
  for (const [published, captionIndex] of [[true, null], [false, 1]]) {
    const client = clientMock([{ data: { id: 'media', published }, error: null }]);
    assert.equal((await route(publish, client).DELETE(json({ captionIndex }), context)).status, 400);
    assert.ok(!client.calls.some(c => c.rpc || c.cleanup));
  }
  const client = clientMock([{ data: { id: 'media', published: true }, error: null }, { data: null, error: { message: 'failed' } }]);
  assert.equal((await route(publish, client).DELETE(json({ captionIndex: 0 }), context)).status, 503);
  assert.ok(!client.calls.some(c => c.cleanup));
});
