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
  const images = [item.image, ...(item.inlineImages || [])];
  assert(images.length >= 3 && images.length <= 6 && new Set(images.map(i=>i.url)).size === images.length, "Use 3–6 distinct reviewed images");
  for (const image of images) {
  assert(image && clean(image.alt) && image.alt && clean(image.caption) && image.caption && clean(image.credit) && image.credit && image.license, 'Incomplete image metadata');
  const url = new URL(image.url), source = new URL(image.sourceUrl);
  assert(url.protocol === 'https:' && url.hostname === 'upload.wikimedia.org' && !url.search && !url.hash && !url.username && !url.password && /\.(jpe?g|png|webp)$/i.test(url.pathname), 'Image must use reviewed Wikimedia original');
  assert(source.protocol === 'https:' && source.hostname === 'commons.wikimedia.org' && !source.username && !source.password, 'Missing Commons licence source');
  assert(['Public domain','CC0','CC BY 4.0','CC BY-SA 4.0','CC BY 3.0','CC BY 2.0','CC BY-SA 3.0','CC BY-SA 3.0 IGO','CC BY-SA 2.0'].includes(image.license), 'Unreviewed image licence');
  }
  assert((item.inlineImages || []).every(i=>Number.isInteger(i.afterParagraph) && i.afterParagraph >= 0 && i.afterParagraph < item.paragraphs.length - 1), "Invalid image placement");
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
const licenceUrl = name => ({'CC BY 2.0':'https://creativecommons.org/licenses/by/2.0/','CC BY 4.0':'https://creativecommons.org/licenses/by/4.0/','CC BY-SA 4.0':'https://creativecommons.org/licenses/by-sa/4.0/','CC BY-SA 3.0 IGO':'https://creativecommons.org/licenses/by-sa/3.0/igo/','CC BY-SA 3.0':'https://creativecommons.org/licenses/by-sa/3.0/','CC BY 3.0':'https://creativecommons.org/licenses/by/3.0/','CC BY-SA 2.0':'https://creativecommons.org/licenses/by-sa/2.0/','CC0':'https://creativecommons.org/publicdomain/zero/1.0/','Public domain':'https://creativecommons.org/publicdomain/mark/1.0/'})[name];
const imageDocument = image => ({_type:'image',externalUrl:image.url,alt:image.alt,caption:image.caption,credit:`${image.credit}. ${image.license}.`,sourceUrl:image.sourceUrl,legacyCredit:`${image.caption} ${image.credit}. ${image.license}. Source: ${image.sourceUrl} Licence: ${licenceUrl(image.license)}`});
export function documents(item) {
  const author = 'author-' + hash(item.author.trim());
  return [
    {_id:author,_type:'author',name:item.author.trim(),slug:{_type:'slug',current:item.author.toLowerCase().replace(/[^a-z0-9]+/g,'-')}},
    {_id:'category-'+item.category.toLowerCase(),_type:'category',title:item.category,slug:{_type:'slug',current:item.category.toLowerCase()}},
    {_id:'article-'+item.sourceLibraryId.replaceAll('_','-'),_type:'article',sourceLibraryId:item.sourceLibraryId,topicKey:item.topicKey,title:item.title,subtitle:item.subtitle || '',slug:{_type:'slug',current:item.slug},publishedAt:item.publishedAt,breaking:false,
      authors:[{_type:'reference',_ref:author,_key:'author0'}],category:{_type:'reference',_ref:'category-'+item.category.toLowerCase()},
      mainImage:imageDocument(item.image),
      body:item.paragraphs.flatMap((p,n)=>[{_type:'block',_key:'b'+n,style:p.style,markDefs:[],children:[{_type:'span',_key:'s'+n,text:p.text,marks:[]}]},...(item.inlineImages || []).filter(i=>i.afterParagraph===n).map((i,j)=>({...imageDocument(i),_key:'image'+n+'-'+j}))])}
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
      if(html.includes('The Athena Perspective') && [item.image,...(item.inlineImages || [])].every(i=>html.includes(i.url.replaceAll('&','&amp;')))) return url;
    }
    await new Promise(resolve=>setTimeout(resolve,20000));
  }
  throw new Error(`CMS saved but public page verification timed out: ${url}`);
}

