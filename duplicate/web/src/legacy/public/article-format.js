export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeImage(s){if(/^\/(images|uploads|media)\/[a-zA-Z0-9_.-]+$/.test(s))return true;try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}

const urlPattern=String.raw`(?:https?:\/\/|www\.)[^\s<>]+`;
const markdownLink=String.raw`\[([^\]\n]+)\]\((?:[^\s()]|\([^\n()]*\))+\)`;
const citation=String.raw`\[(?:\d+(?:\s*[,;–-]\s*\d+)*|\^[\w-]+)\]`;
const sourceHeading=/^(?:#{1,6}\s*)?(?:\*\*)?(?:sources?(?:\s+(?:and references|links|consulted))?|references?|bibliography|further reading|endnotes?)(?:\*\*)?\s*:?$/i;
const imageBlock=/^!\[([^\]\n]*)\]\(([^\s]+)\)(?:\n([\s\S]*))?$/;
const photoCaption=/\b(?:photograph|photo(?:graph)? credit|photographer|public domain|Wikimedia|CC BY|CC0|Getty|Unsplash)\b/i;

// Public presentation only. Keep original evidence and licence URLs in the
// editorial record; never rewrite dates, revisions or article text in storage.
export function plainText(value){
 let text=String(value??'').replace(/\r\n?/g,'\n');
 // Appended Markdown citations are furniture, not part of the preceding sentence.
 text=text.replace(new RegExp(`([.!?][”"’']?)\\s+(?:${markdownLink}[\\s,;]*)+[.]?$`,'g'),'$1');
 // Remove appended "Reuters: URL" references, including multiple source labels.
 const appendix=new RegExp(`([.!?][”"’']?)\\s+(?:[^.!?\\n]{1,120}:\\s*${urlPattern}[\\s,;|.]*)+$`,'i');
 text=text.replace(appendix,'$1');
 if(new RegExp(`^[^.!?\\n]{1,120}:\\s*${urlPattern}[\\s.]*$`,'i').test(text))return '';
 // Preserve words that are linked as part of a sentence.
 text=text.replace(new RegExp(markdownLink,'g'),'$1')
  .replace(/\[([^\]\n]+)\]\[[^\]\n]*\]/g,'$1')
  .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi,'$1')
  .replace(/<sup\b[^>]*>\s*(?:\[?\d+\]?|\*)\s*<\/sup>/gi,'');
 text=text.replace(new RegExp(`([.!?])\\s*(?:${citation}\\s*)+[.]?`,'g'),'$1')
  .replace(new RegExp(citation,'g'),'');
 // Photo licence/source addresses are rendered separately on /photo-credits.
 text=text.replace(new RegExp(`(?:[|;]\\s*)?(?:\\b(?:source(?: and [^:\\n]{1,60})?|licen[cs]e|image source|photo source)\\s*:\\s*)${urlPattern}`,'gi'),'');
 text=text.replace(new RegExp(`<${urlPattern}>`,'gi'),'')
  .replace(new RegExp(urlPattern,'gi'),raw=>raw.match(/[.!?,;]+$/)?.[0]||'')
  .replace(/(?:cite|genui)[\s\S]*?/g,'')
  .replace(/\(\s*(?:(?:sources?|references?|see)\s*:?\s*)?\)/gi,'')
  .replace(/^[ \t]*(?:Source|Reporting) note:\s*/gim,'')
  .replace(/[ \t]+/g,' ')
  .replace(/ +([.,;:!?])/g,'$1')
  .replace(/([.!?])\s+\./g,'$1')
  .replace(/^[\s|,;:.()-]+$|[ \t]*[|;][ \t]*$/gm,'')
  .trim();
 return text;
}

export const inline=s=>esc(plainText(s));

export function articleBlocks(body){
 const blocks=String(body??'').replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
 const result=[];let references=false;
 for(let i=0;i<blocks.length;i++){
  let p=blocks[i];
  if(sourceHeading.test(p.split('\n')[0])){references=true;continue}
  if(references){
   if(/^The Athena Perspective\.$/i.test(p)||/^#{1,6}\s/.test(p))references=false;
   else continue;
  }
  if(/^\[(?:\d+|\^[^\]]+|[^\]]+)\]:?\s*(?:\n|https?:\/\/)/i.test(p))continue;
  const m=p.match(imageBlock);
  if(m&&safeImage(m[2])){
   let credit=m[3]||'';
   if(!credit&&blocks[i+1]&&photoCaption.test(blocks[i+1])&&!blocks[i+1].startsWith('![')&&!blocks[i+1].startsWith('#'))credit=blocks[++i];
   result.push({type:'image',url:m[2],alt:plainText(m[1]),credit,caption:plainText(credit||m[1])});
   continue;
  }
  // Reference definitions can follow prose without a blank line.
  p=p.replace(/^\[(?:\^?[^\]]+)\]:\s*.*$/gm,'');
  const heading=p.startsWith('## '),text=plainText(heading?p.slice(3):p);
  if(text)result.push({type:heading?'heading':'paragraph',text});
 }
 return result;
}

export function bodyHTML(body){
 return articleBlocks(body).map(p=>{
  if(p.type==='image')return `<figure class="inline-image"><img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy"><figcaption>${esc(p.caption)}</figcaption></figure>`;
  return p.type==='heading'?`<h2>${esc(p.text)}</h2>`:`<p>${esc(p.text)}</p>`;
 }).join('');
}

// Used only on the dedicated photo-credits page, never in article prose.
export function creditHTML(value){
 return String(value??'').split(/(https?:\/\/[^\s<>]+)/g).map(t=>{
  if(!/^https?:\/\//.test(t))return esc(t);
  const url=t.replace(/[.,;]+$/,'');
  try{const u=new URL(url);if(u.username||u.password)return esc(t)}catch{return esc(t)}
  return `<a href="${esc(url)}" rel="noopener noreferrer">${esc(url)}</a>`;
 }).join('');
}
