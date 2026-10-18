import { toHTML } from '@portabletext/to-html';
import { esc, plainText, isReferenceHeading } from './article-format.mjs';

export function cleanPortableBody(body = []) {
  const result = [];
  let references = false;
  for (const block of body) {
    if (block._type === 'image') {
      result.push(block);
      continue;
    }
    if (block._type !== 'block') continue;
    const original = (block.children || []).map(span => span.text || '').join('');
    if (isReferenceHeading(original)) { references = true; continue; }
    if (references) {
      if (/^The Athena Perspective\.$/i.test(original.trim()) || /^h[1-6]$/.test(block.style)) references = false;
      else continue;
    }
    const text = plainText(original.replace(/^\[[^\]]+\]:\s*.*$/gm, ''));
    if (!text) continue;
    result.push({ ...block, children: text === original ? block.children : [
      { _type: 'span', _key: block._key + '-clean', text, marks: [] },
    ] });
  }
  return result;
}

export function bodyHTML(body) {
  return toHTML(cleanPortableBody(body), { components: {
    types: { image: ({value}) => {
      if (!/^\/media\/[a-f0-9]+\.webp$/.test(value.localUrl || '')) throw new Error('Missing local image');
      const caption = plainText(value.caption || '');
      const credit = plainText(value.credit || '');
      const text = caption === credit ? caption : [caption, credit].filter(Boolean).join(' ');
      return '<figure><img src="' + esc(value.localUrl) + '" alt="' + esc(plainText(value.alt)) + '" loading="lazy"><figcaption>' + esc(text) + '</figcaption></figure>';
    } },
    // Previously saved link annotations retain their words without a hyperlink.
    marks: { link: ({children}) => children },
  } });
}
