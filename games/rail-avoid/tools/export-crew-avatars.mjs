/** Encode accepted native-alpha crew masters. No background removal or mask reconstruction. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const roles = ['engineer','gunner','medic','surveyor','mechanic','quartermaster'];
const assets = [];
const sha = b => createHash('sha256').update(b).digest('hex');
for (const role of roles) {
  const source = `output/imagegen/native-alpha/crew-${role}-${role==='gunner'?'v2':'v1'}.png`;
  const input = await fs.readFile(source);
  const metadata = await sharp(input).metadata();
  if (!metadata.hasAlpha) throw new Error(`${role}: native alpha required`);
  const {data,info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1,clear=0,edges=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++) {
    const a=data[(y*info.width+x)*4+3];
    if(a===0) {clear++;continue;}
    // Match the native verifier's visibility threshold; retain ALL nonzero alpha in encoding.
    if(a>8&&(x===0||y===0||x===info.width-1||y===info.height-1))edges++;
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
  }
  if(edges||clear/(info.width*info.height)<.3)throw new Error(`${role}: background/framing failed`);
  const cropped = await sharp(input).extract({left,top,width:right-left+1,height:bottom-top+1}).png().toBuffer();
  const runtime = `public/art/crew/${role}-combat-v1.webp`;
  const avatar = await sharp(cropped).resize(448,568,{fit:'contain',background:'#00000000'}).extend({left:16,right:16,top:16,bottom:16,background:'#00000000'}).webp({quality:84,alphaQuality:100,effort:6}).toBuffer();
  // Portraits are crops of the same accepted character, preserving identity and native alpha.
  const portrait = `public/art/crew/${role}-portrait-v1.webp`;
  const portraitBytes = await sharp(cropped).extract({left:0,top:0,width:right-left+1,height:Math.round((bottom-top+1)*.43)}).resize(240,300,{fit:'contain',background:'#00000000'}).webp({quality:86,alphaQuality:100,effort:6}).toBuffer();
  await fs.writeFile(runtime,avatar,{flag:'wx'});await fs.writeFile(portrait,portraitBytes,{flag:'wx'});
  assets.push({role,source,sourceSha256:sha(input),runtime,runtimeSha256:sha(avatar),bytes:avatar.length,portrait,portraitSha256:sha(portraitBytes)});
}
await fs.writeFile('docs/sprint-07/CREW-ART-MANIFEST.json',JSON.stringify({model:'gpt-image-1.5',background:'transparent',sourceFormat:'png',treatment:'transparent-margin crop, resize, transparent padding, WebP encoding; portraits cropped from same master',assets},null,2)+'\n');
console.log(JSON.stringify(assets,null,2));
