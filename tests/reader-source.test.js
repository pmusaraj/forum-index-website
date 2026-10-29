import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withoutPagination, retryDeadline } from '../lib/reader-source.js';

const source=new URL('https://backend.example/api/v2/topics/123/markdown');
const header='# Topic\n\n**URL:** <https://forum.example/t/123>\n\n';
const next='[Next page](?page=2)';
test('removes generated pagination using the reader URL as the base',()=>{
 assert.equal(withoutPagination(header+'Body\n\n'+next+'\n',source),header+'Body\n');
});
test('preserves ordinary and code links and links to other topics',()=>{
 for(const value of [next,header+'```\n'+next,header+'```\n'+next+'\n```',header+'[Next page](https://other.example/t/123?page=2)']) {
  assert.equal(withoutPagination(value,source),value);
 }
});
test('Retry-After accepts seconds and HTTP dates',()=>{
 const now=Date.UTC(2026,0,1);
 assert.equal(retryDeadline('120',now),now+120000);
 assert.equal(retryDeadline('Thu, 01 Jan 2026 00:02:00 GMT',now),now+120000);
 assert.equal(retryDeadline('invalid',now),null);
 assert.equal(retryDeadline('-1',now),null);
});
