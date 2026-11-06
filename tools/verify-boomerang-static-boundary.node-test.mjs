import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
// Next 16.4.5's shipped module retains this name despite the renamed proxy docs.
const {unstable_doesMiddlewareMatch} = require('next/experimental/testing/server');
const source = readFileSync(new URL('../apps/platform/src/proxy.ts', import.meta.url), 'utf8');
const literal = source.match(/export const config = (\{[\s\S]*\})\s*$/)?.[1];
assert.ok(literal, 'Expected a static exported proxy config');
// Inspect the config literal only; auth functions, environment and provider imports never run.
const config = vm.runInNewContext(`(${literal})`, Object.create(null), {timeout:1000});
const matches = url => unstable_doesMiddlewareMatch({config, nextConfig:{}, url});

test('the new public game and all its assets bypass session refresh', () => {
  for (const path of ['/boomerangavoid', '/boomerangavoid/', '/boomerangavoid/assets/client.js', '/boomerangavoid/assets/game.css', '/boomerangavoid/characters/garden.glb', '/BoomerangaVOID/', '/BoomerangaVOID/index.html', '/BoomerangaVOID/assets/client.js', '/games/boomerangavoid', '/games/boomerangavoid/']) {
    assert.equal(matches(path), false, path);
  }
});

test('private platform routes and similarly named paths retain the production proxy boundary', () => {
  for (const path of ['/account', '/account/profile', '/admin', '/login', '/auth/callback?code=synthetic', '/api/v1/boomerangavoid/ticket/', '/api/v1/boomerangavoid/preferences/', '/api/runs', '/boomerangavoid-account', '/BoomerangaVOID-private', '/games/boomerangavoid/history', '/games/boomerangavoid-account', '/creators/dashboard']) {
    assert.equal(matches(path), true, path);
  }
});

test('existing public game and static exclusions keep the prior routing behavior', () => {
  for (const path of ['/', '/voidavoid/', '/VOIDaVOID/assets/client.js', '/wreckavoid/', '/wordavoid/', '/railavoid/', '/games/railavoid']) assert.equal(matches(path), true, path);
  for (const path of ['/_next/static/chunks/site.js', '/_next/image', '/favicon.ico', '/games/railavoid.webp']) assert.equal(matches(path), false, path);
});
