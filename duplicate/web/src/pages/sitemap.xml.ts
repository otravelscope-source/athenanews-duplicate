import { articles } from '../lib/content';
import { sitemapXML, siteOrigin } from '../lib/site.mjs';
export async function GET(){return new Response(sitemapXML(await articles(),siteOrigin(import.meta.env.SITE_URL)),{headers:{'Content-Type':'application/xml; charset=utf-8'}});}
