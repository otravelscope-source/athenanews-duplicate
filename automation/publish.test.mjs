import test from 'node:test';
import assert from 'node:assert/strict';
import {validate, select, documents, checkImage} from './publish.mjs';
const now=new Date('2026-10-24T12:00:00Z');
const base=(id,date='2026-10-24T06:00:00Z')=>({version:1,approved:true,sourceLibraryId:'libfile_'+id,topicKey:'topic-'+id,slug:'story-'+id,title:'A complete news headline '+id,author:'ATHENA',category:'Justice',publishedAt:date,review:{factsChecked:true,duplicatesChecked:true,imageRightsChecked:true},paragraphs:[{style:'normal',text:'Verified reporting with natural attribution. '.repeat(20)},{style:'h2',text:'What changes for women'},{style:'normal',text:'The Athena Perspective.'}],image:{url:'https://upload.wikimedia.org/wikipedia/commons/b/b8/Northwestern_Deering_Library.jpg',sourceUrl:'https://commons.wikimedia.org/wiki/File:Northwestern_Deering_Library.jpg',alt:'Library',caption:'Contextual archive photograph.',credit:'Photographer',license:'Public domain'}});
const make=(...args)=>{const a=base(...args);a.inlineImages=[{...a.image,url:a.image.url.replace('.jpg','-2.jpg'),afterParagraph:0},{...a.image,url:a.image.url.replace('.jpg','-3.jpg'),afterParagraph:1}];return a;};
test('preserves original dates and uses create-only document identities',()=>{const a=make('old','2026-09-01T09:00:00Z');validate(a,now);assert.equal(documents(a)[2].publishedAt,a.publishedAt);assert.equal(documents(a)[2]._id,'article-libfile-old');});
test('prioritizes today then at most three archives and skips duplicates',()=>{const a=make('today'),old=[1,2,3,4].map(n=>make('old'+n,'2026-10-20T09:00:00Z'));assert.equal(select([a,...old],[],now).length,4);assert.equal(select([a,...old],[],now)[0].slug,a.slug);assert.equal(select([a,a],[{slug:a.slug}],now).length,0);});
test('holds links, incomplete review, future dates and unlicensed images',()=>{for(const change of [a=>a.paragraphs[0].text+=' https://example.com',a=>a.review.factsChecked=false,a=>a.publishedAt='2027-01-01T00:00:00Z',a=>a.image.license='All rights reserved']){const a=make('invalid');change(a);assert.throws(()=>validate(a,now));}});

test('retains inline photos, credit sources and placements',()=>{const a=make('photos');validate(a,now);const doc=documents(a)[2];assert.equal(doc.body.filter(b=>b._type==='image').length,2);assert.match(doc.body[1].legacyCredit,/creativecommons/);a.inlineImages=[];assert.throws(()=>validate(a,now));});

test('image probe falls back to GET when HEAD is rejected and rejects unavailable images', async()=>{
 const calls=[];
 await checkImage('https://upload.wikimedia.org/example.jpg',async(url,options)=>{
  calls.push(options.method || 'GET');
  return options.method==='HEAD' ? new Response('',{status:403}) : new Response(new Uint8Array([255,216,255]),{headers:{'content-type':'image/jpeg'}});
 });
 assert.deepEqual(calls,['HEAD','GET']);
 await assert.rejects(()=>checkImage('https://upload.wikimedia.org/example.jpg',async()=>new Response('',{status:403})),/HTTP 403/);
 await assert.rejects(()=>checkImage('https://upload.wikimedia.org/example.jpg',async()=>new Response('error',{headers:{'content-type':'text/html'}})),/Image unavailable/);
});
