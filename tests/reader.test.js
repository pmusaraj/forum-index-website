import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/reader.js';
const oldFetch = globalThis.fetch;
const oldCaches = globalThis.caches;
let entries, calls, topicURL, markdownResponse, supportsMarkdown, readerField;
beforeEach(() => {
 entries = new Map(); calls = []; readerField = {}; topicURL = 'https://forum.example/t/discussion/123'; supportsMarkdown = true;
 markdownResponse = () => new Response('# A discussion\n\nHello **world**.', {headers:{'Content-Type':'text/markdown; charset=utf-8'}});
 globalThis.caches = {default:{match:async key=>entries.get(key.url)?.clone(),put:async(key,response)=>{entries.set(key.url,response.clone());}}};
 globalThis.fetch = async (url, options) => {
  calls.push({url:String(url),options});
  if (new URL(url).hostname === 'backend.example' && !new URL(url).pathname.endsWith('/markdown')) return Response.json({results:[{id:123,title:'A discussion',url:topicURL,...readerField,forum:{name:'Forum',supports_markdown:supportsMarkdown}}]});
  return markdownResponse();
 };
});
afterEach(()=>{globalThis.fetch=oldFetch;globalThis.caches=oldCaches;});
async function request(query='?topic=123&page=1') {
 const pending=[];
 const response=await onRequest({request:new Request('https://site.example/api/reader'+query),env:{FORUM_API_URL:'https://backend.example'},waitUntil:p=>pending.push(p)});
 await Promise.all(pending);
 return response;
}
test('fetches negotiated markdown only for a topic verified in the feed and caches it',async()=>{
 const response=await request();
 assert.equal(response.status,200);
 assert.match((await response.json()).markdown,/Hello/);
 await request();
 assert.equal(calls.length,2);
 assert.equal(calls[1].options.headers.Accept,'text/markdown');
 assert.equal(calls[1].options.redirect,'manual');
 assert.equal(response.headers.get('Cache-Control'),'no-store');
});
test('rejects arbitrary URLs and topics outside the feed',async()=>{
 assert.equal((await request('?topic=123&url=https://evil.example')).status,400);
 assert.equal((await request('?topic=999')).status,404);
 assert.equal(calls.length,1);
});
test('rejects unsupported forums',async()=>{
 supportsMarkdown=false;
 assert.equal((await request()).status,404);
 assert.equal(calls.length,1);
});
test('rejects local, private literal, backend, and non-topic targets',async()=>{
 for (const url of ['https://127.0.0.1/t/1','https://[::1]/t/1','https://host.local/t/1','https://backend.example/t/1','https://forum.example/admin','https://forum.example:444/t/1']) {
  entries.clear(); calls=[]; topicURL=url;
  assert.equal((await request()).status,404,url);
  assert.equal(calls.length,1);
 }
});
test('rejects HTML, redirects, empty and oversized content',async()=>{
 for(const response of [new Response('<h1>not markdown</h1>',{headers:{'Content-Type':'text/html'}}),new Response(null,{status:302}),new Response('',{headers:{'Content-Type':'text/markdown'}}),new Response('a'.repeat(512*1024+1),{headers:{'Content-Type':'text/markdown'}})]) {
  entries.clear(); markdownResponse=()=>response;
  assert.equal((await request()).status,502);
  assert.equal([...entries.keys()].some(key=>key.includes('reader-cache')),false);
 }
});
test('expired markdown is never served on failure',async()=>{
 await request();
 for (const [key,response] of entries) if(key.includes('reader-cache')) response.headers.set('X-Reader-Cached-At',String(Date.now()-3600000));
 markdownResponse=()=>new Response('down',{status:503});
 assert.equal((await request()).status,502);
});

test('converted topics use only the approved backend endpoint and retain the original URL', async () => {
 supportsMarkdown=false;
 readerField={reader_markdown_url:'https://backend.example/api/v2/topics/123/markdown'};
 markdownResponse=()=>new Response('# Topic\n\n**URL:** <https://forum.example/t/discussion/123>\n\nBody\n\n[Next page](https://backend.example/api/v2/topics/123/markdown?page=2)\n', {headers:{'Content-Type':'text/markdown','Cache-Control':'no-store'}});
 const response=await request();
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.url,topicURL);
 assert.ok(!JSON.stringify(data).includes('backend.example'));
 assert.match(data.markdown,/Body/);
 assert.equal(calls[1].url,readerField.reader_markdown_url);
 assert.deepEqual(calls[1].options.headers,{Accept:'text/markdown'});
 assert.equal(calls[1].options.redirect,'manual');
 await request();
 assert.equal(calls.length,3,'converted content is revalidated instead of cached for an hour');
 assert.equal([...entries.keys()].some(key=>key.includes('reader-cache')),false);
});

test('explicit null opts out even when the forum supports native Markdown',async()=>{
 readerField={reader_markdown_url:null};
 assert.equal((await request()).status,404);
 assert.equal(calls.length,1);
});

test('accepts an explicit native reader URL',async()=>{
 readerField={reader_markdown_url:topicURL};
 assert.equal((await request()).status,200);
 assert.equal(calls[1].url,topicURL);
});

test('rejects unapproved reader URLs from feeds',async()=>{
 for(const value of ['https://backend.example/api/v2/topics/999/markdown','https://backend.example/admin','https://backend.example/api/v2/topics/123/markdown?page=2','https://other.example/t/123','http://backend.example/api/v2/topics/123/markdown','https://user:pass@backend.example/api/v2/topics/123/markdown']) {
  entries.clear(); calls=[]; readerField={reader_markdown_url:value};
  assert.equal((await request()).status,404,value);
  assert.equal(calls.length,1);
 }
});

test('forwards Retry-After without leaking errors and blocks retries until it expires',async()=>{
 readerField={reader_markdown_url:'https://backend.example/api/v2/topics/123/markdown'};
 markdownResponse=()=>new Response('private backend diagnostics',{status:429,headers:{'Retry-After':'120'}});
 const first=await request();
 assert.equal(first.status,429);
 assert.ok(Number(first.headers.get('Retry-After'))>0);
 assert.ok(!(await first.text()).includes('private backend'));
 assert.equal((await request()).status,429);
 assert.equal(calls.length,2,'retry uses the edge cooldown, without another upstream request');
 for(const key of entries.keys()) if(key.includes('reader-retry')) entries.set(key,Response.json({deadline:Date.now()-1,status:429}));
 markdownResponse=()=>new Response('Recovered',{headers:{'Content-Type':'text/markdown'}});
 assert.equal((await request()).status,200);
 assert.equal(calls.length,3);
});

test('conversion failures do not cache content and preserve the webpage fallback',async()=>{
 readerField={reader_markdown_url:'https://backend.example/api/v2/topics/123/markdown'};
 for(const status of [404,409,502,503]) {
  entries.clear(); markdownResponse=()=>new Response('upstream details',{status});
  const response=await request();
  assert.equal(response.status,502);
  assert.match((await response.json()).error,/Open it on the forum/);
  assert.equal([...entries.keys()].some(key=>key.includes('reader-cache')),false);
 }
});