export async function checkImage(url, fetcher = fetch) {
  const headers = {'User-Agent':'ATHENA-Publisher/1.0 (https://athenawomensnews.pages.dev/)'};
  let response = await fetcher(url,{method:'HEAD',headers,signal:AbortSignal.timeout(30000)}).catch(()=>null);
  if(response?.ok && (response.headers.get('content-type') || '').startsWith('image/')) return;
  response = await fetcher(url,{headers,signal:AbortSignal.timeout(30000)});
  assert(response.ok && (response.headers.get('content-type') || '').startsWith('image/'), 'Image unavailable: HTTP '+response.status);
  const reader=response.body.getReader();
  try { const chunk=await reader.read(); assert(!chunk.done && chunk.value.length>0,'Empty image response'); }
  finally { await reader.cancel(); }
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
  if(process.argv.includes('--refresh-oleshky-images')) {
    const item=validate(JSON.parse(await readFile('automation/queue/libfile_37fcd140f5288191b9b013dec1d2621d.json','utf8')));
    const id='article-libfile-37fcd140f5288191b9b013dec1d2621d';
    const {result:current}=await request('/query/production?query='+encodeURIComponent('*[_id == "'+id+'"][0]'));
    assert(current && current.slug.current===item.slug, 'Target article mismatch');
    if(current.automationImageRevision !== 1) {
      const blocks=current.body.filter(b=>b._type==='block');
      assert(JSON.stringify(blocks.map(b=>({style:b.style,text:b.children.map(c=>c.text).join('')})))===JSON.stringify(item.paragraphs), 'Article text changed: hold image update for review');
      for(const picture of [item.image,...item.inlineImages]) {
        const response=await fetch(picture.url,{method:'HEAD',signal:AbortSignal.timeout(30000)});
        assert(response.ok && (response.headers.get('content-type')||'').startsWith('image/'), 'Image unavailable');
      }
      const body=blocks.flatMap((b,n)=>[b,...item.inlineImages.filter(i=>i.afterParagraph===n).map((i,j)=>({...imageDocument(i),_key:'image'+n+'-'+j}))]);
      await request('/mutate/production?visibility=sync',{mutations:[{patch:{id,ifRevisionID:current._rev,set:{mainImage:imageDocument(item.image),body,automationImageRevision:1}}}]});
    }
    await summary('Verified image update: '+await verifyPage(item));
    return;
  }
  // Apply the two approved 27 November desk revisions only to their reviewed originals.
  const deskEdits = [{"_id":"article-libfile-0d02afb69b6c8191a457a70163465740","_rev":"LYB57fiulf74N68AsNd2co","keys":["b0","b1","image1-0","b2","image2-0","b3"],"k":"b1","ps":["Europa Clipper left Earth on 14 October 2024. NASA expects the spacecraft to reach Jupiter in April 2030 after travelling about 2.9 billion kilometres. Its destination matters: Clipper will orbit Jupiter, passing close to Europa repeatedly. Each encounter is a chance to measure a different stretch of ice. A finding on one pass can be tested against another, rather than treated as typical of an entire moon.","One of its nine instruments, a radar called REASON, will send radio pulses into the surface and listen for echoes. Think about what happens at a buried boundary: some of the signal continues down, while some returns to the spacecraft. The timing of a returning echo helps scientists estimate how far it travelled. Echoes from within the shell could reveal layers or pockets of liquid that a camera looking straight down would never see.","There is a catch. A radar signal loses strength as it travels. The properties of the ice affect how deeply it can penetrate and how much energy returns. A strong reflection could be a clue to an internal boundary; silence at greater depth would not prove there is no ocean. That is why NASA has put instruments that measure very different things on the same spacecraft.","Consider salt water. It conducts electricity. As Europa moves through Jupiter’s changing magnetic field, a conducting layer beneath the ice can produce a magnetic response of its own. Measuring that response gives scientists a second way to investigate an ocean that radar might never reach. Charged particles around Europa also affect the measurements, so the team needs observations of the surrounding plasma to separate those effects.","Surface chemistry adds another piece. If material from below has reached the surface, its composition could offer evidence about a place no spacecraft has sampled directly. But an interesting patch of ice is not a bottled sample of ocean water. Scientists must establish where the material came from and how it might have changed. The strongest case would come when the chemistry, ice structure and magnetic measurements tell a consistent story."]},{"_id":"article-libfile-55df670cf9148191822a0679521aa9b5","_rev":"rGoSilS1e8RitvcbcX9x7L","keys":["b0","b1","image1-0","b2","image2-0","b3"],"k":"b2","ps":["Annie’s experience raises two separate questions. How much money does a woman need to move? And which bills will follow her? A rent deposit is an immediate expense. A mortgage is a continuing one. A grant large enough to pay for a deposit can make a move possible without making the second month in the new home affordable.","In its 2024 study, Surviving Economic Abuse found that one in eight UK women who had held a joint mortgage in the preceding two years reported that a current or former partner had used it to abuse them financially. That figure concerns women with joint mortgages. It tells us nothing directly about how many renters face abuse, and it is not an estimate of the typical cost of leaving.","What makes a mortgage a means of control is that two people can have sharply different interests in the same agreement. The person still living in the home benefits from keeping it. The person who has left may need a sale to free up money for another place. Refusing to cooperate can impose costs on the former partner without requiring any contact at her new address. For Annie, continuing to pay was a way of limiting the financial damage, even as it drained money from her new household.","A separate survey by Ipsos and Surviving Economic Abuse asked a different question. Among UK women aged 18 or older who had experienced economic abuse, 23 per cent said it had prevented them from leaving an abusive partner. That is a measure of a barrier reported by survivors, not a measure of mortgage abuse. It captures something a tally of moving costs would miss entirely: women who could not afford to move do not have a removal bill to count.","Annie’s case offers a way to judge the help available. Ask what a survivor can pay for on the day she leaves. Then ask what income she will still have after the next mortgage payment falls due. The difference between those answers is where a promise of a fresh start can fall short."]}];
  for(const {_id,_rev,k,ps} of deskEdits){
    const {result:d}=await request('/query/production?query='+encodeURIComponent('*[_id=='+JSON.stringify(_id)+'][0]{_rev,body}'));
    if(d?._rev!==_rev) continue;
    const body=d.body.flatMap(b=>b._key!==k?[b]:ps.map((text,n)=>({...b,_key:n?k+'expanded'+n:k,children:[{_type:'span',_key:'text',text,marks:[]}]})));
    await request('/mutate/production?visibility=sync',{mutations:[{patch:{id:_id,ifRevisionID:_rev,set:{body,updatedAt:new Date().toISOString()}}}]});
  }
  const items=[], held=[];
  for(const file of (await readdir('automation/queue')).filter(f=>f.endsWith('.json'))) {
    try {const item=JSON.parse(await readFile('automation/queue/'+file,'utf8')); if(existing.some(e=>e.sourceLibraryId===item.sourceLibraryId || e.slug===item.slug || norm(e.title||'')===norm(item.title||''))) continue; items.push(validate(item));}
    catch(e){held.push(`${file}: ${e.message}`);}
  }
  if(held.length) await summary('Held articles:\n'+held.join('\n'));
  const selected = select(items,existing);
  for(const item of selected) {
    try {
    for(const picture of [item.image,...(item.inlineImages || [])]) {
      await checkImage(picture.url);
    }
    await request('/mutate/production?visibility=sync',{mutations:documents(item).map(doc=>({createIfNotExists:doc}))});
    await summary('CMS saved: '+item.slug);
    await summary('Verified live: '+await verifyPage(item));
    } catch(e) { held.push(item.slug+': '+e.message); await summary('Held: '+item.slug+': '+e.message); }
  }
  if(!selected.length) await summary('No eligible unpublished articles in the queue. No content changed.');
  if(held.length) process.exitCode=1;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(async e=>{await summary('Publishing failed: '+e.message);process.exitCode=1;});

