import { readFile, readdir, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const api = 'https://lq6cok1w.api.sanity.io/v2025-02-19/data';
const site = 'https://athenawomensnews.pages.dev';
const day = date => new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Kampala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
const norm = text => text.toLowerCase().replace(/[^a-z0-9]/g,'');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const clean = text => typeof text === 'string' && !/https?:|www\.|\]\(|<[^>]+>|\[\d+\]|【||^\s*(references|bibliography|sources)\s*:/im.test(text);

export function validate(item, now = new Date()) {
  assert(item.version === 1 && item.approved === true, 'Not approved');
  assert(/^libfile_[a-zA-Z0-9_-]+$/.test(item.sourceLibraryId), 'Missing Library identity');
  assert(typeof item.topicKey === 'string' && /^[a-z0-9-]{5,180}$/.test(item.topicKey), 'Missing stable topic key');
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug), 'Invalid slug');
  assert(clean(item.title) && item.title.length > 10 && clean(item.subtitle || ''), 'Unclean title/subtitle');
  assert(['World','Health','Justice','Culture','Children','Perspectives'].includes(item.category), 'Unknown category');
  assert(clean(item.author) && item.author.trim(), 'Missing author');
  assert(typeof item.publishedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(item.publishedAt) && Number.isFinite(Date.parse(item.publishedAt)) && Date.parse(item.publishedAt) <= +now, 'Invalid/future original date');
  assert(item.review?.factsChecked === true && item.review?.duplicatesChecked === true && item.review?.imageRightsChecked === true, 'Incomplete editorial review');
  assert(Array.isArray(item.paragraphs) && item.paragraphs.length >= 3 && item.paragraphs.every(p => ['normal','h2'].includes(p.style) && clean(p.text) && p.text.trim()), 'Invalid prose or visible links/citations');
  const prose = item.paragraphs.map(p=>p.text).join('\n');
  assert(prose.length >= 600 && prose.trim().endsWith('The Athena Perspective.'), 'Incomplete article');
  assert(!/\b(TODO|lorem ipsum|insert quote|placeholder)\b/i.test(prose), 'Unfinished copy');
  const image = item.image;
  assert(image && clean(image.alt) && image.alt && clean(image.caption) && image.caption && clean(image.credit) && image.credit && image.license, 'Incomplete image metadata');
  const url = new URL(image.url), source = new URL(image.sourceUrl);
  assert(url.protocol === 'https:' && url.hostname === 'upload.wikimedia.org' && !url.search && !url.hash && !url.username && !url.password && /\.(jpe?g|png|webp)$/i.test(url.pathname), 'Image must use reviewed Wikimedia original');
  assert(source.protocol === 'https:' && source.hostname === 'commons.wikimedia.org' && !source.username && !source.password, 'Missing Commons licence source');
  assert(['Public domain','CC0','CC BY 4.0','CC BY-SA 4.0','CC BY 3.0','CC BY-SA 3.0','CC BY-SA 2.0'].includes(image.license), 'Unreviewed image licence');
  return item;
}

export function select(items, existing, now = new Date()) {
  const fresh = items.filter(i => !existing.some(e => e.sourceLibraryId === i.sourceLibraryId || e.slug === i.slug || norm(e.title || '') === norm(i.title) || e.topicKey === i.topicKey));
  const sorted = fresh.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  const unique = sorted.filter((i,n,a)=>a.findIndex(j=>j.sourceLibraryId===i.sourceLibraryId || j.slug===i.slug || j.topicKey===i.topicKey || norm(j.title)===norm(i.title))===n);
  return [...unique.filter(i=>day(i.publishedAt)===day(now)).slice(0,1), ...unique.filter(i=>day(i.publishedAt)<day(now)).slice(0,3)];
}

