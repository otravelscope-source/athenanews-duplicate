// Dry run by default. --apply performs remote writes; --replace explicitly replaces
// imported documents. Use --replace only while all Sanity editorial work is frozen.
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, sep, basename, dirname } from 'node:path';
import { articleBlocks, plainText } from '../web/src/lib/article-format.mjs';
const [source, mediaRootArg, mediaMapArg] = process.argv.slice(2).filter(x => !x.startsWith('--'));
if (!source || !mediaRootArg) throw new Error('Usage: node scripts/import-sanity.mjs export/articles.json backup/snapshot [media-map.json] [--apply] [--replace]');
const apply = process.argv.includes('--apply');
const replace = process.argv.includes('--replace');
const rows = JSON.parse(await readFile(source, 'utf8'));
const mediaRoot = await realpath(resolve(mediaRootArg));
const mediaMap = mediaMapArg ? JSON.parse(await readFile(mediaMapArg, 'utf8')) : {};
const articles = rows.filter(a => a.status === 'published');
const shortHash = value => createHash('sha256').update(value).digest('hex').slice(0,24);
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || shortHash(value);
const references = new Map();
const needed = {};
const pending = new Map();
let client;
if (apply) {
  const { createClient } = await import('@sanity/client');
  for (const name of ['SANITY_PROJECT_ID','SANITY_DATASET','SANITY_WRITE_TOKEN']) if (!process.env[name]) throw new Error('Missing ' + name);
  client = createClient({ projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
    token: process.env.SANITY_WRITE_TOKEN, apiVersion: '2025-02-19', useCdn: false });
}
function recordImage(url, alt, credit) {
  let file = '';
  if (/^\/images\/[a-zA-Z0-9_.-]+$/.test(url)) file = 'public' + url;
  if (/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(url)) file = url.slice(1);
  needed[url] ??= { file, alt: alt || '', credit: credit || '', sourceUrl: '' };
}
// Preflight all media before ANY remote mutation.
for (const a of articles) {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(a.id) || !a.title || !a.body || !a.author || !a.category) throw new Error('Invalid article record: ' + a.id);
  if (!a.published_at || !Number.isFinite(Date.parse(a.published_at))) throw new Error('Missing original publication date: ' + a.id);
  if (a.image) recordImage(a.image, '', a.credit);
  for (const block of articleBlocks(a.body)) {
    if (block.type === 'image') recordImage(block.url, block.alt, block.credit);
  }
}
await writeFile(resolve(dirname(source), 'media-needed.json'), JSON.stringify(needed, null, 2), { mode: 0o600 });
for (const url of Object.keys(needed)) {
  const m = mediaMap[url];
  if (!m) { if (apply) throw new Error('Missing reviewed media mapping: ' + url); continue; }
  if (!m.alt?.trim() || !m.credit?.trim()) throw new Error('Media needs alt text and credit: ' + url);
  if (m.originalUrl) {
    const u = new URL(m.originalUrl);
    if (m.originalUrl !== url || m.file || u.protocol !== 'https:' || u.username || u.password || !['www.house.mn.gov','commons.wikimedia.org','thumb.wikimedia.org','upload.wikimedia.org','api.nga.gov'].includes(u.hostname)) throw new Error('Unreviewed external image: ' + url);
    pending.set(url, { ...m });
    continue;
  }
  if (!m.file) throw new Error('Media needs a local file: ' + url);
  const file = await realpath(resolve(mediaRoot, m.file));
  if (!file.startsWith(mediaRoot + sep)) throw new Error('Media file is outside the snapshot');
  if (m.sourceUrl) { const u = new URL(m.sourceUrl); if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Unsafe source URL'); }
  pending.set(url, { ...m, file });
}
const uploaded = new Map();
async function image(url, originalCredit = '', caption = '') {
  const info = pending.get(url) || needed[url];
  if (info.originalUrl) return { _type: 'image', originalUrl: info.originalUrl, alt: plainText(info.alt), credit: plainText(info.credit), caption: plainText(caption), legacyCredit: originalCredit };
  let assetId = 'image-DRYRUN-1x1-jpg';
  if (apply) {
    if (!uploaded.has(info.file)) {
      const asset = await client.assets.upload('image', createReadStream(info.file), { filename: basename(info.file) });
      uploaded.set(info.file, asset._id);
    }
    assetId = uploaded.get(info.file);
  }
  return { _type: 'image', asset: { _type: 'reference', _ref: assetId }, alt: info.alt,
    credit: plainText(info.credit), caption: plainText(caption), legacyCredit: originalCredit, ...(info.sourceUrl ? { sourceUrl: info.sourceUrl } : {}) };
}
async function portableText(body) {
  const blocks = [];
  for (const [index, block] of articleBlocks(body).entries()) {
    const key = 'b' + index;
    if (block.type === 'image') {
      blocks.push({ ...await image(block.url, block.credit, block.caption), _key: key });
      continue;
    }
    blocks.push({ _type: 'block', _key: key,
      style: block.type === 'heading' ? 'h2' : 'normal', markDefs: [],
      children: [{ _type: 'span', _key: key + 's0', text: block.text, marks: [] }] });
  }
  return blocks;
}

const documents = [];
for (const a of articles) {
  // Root IDs (no dots) are required for anonymous public-dataset reads.
  const authorId = 'author-' + shortHash(a.author.trim());
  const categoryId = 'category-' + slug(a.category);
  references.set(authorId, { _id: authorId, _type: 'author', name: a.author.trim(), slug: { _type: 'slug', current: slug(a.author) } });
  references.set(categoryId, { _id: categoryId, _type: 'category', title: a.category, slug: { _type: 'slug', current: slug(a.category) } });
  documents.push({ _id: 'article-' + a.id, _type: 'article', legacyId: a.id,
    // The existing ID stays in the slug so /article/<id> keeps working.
    slug: { _type: 'slug', current: a.id }, title: a.title, subtitle: a.subtitle,
    authors: [{ _type: 'reference', _ref: authorId, _key: 'author0' }],
    category: { _type: 'reference', _ref: categoryId }, publishedAt: a.published_at,
    updatedAt: a.updated, breaking: false, legacyRevision: a.revision,
    ...(a.image ? { mainImage: await image(a.image, a.credit) } : {}), body: await portableText(a.body) });
}
if (apply) {
  for (const doc of references.values()) await client.createIfNotExists(doc);
  // Sequential/idempotent article writes keep retry behavior simple and observable.
  for (const doc of documents) {
    if (replace) await client.createOrReplace(doc);
    else await client.createIfNotExists(doc);
  }
}
await writeFile(resolve(dirname(source), 'sanity-preview.ndjson'), [...references.values(), ...documents].map(x => JSON.stringify(x)).join('\n') + '\n', { mode: 0o600 });
console.log(JSON.stringify({ applied: apply, articles: documents.length, media: Object.keys(needed).length,
  heldForEditorialReview: rows.filter(a => a.status !== 'published').map(a => ({ id: a.id, status: a.status })) }));
