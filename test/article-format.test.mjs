import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {bodyHTML,plainText,articleBlocks,creditHTML} from '../public/article-format.js';

test('News prose keeps attribution and meaningful link text, without citations or URLs',()=>{
 const body='According to [WHO](https://example.test/report), the change affects children. [1].\n\nReuters reported the decision. [Reuters](https://example.test/news)\n\nThe court published its decision. Court filing: https://example.test/case Further reporting: https://example.test/news\n\nThe figures show an association. OECD PISA 2025: France: https://example.test/report\n\nReuters update: https://example.test/update\n\nhttps://example.test/source\n\n## References\n\n[1] WHO\nhttps://example.test/report\n\nThe Athena Perspective.';
 assert.equal(bodyHTML(body),'<p>According to WHO, the change affects children.</p><p>Reuters reported the decision.</p><p>The court published its decision.</p><p>The figures show an association.</p><p>The Athena Perspective.</p>');
 assert.equal(plainText('A claim [1, 2] with a limitation.[^note]'),'A claim with a limitation.');
 assert.equal(plainText('See <a href="https://example.test">the report</a> for context.'),'See the report for context.');
 assert.equal(plainText('The figures [link][report] have limits.\n[report]: https://example.test'), 'The figures link have limits.');
});

test('Images, plain captions and required licence records survive the cleanup',()=>{
 const body='Reporting.\n\n![Archive photograph](https://example.test/photo_(2025).jpg)\nArchive photo, 2025. Photographer: Jane Doe. CC BY 4.0.\nSource: https://example.test/photo\nLicence: https://creativecommons.org/licenses/by/4.0/\n\nThe Athena Perspective.';
 const html=bodyHTML(body);
 assert.match(html,/<img src="https:\/\/example.test\/photo_\(2025\).jpg"/);
 assert.match(html,/<figcaption>Archive photo, 2025\. Photographer: Jane Doe\. CC BY 4.0\.<\/figcaption>/);
 assert.doesNotMatch(html,/<a\b|Source:|Licence:/);
 const photo=articleBlocks(body).find(p=>p.type==='image');
 assert.match(creditHTML(photo.credit),/href="https:\/\/creativecommons.org\/licenses\/by\/4.0\/"/);
 const separate=articleBlocks('![Archive photograph](/images/photo.jpg)\n\nArchive photograph by Jane Doe. Public domain. Source: https://example.test/photo\n\nThe next paragraph.');
 assert.equal(separate.length,2);assert.equal(separate[0].caption,'Archive photograph by Jane Doe. Public domain.');assert.equal(separate[1].text,'The next paragraph.');
});

test('Headings, material limitations and hostile text stay safe',()=>{
 const html=bodyHTML('## Source context\n\nReporting note: These are allegations, not court findings.\n\n<script>alert(1)</script>\n\n![Unsafe](javascript:alert(1))\n\n## Sources\n\n[1] Bad reference\n\nThe Athena Perspective.');
 assert.match(html,/<h2>Source context<\/h2>/);assert.match(html,/These are allegations, not court findings\./);
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|<img|<a\b|Bad reference/);
 assert.match(bodyHTML('Evidence [^1].\n[^1]: https://example.test'),/<p>Evidence\.<\/p>/);
});

test('Every imported article loses reference apparatus while retaining all inline images and its closing',()=>{
 const dir=new URL('../published-articles/',import.meta.url);
 for(const file of readdirSync(dir)){
  const a=JSON.parse(readFileSync(new URL(file,dir),'utf8'));
  const html=bodyHTML(a.body),blocks=articleBlocks(a.body);
  assert.equal(blocks.filter(p=>p.type==='image').length,[...a.body.matchAll(/^!\[[^\]\n]*\]\(([^\s]+)\)/gm)].length,a.id);
  const visible=blocks.map(p=>p.text||p.caption).join('\n');
  assert.doesNotMatch(visible,/https?:\/\/|www\.|\[\d+\]|^Sources$|^References$/m,a.id);
  assert.doesNotMatch(html,/<a\b|<p>\s*<\/p>/,a.id);
  assert.match(html,/<p>The Athena Perspective\.<\/p>$/,a.id);
 }
});
