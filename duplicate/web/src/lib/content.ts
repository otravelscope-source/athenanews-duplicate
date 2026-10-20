// Server/build only. Never import this module from a browser script.
import { createClient } from '@sanity/client';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { routeSlug } from './site.mjs';
import { articleBlocks, plainText } from './article-format.mjs';
export { bodyHTML } from './portable-news.mjs';
export { plainText, creditHTML } from './article-format.mjs';
const originalOrigin='https://athena-production-a95c.up.railway.app';
const externalHosts=new Set(['www.house.mn.gov','commons.wikimedia.org','thumb.wikimedia.org','upload.wikimedia.org','api.nga.gov']);
export function preservedImage(url:string):string {
 if(!url)throw new Error('Image has no uploaded asset or external URL');
 const u=new URL(url,originalOrigin);
 if(u.username||u.password||u.protocol!=='https:')throw new Error('Invalid image URL');
 if(u.origin===originalOrigin){
  if(!/^\/(images|uploads)\/[a-zA-Z0-9_.-]+$/.test(u.pathname)||u.search||u.hash)throw new Error('Unexpected original image path');
  return u.pathname;
 }
 if(!externalHosts.has(u.hostname))throw new Error('Unreviewed external image host: '+u.hostname);
 return u.href;
}
const slug=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||createHash('sha256').update(name).digest('hex').slice(0,24);
async function snapshotArticles(){
 const rows=JSON.parse(await readFile('../content/published-articles.json','utf8'));
 if(rows.some((r:any)=>r.status!=='published'))throw new Error('Unpublished record in public snapshot');
 return rows.map((r:any)=>{
  const snapshot={...r,image:r.image?preservedImage(r.image):'',body:r.body.replaceAll(originalOrigin,'')};
  const body=articleBlocks(snapshot.body).map((b:any,i:number)=>b.type==='image'
   ?{_type:'image',_key:'b'+i,localUrl:preservedImage(b.url),alt:b.alt,credit:plainText(b.credit),legacyCredit:b.credit,caption:b.caption}
   :{_type:'block',_key:'b'+i,style:b.type==='heading'?'h2':'normal',markDefs:[],children:[{_type:'span',_key:'s'+i,text:b.text,marks:[]}]});
  return {_id:'article-'+r.id,legacyId:r.id,title:r.title,subtitle:r.subtitle,slug:{current:r.id},publishedAt:r.published_at,updatedAt:r.updated,
   category:{title:r.category,slug:{current:slug(r.category)}},authors:[{name:r.author,slug:{current:slug(r.author)}}],body,snapshot,
   ...(r.image?{mainImage:{localUrl:preservedImage(r.image),alt:plainText(r.credit),credit:plainText(r.credit),legacyCredit:r.credit}}:{})};
 });
}
const copies=new Map<string,Promise<string>>();
async function localImage(url:string):Promise<string>{
 if(copies.has(url))return copies.get(url)!;
 const task=(async()=>{
  const u=new URL(url),prefix='/images/'+import.meta.env.SANITY_PROJECT_ID+'/'+(import.meta.env.SANITY_DATASET||'production')+'/';
  if(u.protocol!=='https:'||u.hostname!=='cdn.sanity.io'||!u.pathname.startsWith(prefix)||u.username||u.password)throw new Error('Unexpected Sanity image origin');
  u.searchParams.set('w','1600');u.searchParams.set('fit','max');u.searchParams.set('fm','webp');u.searchParams.set('q','82');
  const filename=createHash('sha256').update(u.href).digest('hex')+'.webp';
  const response=await fetch(u,{signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw new Error('Unable to download Sanity image');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>25*1024*1024)throw new Error('Image exceeds Pages size limit');
  await mkdir('public/media',{recursive:true});await writeFile('public/media/'+filename,bytes);return '/media/'+filename;
 })();copies.set(url,task);return task;
}
let pending:Promise<any[]>|undefined;
export function articles():Promise<any[]>{
 pending??=(async()=>{
  const source=import.meta.env.CONTENT_SOURCE||'sanity';let rows:any[];
  if(source==='snapshot')rows=await snapshotArticles();
  else if(source==='sanity'){
   const client=createClient({projectId:import.meta.env.SANITY_PROJECT_ID,dataset:import.meta.env.SANITY_DATASET||'production',apiVersion:'2025-02-19',useCdn:false,perspective:'published'});
   // Legacy stories can store a calendar date instead of a full ISO timestamp.
   // Interpret those dates at midnight UTC without changing the original value.
   rows=await client.fetch('*[_type == "article" && defined(publishedAt) && coalesce(dateTime(publishedAt), dateTime(publishedAt + "T00:00:00.000Z")) <= dateTime(now())] | order(publishedAt desc, updatedAt desc) {_id,legacyId,title,subtitle,slug,publishedAt,updatedAt,breaking,authors[]->{_id,name,slug,bio},category->{title,slug},mainImage{...,asset->{url}},body[]{..., _type == "image" => {asset->{url}}}}');
   for(const a of rows)for(const img of [a.mainImage,...(a.body||[]).filter((b:any)=>b._type==='image')].filter(Boolean))img.localUrl=img.asset?.url?await localImage(img.asset.url):preservedImage(img.externalUrl||img.originalUrl);
  }else throw new Error('CONTENT_SOURCE must be sanity or snapshot');
  if(!rows.length)throw new Error('No published articles: refusing an empty build');
  const seen=new Set<string>();
  for(const a of rows){
   if(!routeSlug(a.slug?.current)||seen.has(a.slug.current))throw new Error('Invalid or duplicate article path');seen.add(a.slug.current);
   if(!a.title?.trim()||!routeSlug(a.category?.slug?.current)||!a.category?.title?.trim())throw new Error('Missing title/category');
   if(!a.authors?.length||a.authors.some((p:any)=>!p.name?.trim()||!routeSlug(p.slug?.current)))throw new Error('Missing author');
   if(!Number.isFinite(Date.parse(a.publishedAt))||(a.updatedAt&&!Number.isFinite(Date.parse(a.updatedAt))))throw new Error('Invalid original date');
   if(!Array.isArray(a.body)||!a.body.length)throw new Error('Empty article body');
  }return rows;
 })();return pending;
}
