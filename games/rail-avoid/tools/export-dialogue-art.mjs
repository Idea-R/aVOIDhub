/** Native alpha only. Resize and alpha-margin trim; never replace/key a background. */
import sharp from 'sharp';
import fs from 'node:fs';
import crypto from 'node:crypto';
const source = 'output/imagegen/native-alpha/mara-dialogue-v1.png';
const target = 'public/art/npcs/mara-dialogue-v1.webp';
const out = 'verify/screenshots/dialogue-art';
const meta = await sharp(source).metadata();
if (!meta.hasAlpha) throw Error('Native alpha required');
const { data, info } = await sharp(source).raw().toBuffer({ resolveWithObject: true });
let zero = 0, partial = 0, left = info.width, right = 0, top = info.height, bottom = 0;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  const a = data[(y * info.width + x) * 4 + 3];
  if (!a) zero++; else { left = Math.min(left,x); right = Math.max(right,x); top = Math.min(top,y); bottom = Math.max(bottom,y); }
  if (a > 0 && a < 255) partial++;
}
// Near-opaque interior pixels are valid: partial-alpha totals do not prove a halo.
// Check actual light/dark composites below, not an RGB-only image preview.
const corners = [3,(info.width-1)*4+3,(info.height-1)*info.width*4+3,data.length-1].map(i=>data[i]);
if (zero < info.width * info.height * .25 || corners.some(a=>a!==0)) throw Error('Native transparent margin required; do not key a background out.');
fs.mkdirSync('public/art/npcs', { recursive: true }); fs.mkdirSync(out, { recursive: true });
const buf = await sharp(source).extract({ left, top, width:right-left+1, height:bottom-top+1 })
  .resize(480,600,{ fit:'contain', background:'#00000000' }).webp({ quality:90, alphaQuality:100 }).toBuffer();
fs.writeFileSync(target, buf, { flag:'wx' });
const light = await sharp(buf).flatten({ background:'#f4f1e8' }).png().toBuffer();
const dark = await sharp(buf).flatten({ background:'#0d111d' }).png().toBuffer();
await sharp({ create:{ width:960,height:600,channels:4,background:'#00000000' } }).composite([{ input:light,left:0,top:0 },{ input:dark,left:480,top:0 }]).png().toFile(`${out}/mara-edges.png`);
const result = { model:'gpt-image-1.5', background:'transparent', source,target, width:480,height:600,bytes:buf.length,decodedRGBABytes:480*600*4,zero,partial,pixels:info.width*info.height,sha256:crypto.createHash('sha256').update(buf).digest('hex') };
fs.writeFileSync(`${out}/mara-alpha.json`,JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2));
