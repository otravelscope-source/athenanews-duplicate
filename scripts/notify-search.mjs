import {readFile, writeFile, mkdir, appendFile} from 'node:fs/promises';
const origin='https://athenawomensnews.pages.dev';
const key='ee0ca4a47f094671a811dfe4dc544067';
const stateFile='.indexnow/state.json';
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(url+': HTTP '+r.status);return r.text();};
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'");
if((await get(origin+'/'+key+'.txt')).trim()!==key)throw Error('Ownership file not live');
const xml=await get(origin+'/sitemap.xml');
const current={};
for(const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)){
 const loc=match[1].match(/<loc>(.*?)<\/loc>/)?.[1];
 if(!loc)throw Error('Sitemap entry missing location');
 const url=new URL(decode(loc));
 if(url.origin!==origin)throw Error('Unexpected sitemap host');
 current[url.href]=match[1].match(/<lastmod>(.*?)<\/lastmod>/)?.[1]||'static';
}
if(!Object.keys(current).length)throw Error('Empty sitemap');
let previous={};
try{previous=JSON.parse(await readFile(stateFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const changed=Object.keys(current).filter(u=>current[u]!==previous[u]);
const removed=Object.keys(previous).filter(u=>!(u in current));
const urls=[...changed,...removed];
for(let i=0;i<urls.length;i+=10000){
 const r=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({host:new URL(origin).host,key,keyLocation:origin+'/'+key+'.txt',urlList:urls.slice(i,i+10000)}),signal:AbortSignal.timeout(30000)});
 if(![200,202].includes(r.status))throw Error('IndexNow rejected submission: HTTP '+r.status);
 console.log('IndexNow HTTP '+r.status+' for '+urls.slice(i,i+10000).length+' URLs');
}
await mkdir('.indexnow',{recursive:true});
await writeFile(stateFile,JSON.stringify(current));
const report=urls.length?'Submitted '+urls.length+' new, changed or removed URLs. Receipt is not a guarantee of indexing.':'No changed URLs; no submission needed.';
console.log(report);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,report+'\n');
