import { cleanPortableBody } from './portable-news.mjs';
import { plainText } from './article-format.mjs';
export function toLegacy(a) {
  if (a.snapshot) return a.snapshot;
  const blocks = cleanPortableBody(a.body).map(b => {
    if (b._type === 'image') {
      const alt = plainText(b.alt).replace(/[\[\]\n]/g, ' ');
      const caption = b.legacyCredit || [b.caption,b.credit].filter(Boolean).join(' ');
      return `![${alt}](${b.localUrl})\n${caption}`;
    }
    const text = (b.children || []).map(s=>s.text||'').join('');
    return (b.style === 'h2' ? '## ' : '') + text;
  });
  return {id:a.slug.current,title:a.title,subtitle:a.subtitle||'',category:a.category.title,
    author:a.authors.map(x=>x.name).join(', '),body:blocks.join('\n\n'),image:a.mainImage?.localUrl||'',
    credit:a.mainImage?.legacyCredit||[a.mainImage?.caption,a.mainImage?.credit].filter(Boolean).join(' '),
    published_at:a.publishedAt,updated:a.updatedAt||a.publishedAt,status:'published'};
}
