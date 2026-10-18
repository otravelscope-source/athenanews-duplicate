import { articles } from '../lib/content';
import { newsSitemapXML, siteOrigin } from '../lib/site.mjs';
export async function GET(){return new Response(newsSitemapXML(await articles(),siteOrigin(import.meta.env.SITE_URL)),{headers:{'Content-Type':'application/xml; charset=utf-8'}});}
