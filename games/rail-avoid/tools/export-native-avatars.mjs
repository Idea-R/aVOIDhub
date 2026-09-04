#!/usr/bin/env node
/** Production encoding only: preserves native alpha; never keys colors or rebuilds masks. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = ['rail-thug', 'void-hound', 'void-shade', 'scrap-brute', 'ash-cult-fusilier', 'rail-maw-crawler', 'lantern-wraith', 'iron-sentinel'];
const sha = data => createHash('sha256').update(data).digest('hex');
const prepared = [];
for (const name of names) {
  const sourcePath = path.join(root, 'output/imagegen/native-alpha', `${name}-v3.png`);
  const outputPath = path.join(root, 'public/art/enemies', `${name}-v3.webp`);
  try { await fs.access(outputPath); throw new Error(`Refusing to overwrite ${outputPath}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const source = await fs.readFile(sourcePath);
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha) throw new Error(`${name}: native source has no alpha`);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * info.channels + 3] > 0) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error(`${name}: empty source`);
  // Remove only wholly transparent margins; keep even alpha=1 spectral pixels.
  const output = await sharp(source)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(448, 568, { fit: 'contain', background: '#00000000' })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: '#00000000' })
    .webp({ quality: 84, alphaQuality: 100, effort: 6 }).toBuffer();
  prepared.push({ name, sourcePath, outputPath, source, output });
}
const manifest = [];
for (const item of prepared) {
  await fs.writeFile(item.outputPath, item.output, { flag: 'wx' });
  manifest.push({ name: item.name, source: path.relative(root, item.sourcePath).replaceAll('\\', '/'), sourceSha256: sha(item.source), runtime: path.relative(root, item.outputPath).replaceAll('\\', '/'), runtimeSha256: sha(item.output), bytes: item.output.length, width: 480, height: 600 });
}
await fs.writeFile(path.join(root, 'docs/sprint-06/NATIVE-ALPHA-HASHES.json'), JSON.stringify({ model: 'gpt-image-1.5', background: 'transparent', treatment: 'transparent-margin crop, contain resize, transparent padding, WebP encoding; no keying or alpha reconstruction', assets: manifest }, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
