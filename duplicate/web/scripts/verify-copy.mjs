// Compare generated public pages against the unmodified source templates.
import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {home,articlePage,categories} from '../../../views.mjs';
const original='https://athena-production-a95c.up.railway.app';
const origin=process.env.SITE_URL||'https://athenawomensnews.pages.dev';
const rows=JSON.parse(await readFile('../content/published-articles.json','utf8')).map(a=>({...a,image:a.image.replace(original,''),body:a.body.replaceAll(original,'')}));
const main=html=>html.match(/<main\b[\s\S]*?<\/main>/)?.[0];
const check=async(path,expected)=>{
 const html=await readFile('dist/'+path,'utf8');
 assert.equal(main(html),main(expected),`Original page layout/content changed: ${path}`);
 assert.equal((html.match(/<html\b/g)||[]).length,1);
 for(const m of html.matchAll(/<(?:img|script)\b[^>]*src="([^"]+)"/g)){
  const url=m[1].replaceAll('&amp;','&');assert(!url.startsWith(original),'Source Railway dependency remains');
  if(url.startsWith('/'))await access('dist'+url.split('?')[0]);
 }return html;
};
await check('index.html',home(rows,'All stories',origin));
for(const category of categories)await check(`section/${category.toLowerCase()}/index.html`,home(rows.filter(a=>a.category===category),category,origin));
for(const a of rows){
 const related=rows.filter(r=>r.id!==a.id).sort((l,r)=>Number(r.category===a.category)-Number(l.category===a.category)).slice(0,3);
 const html=await check(`article/${a.id}/index.html`,articlePage(a,origin,related));
 assert(html.includes(`datetime="${a.published_at}"`),'Original date changed');
 const body=html.match(/<div class="article-body">([\s\S]*?)<\/div>/)?.[1]||'';
 assert(!/<a\b/i.test(body),'Article prose contains hyperlinks');
 assert(!/<h2>\s*(?:References|Sources|Bibliography)\s*<\/h2>/i.test(body),'Reference list in article');
}
assert.equal(await readFile('dist/style.css','utf8'),await readFile('../../public/style.css','utf8'),'Original stylesheet changed');
assert.equal(await readFile('dist/reader.js','utf8'),await readFile('../../public/reader.js','utf8'),'Audio/share controls changed');
const report={articlesVerified:rows.length,sectionPagesVerified:categories.length,homepageMatchesOriginal:true,articleTemplatesMatchOriginal:true,originalDatesPreserved:true,railwayRuntimeDependencies:0,articleBodyHyperlinks:0};
await writeFile('dist/copy-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
