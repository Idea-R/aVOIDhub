import { gzipSync } from 'node:zlib';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDirectory = fileURLToPath(new URL('../../../dist/VOIDaVOID', import.meta.url));
const budgets = {
  initialTransferBytes: 140 * 1024,
  largestJavaScriptBytes: 320 * 1024,
};
const initialExtensions = new Set(['.html', '.js', '.css', '.svg', '.png', '.webp', '.avif', '.woff2']);
const forbiddenAudioExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : path;
  }));
  return files.flat();
}

const files = await listFiles(distDirectory);
const measurements = await Promise.all(files.map(async (path) => {
  const extension = extname(path).toLowerCase();
  const size = (await stat(path)).size;
  const compressedSize = ['.html', '.js', '.css', '.svg'].includes(extension)
    ? gzipSync(await readFile(path)).byteLength
    : size;
  return {
    name: relative(distDirectory, path).replaceAll('\\', '/'),
    extension,
    size,
    compressedSize,
  };
}));

const initialTransferBytes = measurements
  .filter(({ extension }) => initialExtensions.has(extension))
  .reduce((total, file) => total + file.compressedSize, 0);
const largestJavaScript = measurements
  .filter(({ extension }) => extension === '.js')
  .sort((left, right) => right.size - left.size)[0];
const shippedAudio = measurements.filter(({ extension }) => forbiddenAudioExtensions.has(extension));

const failures = [];
if (initialTransferBytes > budgets.initialTransferBytes) {
  failures.push(`Initial transfer ${initialTransferBytes} exceeds ${budgets.initialTransferBytes} bytes.`);
}
if (!largestJavaScript || largestJavaScript.size > budgets.largestJavaScriptBytes) {
  failures.push(largestJavaScript
    ? `${largestJavaScript.name} is ${largestJavaScript.size} bytes; budget is ${budgets.largestJavaScriptBytes}.`
    : 'No JavaScript bundle was emitted.');
}
if (shippedAudio.length > 0) {
  failures.push(`Unexpected downloaded audio shipped: ${shippedAudio.map(({ name }) => name).join(', ')}.`);
}

console.log(JSON.stringify({
  initialTransferBytes,
  initialTransferBudgetBytes: budgets.initialTransferBytes,
  largestJavaScript: largestJavaScript ? { name: largestJavaScript.name, bytes: largestJavaScript.size } : null,
  largestJavaScriptBudgetBytes: budgets.largestJavaScriptBytes,
  shippedAudioFiles: shippedAudio.length,
}, null, 2));

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`Budget failure: ${failure}`));
  process.exitCode = 1;
}
