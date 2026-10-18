import { rm, mkdir, writeFile } from 'node:fs/promises';
try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }

function providerOrigin(value, suffix) {
  const url = new URL(value || '');
  if (url.protocol !== 'https:' || !url.hostname.endsWith(suffix) || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`Set the HTTPS ${suffix} origin in the build environment`);
  }
  return url.origin;
}
const supabase = providerOrigin(process.env.PUBLIC_SUPABASE_URL, '.supabase.co');
const newsletter = providerOrigin(process.env.PUBLIC_SUBSTACK_URL, '.substack.com');
const { siteOrigin } = await import('../src/lib/site.mjs');
siteOrigin(process.env.SITE_URL);
await writeFile('public/_headers', `/*
${process.env.SITE_NOINDEX === 'false' ? '' : '  X-Robots-Tag: noindex, nofollow\n'}  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://www.house.mn.gov https://commons.wikimedia.org https://thumb.wikimedia.org https://upload.wikimedia.org https://api.nga.gov; connect-src 'self' ${supabase}; frame-src ${newsletter}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
/account
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow
/media/*
  Cache-Control: public, max-age=31536000, immutable
`);
await rm('public/media', { recursive: true, force: true });
await mkdir('public/media', { recursive: true });
