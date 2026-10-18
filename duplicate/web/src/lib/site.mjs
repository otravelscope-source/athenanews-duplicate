import { plainText } from './article-format.mjs';
import { cleanPortableBody } from './portable-news.mjs';
export const SITE_DESCRIPTION = 'Independent global news, culture and perspectives with women and children at the centre of the story.';
export const routeSlug = value => /^[a-zA-Z0-9_-]{1,180}$/.test(value || '');
export function siteOrigin(value) {
  const u = new URL(value || '');
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.pathname !== '/' || u.search || u.hash) throw new Error('SITE_URL must be the canonical HTTPS origin without a path or query');
  return u.origin;
}
export const articlePath = a => '/article/' + a.slug.current;
export const authorPath = a => '/author/' + a.slug.current;
export const sectionPath = a => '/section/' + a.slug.current;
export const absoluteUrl = (path, origin) => new URL(path, origin).href;
export const formatDate = value => new Intl.DateTimeFormat('en-GB', { dateStyle:'long', timeZone:'Africa/Kampala' }).format(new Date(value));
export const authorNames = a => a.authors.map(author => author.name).join(', ');
export function readingMinutes(a) {
  const words = cleanPortableBody(a.body).filter(b => b._type === 'block').flatMap(b => b.children || []).map(s => s.text || '').join(' ').trim();
  return Math.max(1, Math.ceil(words.split(/\s+/).filter(Boolean).length / 220));
}
export function sections(articles) {
  const entries = new Map(['World','Health','Justice','Culture','Children','Perspectives'].map(title => [title.toLowerCase(), {title,slug:{current:title.toLowerCase()}}]));
  for (const a of articles) entries.set(a.category.slug.current,a.category);
  return [...entries.values()];
}
export const authors = articles => [...new Map(articles.flatMap(a => a.authors).map(a => [a.slug.current,a])).values()];
export const jsonLD = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c => '\\u' + c.charCodeAt(0).toString(16).padStart(4,'0'));
export const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const publisherSchema = origin => ({'@type':'NewsMediaOrganization','@id':origin+'/#publisher',name:'ATHENA',url:origin+'/',logo:{'@type':'ImageObject',url:origin+'/favicon.svg'}});
export const websiteSchema = origin => ({'@context':'https://schema.org','@graph':[publisherSchema(origin),{'@type':'WebSite','@id':origin+'/#website',name:'ATHENA',url:origin+'/',description:SITE_DESCRIPTION,inLanguage:'en',publisher:{'@id':origin+'/#publisher'}}]});
export const authorSchema = (a,origin) => ({'@type':/^ATHENA(?:\s|$)/i.test(a.name)?'Organization':'Person',name:a.name,url:absoluteUrl(authorPath(a),origin)});
export function articleSchema(a,origin) {
  const url=absoluteUrl(articlePath(a),origin),photos=[a.mainImage,...a.body.filter(b=>b._type==='image')].filter(i=>i?.localUrl);
  return {'@context':'https://schema.org','@type':a.category.slug.current==='perspectives'?'Article':'NewsArticle','@id':url+'#article',mainEntityOfPage:{'@type':'WebPage','@id':url},url,headline:plainText(a.title),description:plainText(a.subtitle),articleSection:a.category.title,datePublished:a.publishedAt,
    ...(a.updatedAt && Date.parse(a.updatedAt)>=Date.parse(a.publishedAt)?{dateModified:a.updatedAt}:{}),author:a.authors.map(author=>authorSchema(author,origin)),publisher:publisherSchema(origin),
    ...(photos.length?{image:[...new Set(photos.map(i=>absoluteUrl(i.localUrl,origin)))]}:{}),inLanguage:'en',isAccessibleForFree:true};
}
export function sitemapXML(articles,origin) {
  const paths=['/','/about','/contact','/subscribe','/reader-privacy','/photo-credits',...sections(articles).map(sectionPath),...authors(articles).map(authorPath)];
  const entries=paths.map(path=>'<url><loc>'+xml(absoluteUrl(path,origin))+'</loc></url>');
  for(const a of articles){const modified=a.updatedAt&&Date.parse(a.updatedAt)>=Date.parse(a.publishedAt)?a.updatedAt:a.publishedAt;entries.push('<url><loc>'+xml(absoluteUrl(articlePath(a),origin))+'</loc><lastmod>'+xml(modified)+'</lastmod></url>');}
  if(entries.length>50000)throw new Error('Split the sitemap before exceeding 50,000 URLs');
  return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.join('')+'</urlset>';
}
export function newsSitemapXML(articles,origin,now=Date.now()) {
  const recent=articles.filter(a=>a.category.slug.current!=='perspectives'&&Date.parse(a.publishedAt)>=now-48*60*60*1000&&Date.parse(a.publishedAt)<=now).slice(0,1000);
  return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">'+recent.map(a=>'<url><loc>'+xml(absoluteUrl(articlePath(a),origin))+'</loc><news:news><news:publication><news:name>ATHENA</news:name><news:language>en</news:language></news:publication><news:publication_date>'+xml(a.publishedAt)+'</news:publication_date><news:title>'+xml(plainText(a.title))+'</news:title></news:news></url>').join('')+'</urlset>';
}
export function rssXML(articles,origin) {
  return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>ATHENA — News &amp; Perspectives</title><link>'+xml(origin+'/')+'</link><description>'+xml(SITE_DESCRIPTION)+'</description><language>en</language><atom:link href="'+xml(origin+'/feed.xml')+'" rel="self" type="application/rss+xml"/>'+articles.slice(0,100).map(a=>{const url=xml(absoluteUrl(articlePath(a),origin));return '<item><title>'+xml(plainText(a.title))+'</title><link>'+url+'</link><guid isPermaLink="true">'+url+'</guid><description>'+xml(plainText(a.subtitle))+'</description><category>'+xml(a.category.title)+'</category><pubDate>'+new Date(a.publishedAt).toUTCString()+'</pubDate></item>';}).join('')+'</channel></rss>';
}
