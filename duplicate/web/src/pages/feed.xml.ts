import { articles } from '../lib/content';
import { rssXML, siteOrigin } from '../lib/site.mjs';
export async function GET(){return new Response(rssXML(await articles(),siteOrigin(import.meta.env.SITE_URL)),{headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});}
