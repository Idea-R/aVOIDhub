import assert from 'node:assert/strict';

// Read-only HTTP checks against a running local or explicitly supplied preview.
const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:3107');
assert(['http:', 'https:'].includes(origin.protocol), 'Supply an HTTP(S) review origin');
const routes = [
  ['/', false], ['/leaderboards', false], ['/membership', false],
  ['/creators/apply', false], ['/login', true], ['/account', true],
  ['/creators/dashboard', true], ['/creators/submit', true], ['/admin', true],
  ['/games/voidavoid', false], ['/games/wreckavoid', false], ['/games/bloomfall', false],
];

for (const [path, privatePage] of routes) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(45_000) });
  assert.equal(response.status, 200, `${path}: expected an accessible page or login redirect`);
  const html = await response.text();
  const resolvedPath = new URL(response.url).pathname.replace(/\/$/, '') || '/';
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  assert(canonical, `${path}: missing canonical`);
  assert.equal(new URL(canonical).pathname.replace(/\/$/, '') || '/', resolvedPath,
    `${path}: canonical must describe the resulting page, not the homepage`);
  if (privatePage) assert(/<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html), `${path}: private workflow must be noindex`);
  if (path === '/leaderboards') {
    assert(!html.includes('href="/leaderboards/?game=tankavoid"'), 'Queued TankaVOID must not offer an active board tab');
  }
  console.log(`${path}: 200, canonical ${resolvedPath}${privatePage ? ', noindex' : ''}`);
}

console.log('Platform public/utility route checks passed. This does not test authenticated backend writes.');
