import { onRequest as feed } from './feed.js';
import { conversionURL, withoutPagination, retryDeadline } from '../../lib/reader-source.js';

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
  if (!topic || !['native', 'converted'].includes(topic.reader_source)) return json({ error: 'Reader unavailable for this discussion.' }, 404);
  let target;
  try {
    const backend = new URL(env.FORUM_API_URL);
    target = topic.reader_source === 'converted' ? conversionURL(topic.id, backend) : new URL(topic.url);
    const host = target.hostname;
    if (target.protocol !== 'https:' || target.port || target.username || target.password
      || !host.includes('.') || /[:\[\]]/.test(host) || /^\d+\./.test(host)
      || /\.(localhost|local|internal|test)$/.test(host)
      || (topic.reader_source === 'native' && (host === backend.hostname || !target.pathname.startsWith('/t/')))) throw new Error();
  } catch { return json({ error: 'Reader unavailable for this discussion.' }, 404); }

  const retryKey = new Request(`${url.origin}/api/reader-retry?origin=${encodeURIComponent(target.origin)}`);
  const throttled = await caches.default.match(retryKey);
  if (throttled) {
    const { deadline, status } = await throttled.json();
    if (deadline > Date.now()) return retryResponse(deadline, status);
  }
  const key = new Request(`${url.origin}/api/reader-cache?version=2&url=${encodeURIComponent(target.href)}`);
  const cached = topic.reader_source === 'native' ? await caches.default.match(key) : null;
  if (cached && Date.now() - Number(cached.headers.get('X-Reader-Cached-At')) < TTL * 1000) {
    const result = new Response(cached.body, cached);
    result.headers.set('Cache-Control', 'no-store');
    result.headers.delete('X-Reader-Cached-At');
    return result;
  }
  try {
    const upstream = await fetch(target, { headers: { Accept: 'text/markdown' }, redirect: 'manual', signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!upstream.ok) {
      const deadline = retryDeadline(upstream.headers.get('Retry-After'));
      if (deadline) {
        const status = upstream.status === 429 ? 429 : 503;
        const entry = Response.json({ deadline, status }, { headers: { 'Cache-Control': `public, max-age=${Math.ceil((deadline - Date.now()) / 1000)}` } });
        waitUntil(caches.default.put(retryKey, entry).catch(() => {}));
        return retryResponse(deadline, status);
      }
      if (upstream.status === 429) return retryResponse(null, 429);
      throw new Error();
    }
    if (upstream.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/markdown') throw new Error();
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
    const result = json({ markdown: withoutPagination(markdown, target), url: topic.url });
    const entry = result.clone();
    entry.headers.set('Cache-Control', `public, max-age=${TTL}`);
    entry.headers.set('X-Reader-Cached-At', String(Date.now()));
    if (topic.reader_source === 'native' && !/\b(no-store|private)\b/i.test(upstream.headers.get('Cache-Control') || '')) {
      waitUntil(caches.default.put(key, entry).catch(() => {}));
    }
    return result;
  } catch {
    return json({ error: 'This discussion could not be loaded in the preview. Open it on the forum instead.' }, 502);
  }
}

function retryResponse(deadline, status) {
  const result = json({ error: 'This discussion is temporarily unavailable. Open it on the forum or try again later.' }, status);
  if (deadline) result.headers.set('Retry-After', String(Math.max(1, Math.ceil((deadline - Date.now()) / 1000))));
  return result;
}
