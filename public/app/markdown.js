// Remove only Discourse's generated topic envelope and metadata wrappers.
// Post content (including code examples containing HTML) remains Markdown.
export function readerMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  if (!lines[0]?.startsWith('# ') || !lines.slice(1).find(line => line.trim())?.startsWith('**URL:**')) return markdown;
  lines.shift();
  while (lines.length && (!lines[0].trim() || /^\*\*(URL|Category|Tags|Created|Posts|Posts on this page|Page|Showing post):\*\*/.test(lines[0]))) lines.shift();
  let fence = null;
  let metadata = false;
  return lines.filter(line => {
    const marker = line.trim().match(/^(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return true;
    }
    if (fence) return true;
    if (/^<div class=["']post-metadata["']>$/.test(line)) { metadata = true; return false; }
    if (metadata && line === '</div>') { metadata = false; return false; }
    return true;
  }).join('\n');
}
