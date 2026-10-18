import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { bodyHTML } from '../src/lib/portable-news.mjs';
const block = (text, style = 'normal', key = 'b') => ({ _type:'block', _key:key, style, markDefs:[], children:[{_type:'span',_key:key+'s',text,marks:[]}] });
const html = bodyHTML([
  block('According to [WHO](https://example.test/report), children are affected. [1].'),
  block('The organisation described the change. Reuters: https://example.test/news'),
  {_type:'image',_key:'photo',localUrl:'/media/abcdef.webp',alt:'Contextual image',caption:'Archive photograph, 2025. Source: https://example.test/photo',credit:'Jane Doe. CC BY 4.0. Licence: https://creativecommons.org/licenses/by/4.0/'},
  block('Sources','h2','sources'),block('[1] WHO\nhttps://example.test/report'),block('The Athena Perspective.','normal','closing'),
]);
assert.doesNotMatch(html,/<a\b|https?:\/\/|\[1\]|<h2>Sources|Source:|Licence:/);
assert.match(html,/According to WHO, children are affected\./);
assert.match(html,/src="\/media\/abcdef.webp"/);
assert.match(html,/Jane Doe\. CC BY 4.0\./);
assert.match(html,/<p>The Athena Perspective\.<\/p>$/);
const linked = block('Plain attribution');linked.markDefs=[{_type:'link',_key:'l',href:'https://example.test'}];linked.children[0].marks=['l'];
assert.equal(bodyHTML([linked]),'<p>Plain attribution</p>');
assert.doesNotMatch(bodyHTML([block('<script>alert(1)</script>')]),/<script>/);
const directory = await mkdtemp(join(tmpdir(),'athena-migration-editorial-'));
try {
 const source=join(directory,'articles.json');
 const record={id:'format-fixture',title:'Formatting fixture',subtitle:'Test content only.',category:'World',author:'ATHENA',published_at:'2026-09-20T00:00:00.000Z',updated:'2026-10-16T00:00:00.000Z',revision:2,status:'published',image:'',credit:'',body:'According to [WHO](https://example.test/report), the evidence has limits. [1].\n\n![Archive photograph](/images/photo.jpg)\n\nArchive photograph by Jane Doe, 2025. CC BY 4.0. Source: https://example.test/photo\nLicence: https://creativecommons.org/licenses/by/4.0/\n\n## Sources\n\n[1] WHO\nhttps://example.test/report\n\nThe Athena Perspective.'};
 await writeFile(source,JSON.stringify([record]));
 execFileSync(process.execPath,[new URL('../../scripts/import-sanity.mjs',import.meta.url).pathname,source,directory],{stdio:'pipe'});
 const documents=(await readFile(join(directory,'sanity-preview.ndjson'),'utf8')).trim().split('\n').map(JSON.parse);
 const article=documents.find(d=>d._type==='article');
 assert.equal(article.slug.current,record.id);assert.equal(article.publishedAt,record.published_at);assert.equal(article.updatedAt,record.updated);assert.equal(article.legacyRevision,2);
 const text=article.body.filter(b=>b._type==='block').flatMap(b=>b.children).map(c=>c.text).join('\n');
 assert.doesNotMatch(text,/https?:\/\/|\[1\]|^Sources$/m);assert.match(text,/According to WHO/);
 const photo=article.body.find(b=>b._type==='image');assert(photo);assert.match(photo.legacyCredit,/https:\/\/creativecommons.org\/licenses\/by\/4.0/);assert.doesNotMatch(photo.caption,/https?:\/\//);
} finally { await rm(directory,{recursive:true,force:true}); }
console.log('Editorial rendering and dry-run migration checks passed.');
