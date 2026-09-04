#!/usr/bin/env node
/** Inspect native sources without changing alpha or reconstructing masks. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = ['void-hound', 'void-shade', 'lantern-wraith', 'rail-thug', 'scrap-brute', 'ash-cult-fusilier', 'rail-maw-crawler', 'iron-sentinel'];
const args = process.argv.slice(2);
const files = args.length ? args.map(f => path.resolve(f)) : names.map(n => path.join(root, 'output/imagegen/native-alpha', `${n}-v3.png`));
const out = path.join(root, 'verify/screenshots/native-alpha');
await fs.mkdir(out, { recursive: true });
let failures = 0;
for (const file of files) {
  try {
    const meta = await sharp(file).metadata();
    if (!meta.hasAlpha) throw new Error('source has no native alpha channel');
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let clear = 0, solid = 0, partial = 0, border = 0;
    let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * info.channels + 3];
      if (a === 0) clear++;
      else {
        if (a === 255) solid++; else partial++;
        if (a > 8) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) border++;
        }
      }
    }
    const total = info.width * info.height;
    const stem = path.basename(file, path.extname(file));
    const resized = await sharp(file).resize(480, 600, { fit: 'contain', background: '#00000000' }).png().toBuffer();
    for (const [tone, background] of [['light', '#f4f0e8'], ['dark', '#101426']]) {
      await sharp({ create: { width: 480, height: 600, channels: 4, background } })
        .composite([{ input: resized }]).png().toFile(path.join(out, `${stem}-${tone}.png`));
    }
    if (clear / total < 0.2) throw new Error('less than 20% fully transparent canvas; inspect for a backdrop');
    if (solid / total < 0.01) throw new Error('missing opaque character body');
    if (border > 0) throw new Error(`subject or background reaches ${border} edge pixels`);
    console.log(JSON.stringify({ file: stem, structural: 'PASS', width: info.width, height: info.height, clearFraction: clear / total, partialPixels: partial, bounds: [minX, minY, maxX, maxY], visualReview: 'REQUIRED' }));
  } catch (error) {
    failures++;
    console.error(`FAIL ${path.basename(file)}: ${error.message}`);
  }
}
console.log(`Native-source checks: ${files.length - failures}/${files.length} passed. Light/dark previews: ${out}`);
console.log('These checks cannot prove generation provenance or detect every enclosed background pocket. Visual review remains mandatory.');
if (failures) process.exitCode = 1;
