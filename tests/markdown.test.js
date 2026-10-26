import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readerMarkdown } from '../public/app/markdown.js';

test('removes the generated topic header and metadata wrappers, preserving posts and code', () => {
  const markdown = '# Title\n\n**URL:** https://forum.example/t/1\n**Category:** Tech\n\n<div class="post-metadata">\n**Author:** Jane\n</div>\n\nHello **world**\n\n```html\n<div class="post-metadata">\n</div>\n```';
  assert.equal(readerMarkdown(markdown), '**Author:** Jane\n\nHello **world**\n\n```html\n<div class="post-metadata">\n</div>\n```');
});

test('does not strip headings or markup from documents without a Discourse envelope', () => {
  const markdown = '# My post\n\n<div class="post-metadata">\nExample\n</div>';
  assert.equal(readerMarkdown(markdown), markdown);
});
