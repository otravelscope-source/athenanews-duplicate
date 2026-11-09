import { readdir, stat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
let files = 0;
let bytes = 0;
async function check(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) await check(path);
    else { const size = (await stat(path)).size; files++; bytes += size;
      if (size > 25 * 1024 * 1024) throw new Error('Pages file size exceeded: ' + path);
    }
  }
}
// Cloudflare Pages serves directory indexes with a trailing slash. Use that
// spelling in metadata, navigation and feeds only for actual built pages.
const origin = new URL(process.env.SITE_URL || 'https://example.invalid').origin;
const docs = await readdir('dist', {recursive:true});
const dirs = new Set(docs.filter(p=>p.endsWith('/index.html')).map(p=>'/'+p.slice(0,-11)));
function canonical(raw) {
  if (!(raw.startsWith('/') && !raw.startsWith('//')) && !raw.startsWith(origin+'/')) return raw;
  const match = raw.match(/^([^?#]*)([?#][\s\S]*)?$/);
  if(!match) return raw;
  const path = match[1].startsWith(origin+'/') ? match[1].slice(origin.length) : match[1];
  return dirs.has(path) ? match[1]+'/'+(match[2] || '') : raw;
}
for (const file of docs.filter(p=>p.endsWith('.html') || ['sitemap.xml','news-sitemap.xml','rss.xml','feed.xml'].includes(p))) {
  const dest=join('dist',file), before=await readFile(dest,'utf8');
  // Keep RSS GUIDs stable so subscribers don't receive repeat stories.
  const after=file.endsWith('.xml')
    ? before.replace(/<(loc|link)>([^<]*)<\/\1>/g,(_,tag,url)=>'<'+tag+'>'+canonical(url)+'</'+tag+'>')
    : before.replace(/(\b(?:href|content)=")([^"]*)(")/g,(_,a,url,b)=>a+canonical(url)+b)
      .replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
        (_,open,body,close)=>open+body.replace(/("(?:url|@id)"\s*:\s*")([^"]+)(")/g,(_m,a,url,b)=>a+canonical(url)+b)+close);
  if(after!==before) await writeFile(dest,after);
}

await check('dist');
if (files > 20000) throw new Error('Pages free file count exceeded');
console.log(JSON.stringify({ files, megabytes: Math.round(bytes / 1024 / 1024 * 10) / 10 }));
