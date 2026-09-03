#!/usr/bin/env node
/** Convert a green-screen image-generation export into alpha PNG and compact WebP. */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const [inputArg, pngArg, webpArg] = process.argv.slice(2);
if (!inputArg || !pngArg || !webpArg) {
  console.error('usage: node scripts/process-keyed-art.mjs <keyed.png> <alpha.png> <runtime.webp>');
  process.exit(2);
}

const input = path.resolve(inputArg);
const pngOutput = path.resolve(pngArg);
const webpOutput = path.resolve(webpArg);
const image = PNG.sync.read(fs.readFileSync(input));
let transparent = 0;
let partial = 0;
let minX = image.width;
let minY = image.height;
let maxX = -1;
let maxY = -1;

for (let y = 0; y < image.height; y++) {
  for (let x = 0; x < image.width; x++) {
    const i = (y * image.width + x) * 4;
    const r = image.data[i];
    const g = image.data[i + 1];
    const b = image.data[i + 2];
    const originalAlpha = image.data[i + 3];
    const greenDominance = g - Math.max(r, b);
    let matte = 1;
    if (g > 105 && greenDominance >= 100) matte = 0;
    else if (g > 70 && greenDominance > 20) matte = 1 - (greenDominance - 20) / 80;
    matte = Math.max(0, Math.min(1, matte));
    const alpha = Math.round(originalAlpha * matte);

    // Remove reflected key colour from partially keyed edge pixels.
    if (matte < 1 && alpha > 0) image.data[i + 1] = Math.min(g, Math.max(r, b) + 10);
    image.data[i + 3] = alpha;
    if (alpha === 0) {
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 0;
      transparent++;
    } else {
      if (alpha < 255) partial++;
      if (alpha > 12) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }
}

fs.mkdirSync(path.dirname(pngOutput), { recursive: true });
fs.mkdirSync(path.dirname(webpOutput), { recursive: true });
fs.writeFileSync(pngOutput, PNG.sync.write(image, { colorType: 6 }));

const browser = await chromium.launch();
const page = await browser.newPage();
const pngData = `data:image/png;base64,${fs.readFileSync(pngOutput).toString('base64')}`;
const webpData = await page.evaluate(async ({ src, width, height }) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/webp', 0.82);
}, { src: pngData, width: image.width, height: image.height });
await browser.close();
fs.writeFileSync(webpOutput, Buffer.from(webpData.slice(webpData.indexOf(',') + 1), 'base64'));

const report = {
  width: image.width,
  height: image.height,
  transparent,
  partial,
  bounds: [minX, minY, maxX, maxY],
  pngBytes: fs.statSync(pngOutput).size,
  webpBytes: fs.statSync(webpOutput).size,
};
console.log(JSON.stringify(report));
