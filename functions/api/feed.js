const TTL = 3600;

function publicIcon(value, backend) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname !== backend.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function json(body, status = 200) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}

// Only public feeds are exposed. No client headers or arbitrary URLs reach the origin.
export async function onRequest({ request, env, waitUntil }) {
  if (request.method !== 'GET') {
    const response = json({ error: 'Method not allowed.' }, 405);
    response.headers.set('Allow', 'GET');
    return response;
  }
  const url = new URL(request.url);
  const params = url.searchParams;
  const kind = params.get('kind') || 'topics';
  const subject = params.get('subject') || '';
  const page = params.get('page') || '1';
  if ([...params.keys()].some(key => !['kind', 'subject', 'page'].includes(key) || params.getAll(key).length !== 1)
    || !['topics', 'subjects'].includes(kind)
    || (subject && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(subject))
    || subject.length > 100 || !/^[1-9]\d?$|^100$/.test(page)
    || (kind === 'subjects' && (params.has('subject') || params.has('page')))) {
    return json({ error: 'Invalid feed request.' }, 400);
  }

  let upstream;
  try {
    const base = new URL(env.FORUM_API_URL);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error();
    const path = kind === 'subjects' ? 'subjects' : subject ? `subjects/${subject}/topics` : 'topics';
    upstream = new URL(`${base.href.replace(/\/$/, '')}/api/v2/${path}`);
    upstream.search = kind === 'subjects' ? 'window=5d&language=en' : `feed=trending&limit=30&page=${page}&language=en`;
  } catch {
    return json({ error: 'The feed is not configured yet.' }, 503);
  }

  // Canonical keys prevent query order and omitted defaults from bypassing the cache.
  const key = new Request(`${url.origin}/api/feed?version=2&kind=${kind}&subject=${subject}&page=${page}`);
  const cached = await caches.default.match(key);
  if (cached) {
    const created = Number(cached.headers.get('X-Feed-Cached-At'));
    if (created > 0 && Date.now() - created < TTL * 1000) {
      const response = new Response(cached.body, cached);
      response.headers.set('Cache-Control', 'no-store');
      response.headers.delete('X-Feed-Cached-At');
      return response;
    }
  }

  try {
    const response = await fetch(upstream, {
      headers: { Accept: 'application/json' }, redirect: 'manual',
      signal: AbortSignal.timeout(10000), cache: 'no-store',
    });
    if (!response.ok) throw new Error();
    const body = await response.json();
    let data;
    if (kind === 'subjects') {
      const subjects = body.subjects ?? body.areas;
      if (!Array.isArray(subjects)) throw new Error();
      const summarize = item => ({ name: item.name, slug: item.slug });
      data = { subjects: subjects.map(item => ({ ...summarize(item), subjects: (item.subjects || []).map(summarize) })) };
    } else {
      if (!Array.isArray(body.results)) throw new Error();
      data = { results: body.results.map(topic => ({
        id: topic.id, title: topic.title, url: topic.url, excerpt: topic.excerpt,
        forum: { name: topic.forum?.name, icon_url: publicIcon(topic.forum?.icon_url, upstream), supports_markdown: topic.forum?.supports_markdown === true }, published_at: topic.published_at,
        engagement: { replies: topic.engagement?.replies ?? 0 },
      })), hasMore: Number(page) < 100 && (Number.isInteger(body.total_pages)
        ? Number(page) < body.total_pages : body.results.length === 30) };
    }
    const result = json(data);
    const entry = result.clone();
    entry.headers.set('Cache-Control', `public, max-age=${TTL}`);
    entry.headers.set('X-Feed-Cached-At', String(Date.now()));
    waitUntil(caches.default.put(key, entry).catch(() => {}));
    return result;
  } catch {
    // Never forward backend errors, redirects, cookies, or expired feed data.
    return json({ error: 'Discussions are temporarily unavailable. Please try again.' }, 502);
  }
}
