// Interpret Discourse's generated envelope, preserving each post's Markdown.
export function readerPosts(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const envelope = lines[0]?.startsWith('# ') && lines.slice(1).find(line => line.trim())?.startsWith('**URL:**');
  if (envelope) {
    lines.shift();
    while (lines.length && (!lines[0].trim() || /^\*\*(URL|Category|Tags|Created|Posts|Posts on this page|Page|Showing post):\*\*/.test(lines[0]))) lines.shift();
  }
  const posts = [];
  let body = [];
  let metadata = null;
  let fence = null;
  const append = (beforeMetadata = false) => {
    let content = body.join('\n').trim();
    if (beforeMetadata) content = content.replace(/\n\n---$/, '');
    if (content || metadata) posts.push({ ...metadata, markdown: content });
    body = [];
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      body.push(line);
      continue;
    }
    if (!fence && /^<div class=["']post-metadata["']>$/.test(line)) {
      const end = lines.indexOf('</div>', index + 1);
      if (end !== -1) {
        const block = lines.slice(index + 1, end);
        const author = block.find(line => /^(\*\*Author:\*\*|### Author:)/.test(line)) || '';
        const date = block.find(line => /^(\*\*Post date:\*\*|#### Post date:)/.test(line)) || '';
        const username = author.match(/\[@((?:\\.|[^\]])+)\]\(/)?.[1]?.replace(/\\([\\`*_{}\[\]()#+.!-])/g, '$1');
        if (username) {
          append(true);
          metadata = { username, avatar: author.match(/!\[[^\]]*\]\(([^\s)]+)\)/)?.[1] || null,
            publishedAt: date.match(/"(\d{4}-[^"\s]+)"/)?.[1] || null };
          index = end;
          continue;
        }
      }
    }
    const legacy = !fence && envelope && line.match(/^## Post \d+ by @([^\s]+) — (\d{4}-[^\s]+)$/);
    if (legacy) {
      append(true);
      metadata = { username: legacy[1].replace(/\\_/g, '_'), avatar: null, publishedAt: legacy[2] };
    } else body.push(line);
  }
  append();
  return posts;
}

export function relativeDate(value, now = Date.now()) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
