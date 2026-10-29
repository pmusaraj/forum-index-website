// The browser receives a capability, never the configured backend address.
export function conversionURL(id, backend) {
  return new URL(`${backend.href.replace(/\/$/, '')}/api/v2/topics/${id}/markdown`);
}

export function readerSource(topic, backend) {
  const value = Object.hasOwn(topic, 'reader_markdown_url')
    ? topic.reader_markdown_url : topic.forum?.supports_markdown === true ? topic.url : null;
  if (typeof value !== 'string') return null;
  try {
    const target = new URL(value);
    if (target.protocol !== 'https:' || target.username || target.password || target.hash) return null;
    if (Number.isSafeInteger(topic.id) && topic.id > 0 && target.href === conversionURL(topic.id, backend).href) return 'converted';
    if (target.href !== new URL(topic.url).href || target.hostname === backend.hostname) return null;
    return 'native';
  } catch { return null; }
}

// This preview intentionally displays one page; don't expose converter navigation URLs.
export function withoutPagination(markdown, target) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  if (!lines[0]?.startsWith('# ') || !lines.slice(1).find(line => line.trim())?.startsWith('**URL:**')) return markdown;
  const inCode = [];
  let fence;
  for (const line of lines) {
    inCode.push(Boolean(fence));
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!marker) continue;
    if (!fence) fence = marker[1];
    else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
  }
  let end = lines.length;
  while (end && !lines[end - 1].trim()) end--;
  let removed = false;
  while (end) {
    const link = lines[end - 1].match(/^\[(?:Next|Previous) page\]\(([^\s)]+)\)$/);
    if (!link || inCode[end - 1]) break;
    let url;
    try { url = new URL(link[1], target); } catch { break; }
    if (url.origin !== target.origin || url.pathname.replace(/\.md$/, '') !== target.pathname.replace(/\.md$/, '')
      || !/^[1-9]\d*$/.test(url.searchParams.get('page') || '')) break;
    removed = true;
    end--;
    while (end && !lines[end - 1].trim()) end--;
  }
  return removed ? lines.slice(0, end).join('\n') + '\n' : markdown;
}

export function retryDeadline(value, now = Date.now()) {
  if (!value) return null;
  const text = value.trim();
  const deadline = /^\d+$/.test(text) ? now + Number(text) * 1000 : Date.parse(text);
  return Number.isFinite(deadline) && deadline > now ? deadline : null;
}
