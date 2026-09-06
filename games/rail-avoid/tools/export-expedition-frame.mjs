/** Native-alpha master -> padded, nine-slice WebP. No keying or alpha replacement. */
import sharp from 'sharp';
import fs from 'node:fs';
const source = 'output/imagegen/native-alpha/expedition-brass-frame-v2.png';
const target = 'public/art/ui/expedition-brass-frame-v2.webp';
const {data, info} = await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const at = (x,y) => data[(y*info.width+x)*4+3];
if (![at(0,0),at(info.width-1,0),at(0,info.height-1),at(info.width-1,info.height-1),at(512,512)].every(a=>a===0)) throw Error('Frame is not natively transparent');
fs.mkdirSync('public/art/ui', {recursive:true});
// Retain every visible pixel and the supplied alpha, with two pixels of empty margin.
const buf = await sharp(source).extract({left:94,top:79,width:837,height:858}).resize({width:512}).webp({quality:88,alphaQuality:100}).toBuffer();
fs.writeFileSync(target,buf,{flag:'wx'});
console.log(`${target}: ${buf.length} bytes`);
