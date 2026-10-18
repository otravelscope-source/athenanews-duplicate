import { siteOrigin } from '../lib/site.mjs';
export function GET(){const live=import.meta.env.SITE_NOINDEX==='false';return new Response(live?'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /studio/\nSitemap: '+siteOrigin(import.meta.env.SITE_URL)+'/sitemap-index.xml\n':'User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain; charset=utf-8'}});}
