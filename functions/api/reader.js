import { onRequest as feed } from './feed.js';

const TTL = 3600;
const MAX_BYTES = 512 * 1024;
function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const topicID = url.searchParams.get('topic');
  if (!/^[1-9]\d{0,15}$/.test(topicID || '') || [...url.searchParams.keys()].some(key =>
    !['topic', 'page', 'subject'].includes(key) || url.searchParams.getAll(key).length !== 1)) {
    return json({ error: 'Invalid reader request.' }, 400);
  }
  // Resolve only a topic from an approved public feed; never fetch a caller-supplied URL.
  const feedURL = new URL('/api/feed', url);
  for (const key of ['page', 'subject']) if (url.searchParams.has(key)) feedURL.searchParams.set(key, url.searchParams.get(key));
  const response = await feed({ ...context, request: new Request(feedURL) });
  if (!response.ok) return response;
  const data = await response.json();
  const topic = data.results.find(topic => String(topic.id) === topicID);
  if (!topic || !topic.forum?.supports_markdown) return json({ error: 'Reader unavailable for this discussion.' }, 404);
  let target;
  try {
    target = new URL(topic.url);
    const host = target.hostname;
    if (target.protocol !== 'https:' || target.port || target.username || target.password
      || !host.includes('.') || /[:\[\]]/.test(host) || /^\d+\./.test(host)
      || /\.(localhost|local|internal|test)$/.test(host) || host === new URL(env.FORUM_API_URL).hostname
      || !target.pathname.startsWith('/t/')) throw new Error();
  } catch { return json({ error: 'Reader unavailable for this discussion.' }, 404); }

  const key = new Request(`${url.origin}/api/reader-cache?url=${encodeURIComponent(target.href)}`);
  const cached = await caches.default.match(key);
  if (cached && Date.now() - Number(cached.headers.get('X-Reader-Cached-At')) < TTL * 1000) {
    const result = new Response(cached.body, cached);
    result.headers.set('Cache-Control', 'no-store');
    result.headers.delete('X-Reader-Cached-At');
    return result;
  }
  try {
    const upstream = await fetch(target, { headers: { Accept: 'text/markdown' }, redirect: 'manual', signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!upstream.ok || upstream.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/markdown') throw new Error();
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let markdown = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error(); }
      markdown += decoder.decode(value, { stream: true });
    }
    markdown += decoder.decode();
    if (!markdown.trim()) throw new Error();
    const result = json({ markdown, url: target.href });
    const entry = result.clone();
    entry.headers.set('Cache-Control', `public, max-age=${TTL}`);
    entry.headers.set('X-Reader-Cached-At', String(Date.now()));
    waitUntil(caches.default.put(key, entry).catch(() => {}));
    return result;
  } catch {
    return json({ error: 'This discussion could not be loaded in the preview. Open it on the forum instead.' }, 502);
  }
}
