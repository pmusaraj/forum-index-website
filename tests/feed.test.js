import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/feed.js';

const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;
let entries, calls, pending;
beforeEach(() => {
  entries = new Map(); calls = []; pending = [];
  globalThis.caches = { default: {
    match: async key => entries.get(key.url)?.clone(),
    put: async (key, response) => { entries.set(key.url, response.clone()); },
  } };
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json({ results: [{ id: 1, title: 'Discussion', url: 'https://forum.example/t/1', forum: { name: 'Forum' }, secret: 'not public' }] });
  };
});
afterEach(() => { globalThis.fetch = originalFetch; globalThis.caches = originalCaches; });
async function request(query = '', options = {}, env = { FORUM_API_URL: 'https://backend.example' }) {
  const result = await onRequest({ request: new Request(`https://site.example/api/feed${query}`, options), env, waitUntil: task => pending.push(task) });
  await Promise.all(pending);
  return result;
}

test('shares canonical cached feeds and does not forward identity or upstream fields', async () => {
  const first = await request('', { headers: { Cookie: 'private=yes', Authorization: 'Bearer private' } });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('Cache-Control'), 'no-store');
  assert.equal((await first.json()).results[0].secret, undefined);
  await request('?page=1&kind=topics');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://backend.example/api/v2/topics?feed=trending&limit=30&page=1&language=en');
  assert.deepEqual(calls[0].options.headers, { Accept: 'application/json' });
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal([...entries.values()][0].headers.get('Cache-Control'), 'public, max-age=3600');
});

test('refetches at the one-hour boundary and never serves expired data on errors', async () => {
  await request();
  for (const entry of entries.values()) entry.headers.set('X-Feed-Cached-At', String(Date.now() - 3600000));
  globalThis.fetch = async () => { throw new Error('secret backend location'); };
  const response = await request();
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.ok(!(await response.text()).includes('secret backend'));
});

test('isolates subjects and pages', async () => {
  await request('?subject=programming&page=2');
  await request('?subject=programming&page=3');
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/subjects\/programming\/topics\?feed=trending&limit=30&page=2/);
});

test('rejects writes, arbitrary parameters, duplicate keys and unbounded pages', async () => {
  for (const query of ['?url=https://evil.example', '?kind=for_you', '?subject=../settings', '?page=0', '?page=101', '?page=1&page=2', '?kind=subjects&page=1']) {
    assert.equal((await request(query)).status, 400, query);
  }
  assert.equal((await request('', { method: 'POST' })).status, 405);
  assert.equal(calls.length, 0);
});

test('missing configuration fails without leaking its value', async () => {
  assert.equal((await request('', {}, {})).status, 503);
  assert.equal((await request('', {}, { FORUM_API_URL: 'http://private.example' })).status, 503);
  assert.equal(calls.length, 0);
});

test('normalizes taxonomy and strips unused fields', async () => {
  globalThis.fetch = async () => Response.json({ subjects: [{ name: 'Tech', slug: 'tech', private: true, subjects: [{ name: 'Code', slug: 'code' }] }] });
  const response = await request('?kind=subjects');
  assert.deepEqual(await response.json(), { subjects: [{ name: 'Tech', slug: 'tech', subjects: [{ name: 'Code', slug: 'code' }] }] });
});

test('does not cache upstream errors or malformed payloads', async () => {
  for (const response of [new Response(null, { status: 302, headers: { Location: 'https://private.example' } }), new Response('private error', { status: 500 }), new Response('<html>error</html>'), Response.json({ unexpected: [] })]) {
    globalThis.fetch = async () => response;
    assert.equal((await request()).status, 502);
    assert.equal(entries.size, 0);
  }
});

test('sets pagination only for a full page below the maximum', async () => {
  globalThis.fetch = async () => Response.json({ results: Array.from({ length: 30 }, (_, id) => ({ id, title: 'Topic' })) });
  assert.equal((await (await request()).json()).hasMore, true);
  assert.equal((await (await request('?page=100')).json()).hasMore, false);
});

test('honors the backend last page even when it is full', async () => {
  globalThis.fetch = async () => Response.json({ total_pages: 1, results: Array.from({ length: 30 }, (_, id) => ({ id, title: 'Topic' })) });
  assert.equal((await (await request()).json()).hasMore, false);
});

test('only exposes HTTPS forum icons outside the backend host', async () => {
  const icons = ['https://backend.example/assets/icon.png', 'http://forum.example/icon.png', 'javascript:alert(1)', 'https://user:pass@forum.example/icon.png', 'https://forum.example/icon.png'];
  globalThis.fetch = async () => Response.json({ results: icons.map((icon_url, id) => ({ id, title: 'Topic', forum: { name: 'Forum', icon_url } })) });
  const data = await (await request()).json();
  assert.deepEqual(data.results.map(topic => topic.forum.icon_url), [null, null, null, null, icons[4]]);
});
