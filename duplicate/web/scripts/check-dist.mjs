import { readdir, stat } from 'node:fs/promises';
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
await check('dist');
if (files > 20000) throw new Error('Pages free file count exceeded');
console.log(JSON.stringify({ files, megabytes: Math.round(bytes / 1024 / 1024 * 10) / 10 }));
