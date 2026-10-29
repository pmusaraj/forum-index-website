import { readerPosts, relativeDate } from './markdown.js';

const $ = id => document.getElementById(id);
let topics = [];
let selectedSubject = "";
let selectedSubjectName = "Trending";
let controller;
const subjectOrder = new Map([
  'AI', 'Open Source', 'Jobs', 'Community', 'Creative', 'Automotive', 'Productivity', 'Tech',
].map((name, index) => [name, index]));
const subjectLabels = { opensource: 'Open Source', technology: 'Tech' };

function validTopic(topic) {
  return topic && Number.isSafeInteger(topic.id) && typeof topic.title === 'string';
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function render() {
  $('browse').setAttribute('aria-pressed', String(!selectedSubject));
  for (const button of $('subject-tabs').children) button.setAttribute('aria-pressed', String(button.dataset.subject === selectedSubject));
  $('heading').textContent = selectedSubjectName;
  const list = topics;
  $('topics').replaceChildren(...list.map(topic => {
    const article = element('article', 'topic');
    const content = element('div', 'topic-content');
    const meta = element('p', 'meta');
    meta.append(element('span', 'forum-name', topic.forum?.name || 'Forum discussion'));
    const replies = Number(topic.engagement?.replies);
    if (Number.isFinite(replies) && replies >= 0) {
      const count = element('span', 'replies');
      count.setAttribute('aria-label', `${replies} ${replies === 1 ? 'reply' : 'replies'}`);
      count.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7l-3.5 3v-3H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"/></svg>';
      count.append(document.createTextNode(String(replies)));
      meta.append(count);
    }
    const heading = element('h3', '');
    const url = safeURL(topic.url);
    if (url) {
      const link = element('a', '', topic.title);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (topic.reader_source === 'native' || topic.reader_source === 'converted') link.addEventListener('click', event => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openReader(topic, link);
      });
      heading.append(link);
    } else heading.textContent = topic.title;
    content.append(heading, meta);
    const icon = element('span', 'forum-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></svg>';
    const iconURL = safeURL(topic.forum?.icon_url);
    if (iconURL) {
      const image = element('img', '');
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.src = iconURL;
      image.addEventListener('error', () => image.remove(), { once: true });
      icon.append(image);
    }
    article.append(icon, content);
    return article;
  }));

}

async function load() {
  controller?.abort();
  const current = new AbortController();
  controller = current;
  topics = [];
  $('retry').hidden = true;
  $('status').textContent = 'Loading discussions…';
  render();
  try {
    const params = new URLSearchParams({ kind: 'topics', page: '1' });
    if (selectedSubject) params.set('subject', selectedSubject);
    const response = await fetch(`/api/feed?${params}`, { signal: current.signal });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (!Array.isArray(data.results)) throw new Error();
    topics = data.results.filter(validTopic).map(topic => ({ ...topic, feedPage: 1, feedSubject: selectedSubject }));
    $('status').textContent = topics.length ? '' : 'No discussions in this subject right now. Try another subject.';
  } catch (error) {
    if (error.name === 'AbortError') return;
    $('status').textContent = 'Could not load discussions. Please try again.';
    $('retry').hidden = false;
  } finally {
    if (controller === current) render();
  }
}

async function loadSubjects() {
  try {
    const response = await fetch('/api/feed?kind=subjects');
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (!Array.isArray(data.subjects)) throw new Error();
    const subjects = data.subjects.map(subject => ({
      ...subject,
      name: subjectLabels[subject.name.toLowerCase().replace(/[\s-]/g, '')] || subject.name,
    }));
    // Stable sorting keeps the remaining subjects in their feed order after Tech.
    subjects.sort((a, b) => (subjectOrder.get(a.name) ?? subjectOrder.size) - (subjectOrder.get(b.name) ?? subjectOrder.size));
    for (const subject of subjects) {
      const tab = element('button', '', subject.name);
      tab.dataset.subject = subject.slug;
      tab.setAttribute('aria-pressed', 'false');
      tab.addEventListener('click', () => {
        selectedSubject = subject.slug;
        selectedSubjectName = subject.name;
        load();
      });
      $('subject-tabs').append(tab);

    }
  } catch {
    $('taxonomy-status').textContent = 'Subject filters are unavailable. You can still browse trending discussions.';
  }
}

$('browse').addEventListener('click', () => { selectedSubject = ''; selectedSubjectName = 'Trending'; load(); });
$('retry').addEventListener('click', () => load());
render();
loadSubjects();
load();

let readerController;
let readerDateTimer;
let readerTrigger;
let feedScroll = 0;
async function openReader(topic, trigger) {
  readerController?.abort();
  clearInterval(readerDateTimer);
  const current = new AbortController();
  readerController = current;
  readerTrigger = trigger;
  feedScroll = window.scrollY;
  document.querySelector('main').hidden = true;
  $('reader').hidden = false;
  document.querySelector('.app-nav').hidden = true;
  document.querySelector('.reader-toolbar').hidden = false;
  $('reader-title').textContent = topic.title;
  $('reader-forum').textContent = topic.forum?.name || 'Forum discussion';
  $('reader-original').href = safeURL(topic.url);
  $('reader-status').textContent = 'Loading discussion…';
  $('reader-body').replaceChildren();
  window.scrollTo(0, 0);
  $('reader-title').focus({ preventScroll: true });
  try {
    const params = new URLSearchParams({ topic: String(topic.id), page: String(topic.feedPage) });
    if (topic.feedSubject) params.set('subject', topic.feedSubject);
    const response = await fetch(`/api/reader?${params}`, { signal: current.signal });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (typeof data.markdown !== 'string' || typeof window.markdownit !== 'function') throw new Error();
    const md = window.markdownit({ html: false, linkify: false });
    // No remote embeds or inline HTML. Resolve only ordinary HTTPS discussion links.
    md.renderer.rules.image = (tokens, index) => md.utils.escapeHtml(tokens[index].content || '[Image]');
    const posts = readerPosts(data.markdown).map(post => {
      const section = element('section', 'reader-post');
      if (post.username) {
        const header = element('div', 'post-author');
        const avatar = element('span', 'post-avatar');
        avatar.setAttribute('aria-hidden', 'true');
        avatar.innerHTML = '<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="14" fill="currentColor" opacity=".15"/><circle cx="14" cy="10" r="5" fill="currentColor"/><path d="M5 26v-3a9 9 0 0 1 18 0v3" fill="currentColor"/></svg>';
        const avatarURL = safeURL(post.avatar);
        if (avatarURL) {
          const image = element('img', '');
          image.src = avatarURL;
          image.alt = '';
          image.loading = 'lazy';
          image.referrerPolicy = 'no-referrer';
          image.addEventListener('error', () => image.remove(), { once: true });
          avatar.append(image);
        }
        header.append(avatar, element('span', 'post-username', `@${post.username}`));
        if (post.publishedAt && relativeDate(post.publishedAt)) {
          const date = new Date(post.publishedAt);
          const time = element('time', 'post-date', relativeDate(post.publishedAt));
          time.dateTime = date.toISOString();
          time.title = date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
          time.setAttribute('aria-label', time.title);
          header.append(time);
        }
        section.append(header);
      }
      const body = element('div', 'post-body');
      const fragment = document.createElement('template');
      fragment.innerHTML = md.render(post.markdown);
      for (const link of fragment.content.querySelectorAll('a')) {
        let href;
        try { href = safeURL(new URL(link.getAttribute('href'), topic.url).href); } catch { /* invalid link */ }
        if (!href) link.removeAttribute('href');
        else { link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      }
      body.append(fragment.content);
      section.append(body);
      return section;
    });
    $('reader-body').replaceChildren(...posts);
    readerDateTimer = setInterval(() => {
      for (const time of $('reader-body').querySelectorAll('time')) time.textContent = relativeDate(time.dateTime);
    }, 60000);
    $('reader-status').textContent = '';
  } catch (error) {
    if (error.name !== 'AbortError') $('reader-status').textContent = 'This discussion could not be loaded in the preview. Open it on the forum instead.';
  }
}
$('reader-back').addEventListener('click', () => {
  readerController?.abort();
  clearInterval(readerDateTimer);
  $('reader').hidden = true;
  document.querySelector('.app-nav').hidden = false;
  document.querySelector('.reader-toolbar').hidden = true;
  document.querySelector('main').hidden = false;
  window.scrollTo(0, feedScroll);
  readerTrigger?.focus({ preventScroll: true });
});

// Reserve the exact bottom-bar height, including when text wraps or zoom changes.
new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty('--preview-note-height', `${entry.target.getBoundingClientRect().height}px`);
}).observe(document.querySelector('.preview-limit'));
