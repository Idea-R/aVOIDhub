/** Read-only deployed-site smoke. No accounts, scores or server data are changed. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const origin = process.argv.find(a => a.startsWith('--url='))?.slice(6);
if (!origin) throw Error('Supply --url=https://the-verified-site');
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'verify/screenshots/release';
const hash = b => createHash('sha256').update(b).digest('hex');
const files = new Set(), routes = [], bundles = [], errors = [];
let railHtml;
for (const route of ['/', '/login/', '/games/railavoid/', '/railavoid/', '/voidavoid/', '/wreckavoid/', '/wordavoid/']) {
  const response = await fetch(new URL(route, origin));
  const html = await response.text();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html') || !/<(?:html|!doctype)/i.test(html)) errors.push(`${route}: not a successful HTML page (${response.status})`);
  routes.push({ route, status: response.status, url: response.url });
  for (const m of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)) files.add(new URL(m[1].replaceAll('&amp;', '&'), response.url).href);
  if (route === '/railavoid/') railHtml = html;
}
for (const url of files) {
  const response = await fetch(url);
  if (!response.ok || response.headers.get('content-type')?.includes('text/html')) { errors.push(`${url}: invalid asset ${response.status}`); continue; }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (new URL(url).pathname.startsWith('/RAILaVOID/assets/')) {
    const local = path.resolve('../../dist/RAILaVOID/assets', path.basename(new URL(url).pathname));
    try { const localHash = hash(await fs.readFile(local)), remoteHash = hash(bytes); bundles.push({ url, hash: remoteHash, matchesLocal: localHash === remoteHash }); if (localHash !== remoteHash) errors.push(`${url}: differs from local candidate`); }
    catch { errors.push(`${url}: not in the local candidate build`); }
  }
}
if (!railHtml?.includes('/RAILaVOID/assets/') || !bundles.length) errors.push('No candidate game bundle discovered');
await fs.mkdir(out, { recursive: true });
const result = { origin, timestamp: new Date().toISOString(), routes, linkedAssets: files.size, bundles, errors, pass: !errors.length };
await fs.writeFile(`${out}/site-smoke.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