async function request(path, body) {
  const token = process.env.SANITY_WRITE_TOKEN;
  assert(token, 'SANITY_WRITE_TOKEN is missing');
  const response = await fetch(api + path, {method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  assert(response.ok, `Sanity request failed: HTTP ${response.status}`);
  return response.json();
}
const hash = s => createHash('sha256').update(s).digest('hex').slice(0,24);
export function documents(item) {
  const author = 'author-' + hash(item.author.trim());
  return [
    {_id:author,_type:'author',name:item.author.trim(),slug:{_type:'slug',current:item.author.toLowerCase().replace(/[^a-z0-9]+/g,'-')}},
    {_id:'category-'+item.category.toLowerCase(),_type:'category',title:item.category,slug:{_type:'slug',current:item.category.toLowerCase()}},
    {_id:'article-'+item.sourceLibraryId.replaceAll('_','-'),_type:'article',sourceLibraryId:item.sourceLibraryId,topicKey:item.topicKey,title:item.title,subtitle:item.subtitle || '',slug:{_type:'slug',current:item.slug},publishedAt:item.publishedAt,breaking:false,
      authors:[{_type:'reference',_ref:author,_key:'author0'}],category:{_type:'reference',_ref:'category-'+item.category.toLowerCase()},
      mainImage:{_type:'image',externalUrl:item.image.url,alt:item.image.alt,caption:item.image.caption,credit:`${item.image.credit}. ${item.image.license}.`,sourceUrl:item.image.sourceUrl},
      body:item.paragraphs.map((p,n)=>({_type:'block',_key:'b'+n,style:p.style,markDefs:[],children:[{_type:'span',_key:'s'+n,text:p.text,marks:[]}]}))}
  ];
}
async function summary(text) {
  console.log(text);
  if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,text+'\n');
}
async function verifyPage(item) {
  const url = `${site}/article/${item.slug}/`;
  for(let n=0;n<24;n++) {
    const response = await fetch(url,{signal:AbortSignal.timeout(20000)}).catch(()=>null);
    if(response?.ok) {
      const html=await response.text();
      if(html.includes('The Athena Perspective') && html.includes(item.image.url.replaceAll('&','&amp;'))) return url;
    }
    await new Promise(resolve=>setTimeout(resolve,20000));
  }
  throw new Error(`CMS saved but public page verification timed out: ${url}`);
}
export async function main() {
  const check = process.argv.includes('--check');
  const query = '*[_type == "article"]{_id,title,"slug":slug.current,sourceLibraryId,topicKey}';
  const {result:existing} = await request('/query/production?query='+encodeURIComponent(query));
  if(check) {
    await request('/mutate/production',{mutations:[{createIfNotExists:{_id:'drafts.athena-publisher-health',_type:'publisherHealth',purpose:'Private publisher credential check'}},{patch:{id:'drafts.athena-publisher-health',set:{checkedAt:new Date().toISOString()}}}]});
    await summary(`Sanity authentication and draft-write check passed. ${existing.length} article records found. No public article changed.`);
    return;
  }
  const items=[], held=[];
  for(const file of (await readdir('automation/queue')).filter(f=>f.endsWith('.json'))) {
    try {items.push(validate(JSON.parse(await readFile('automation/queue/'+file,'utf8'))));}
    catch(e){held.push(`${file}: ${e.message}`);}
  }
  if(held.length) await summary('Held articles:\n'+held.join('\n'));
  const selected = select(items,existing);
  for(const item of selected) {
    const image = await fetch(item.image.url,{method:'HEAD',signal:AbortSignal.timeout(30000)});
    assert(image.ok && (image.headers.get('content-type') || '').startsWith('image/'), 'Image unavailable: '+item.slug);
    await request('/mutate/production?visibility=sync',{mutations:documents(item).map(doc=>({createIfNotExists:doc}))});
    await summary('CMS saved: '+item.slug);
    await summary('Verified live: '+await verifyPage(item));
  }
  if(!selected.length) await summary('No eligible unpublished articles in the queue. No content changed.');
  if(held.length) process.exitCode=1;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(async e=>{await summary('Publishing failed: '+e.message);process.exitCode=1;});
