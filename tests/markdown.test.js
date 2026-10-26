import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readerPosts, relativeDate } from '../public/app/markdown.js';
const envelope = '# Topic\n\n**URL:** https://forum.example/t/1\n**Category:** Tech\n\n';
const metadata = '<div class="post-metadata">\n\n**Author:** ![Jane](https://forum.example/avatar.png) [@jane\\_doe](https://forum.example/u/jane)\\\n**Post date:** [Today](https://forum.example/t/1 "2026-10-26T10:00:00Z")\n\n</div>';

test('extracts avatar, username and timestamp and separates posts like the native reader', () => {
  const posts = readerPosts(envelope + metadata + '\n\nFirst **post**.\n\n---\n\n' + metadata + '\n\nSecond post.');
  assert.equal(posts.length, 2);
  assert.deepEqual(posts[0], { username: 'jane_doe', avatar: 'https://forum.example/avatar.png', publishedAt: '2026-10-26T10:00:00Z', markdown: 'First **post**.' });
  assert.equal(posts[1].markdown, 'Second post.');
});

test('keeps metadata-looking content inside fenced code unchanged', () => {
  const content = '```html\n' + metadata + '\n```';
  assert.deepEqual(readerPosts(envelope + content), [{ markdown: content }]);
});

test('preserves ordinary headings and malformed metadata', () => {
  const content = '# My post\n\n<div class="post-metadata">\nExample\n</div>';
  assert.deepEqual(readerPosts(content), [{ markdown: content }]);
});

test('supports the legacy post metadata headings', () => {
  assert.deepEqual(readerPosts(envelope + '## Post 1 by @jane — 2026-10-26T10:00:00Z\n\nHello'), [{ username: 'jane', avatar: null, publishedAt: '2026-10-26T10:00:00Z', markdown: 'Hello' }]);
});

test('matches iOS relative dates at minute, hour, and day boundaries', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  for (const [minutes, label] of [[-1, 'Just now'], [0, 'Just now'], [1, '1 minute ago'], [59, '59 minutes ago'], [60, '1 hour ago'], [120, '2 hours ago'], [1440, '1 day ago'], [2880, '2 days ago']]) {
    assert.equal(relativeDate(new Date(now - minutes * 60000).toISOString(), now), label);
  }
  assert.equal(relativeDate('invalid', now), '');
});
