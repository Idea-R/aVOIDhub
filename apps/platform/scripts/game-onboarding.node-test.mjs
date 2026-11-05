// Kept outside Vitest's *.test.* glob: these filesystem guards use node:test.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { buildPlatformGames } from '../../../tools/build-platform-games.mjs'
import { loadBuildManifest, validateBuildManifest } from './game-build-manifest.mjs'
import { prepareGames } from './prepare-games.mjs'
import { loadGameCatalog, validateGameCatalog } from './verify-game-catalog.mjs'

const manifest = await loadBuildManifest()
const catalog = loadGameCatalog()
const clone = (value) => JSON.parse(JSON.stringify(value))
const fixtureManifest = () => ({ schemaVersion: 1, games: [{ id: 'example', name: 'Example', workspace: '@avoid/example', source: 'dist/Example', publicDirectory: 'Example', playRoute: '/example/' }] })
const asCatalog = (games) => ({ allGames: games, getGameById: (id) => games.find((game) => game.id === id) })

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'avoid-onboarding-'))
  t.after(async () => {
    const relative = path.relative(os.tmpdir(), root)
    assert(!relative.startsWith('..') && !path.isAbsolute(relative) && relative.startsWith('avoid-onboarding-'))
    await rm(root, { recursive: true, force: true })
  })
  return root
}

async function file(root, relative, content = 'fixture') {
  const target = path.join(root, relative)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content)
  return target
}

async function linkDirectory(t, source, target) {
  try { await symlink(source, target, process.platform === 'win32' ? 'junction' : 'dir') }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip(`Directory links unavailable: ${error.code}`); return false }
    throw error
  }
  return true
}

test('current manifest and nine-title release catalog satisfy the contract', () => {
  assert.equal(validateBuildManifest(manifest), manifest)
  assert.deepEqual(validateGameCatalog(catalog, manifest), { titles: 9, playDestinations: 8, soon: 1 })
})

test('manifest rejects malformed schema, missing fields, unsafe paths and duplicates', () => {
  for (const bad of [null, {}, { schemaVersion: 2, games: [] }, { schemaVersion: 1, games: [] }, { schemaVersion: 1, games: [null] }]) {
    assert.throws(() => validateBuildManifest(bad))
  }
  for (const [key, value] of [
    ['id', 'Example'], ['workspace', '@avoid/example && echo bad'], ['source', '../outside'],
    ['source', 'dist/../outside'], ['source', 'C:/outside'], ['source', 'dist\\Example'],
    ['publicDirectory', '../outside'], ['publicDirectory', 'games'], ['publicDirectory', 'Example/nested'],
    ['playRoute', 'https://example.com/'], ['name', ''], ['workspace', null],
  ]) {
    const changed = fixtureManifest()
    changed.games[0][key] = value
    assert.throws(() => validateBuildManifest(changed), undefined, `${key}: ${value}`)
  }
  for (const key of ['id', 'workspace', 'source', 'publicDirectory', 'playRoute']) {
    const changed = fixtureManifest()
    const extra = { id: 'other', name: 'Other', workspace: '@avoid/other', source: 'dist/Other', publicDirectory: 'Other', playRoute: '/other/' }
    extra[key] = changed.games[0][key]
    changed.games.push(extra)
    assert.throws(() => validateBuildManifest(changed), undefined, `duplicate ${key}`)
  }
  const changed = fixtureManifest()
  changed.games.push({ id: 'other', name: 'Other', workspace: '@avoid/other', source: 'dist/Other', publicDirectory: 'EXAMPLE', playRoute: '/other/' })
  assert.throws(() => validateBuildManifest(changed), /Duplicate/)
})

test('manifest loader rejects malformed JSON', async (t) => {
  const root = await fixture(t)
  const target = await file(root, 'bad.json', '{')
  await assert.rejects(loadBuildManifest(target), SyntaxError)
})

test('game routes cannot shadow authentication, private workspaces or public platform pages', () => {
  for (const reserved of ['api', 'login', 'account', 'teams', 'auth', 'leaderboards', 'creators', 'membership', 'players', 'results', 'privacy', 'terms', 'admin']) {
    const route = fixtureManifest()
    route.games[0] = { ...route.games[0], id: reserved, playRoute: `/${reserved}/` }
    assert.throws(() => validateBuildManifest(route), /reserved platform route/)
    const directory = fixtureManifest()
    directory.games[0].publicDirectory = reserved.toUpperCase()
    assert.throws(() => validateBuildManifest(directory), /public directory is reserved/)
  }
})

test('staging copies complete builds and replaces only the listed target', async (t) => {
  const root = await fixture(t)
  await file(root, 'dist/Example/index.html', '<html>new</html>')
  await file(root, 'dist/Example/assets/game.js', 'new js')
  await file(root, 'apps/platform/public/Example/stale.js', 'old')
  const unrelated = await file(root, 'apps/platform/public/unrelated/keep.txt', 'keep')
  await prepareGames({ root, manifest: fixtureManifest(), log: () => {} })
  assert.equal(await readFile(path.join(root, 'apps/platform/public/Example/index.html'), 'utf8'), '<html>new</html>')
  await assert.rejects(readFile(path.join(root, 'apps/platform/public/Example/stale.js')), { code: 'ENOENT' })
  assert.equal(await readFile(unrelated, 'utf8'), 'keep')
})

test('missing later build fails preflight before deleting any existing staged output', async (t) => {
  const root = await fixture(t)
  const changed = fixtureManifest()
  changed.games.push({ id: 'other', name: 'Other', workspace: '@avoid/other', source: 'dist/Other', publicDirectory: 'Other', playRoute: null })
  await file(root, 'dist/Example/index.html', '<html>new</html>')
  const previous = await file(root, 'apps/platform/public/Example/index.html', 'previous build')
  await assert.rejects(prepareGames({ root, manifest: changed }), /Missing Other build output/)
  assert.equal(await readFile(previous, 'utf8'), 'previous build')
})

test('missing and empty indexes fail before staging', async (t) => {
  const root = await fixture(t)
  await mkdir(path.join(root, 'dist/Example'), { recursive: true })
  await assert.rejects(prepareGames({ root, manifest: fixtureManifest() }), /index.html/)
  await file(root, 'dist/Example/index.html', '')
  await assert.rejects(prepareGames({ root, manifest: fixtureManifest() }), /index.html/)
})

for (const location of ['source', 'source-ancestor', 'source-child', 'public-ancestor', 'target', 'target-child']) {
  test(`staging refuses linked ${location} and preserves existing data`, async (t) => {
    const root = await fixture(t)
    const external = path.join(root, 'external')
    await file(root, 'external/index.html', 'outside stays')
    await file(root, 'dist/Example/index.html', 'source')
    const target = path.join(root, 'apps/platform/public/Example')
    await mkdir(path.dirname(target), { recursive: true })
    let link
    if (location === 'source') {
      await rm(path.join(root, 'dist/Example'), { recursive: true })
      link = path.join(root, 'dist/Example')
    } else if (location === 'source-ancestor') {
      await rm(path.join(root, 'dist'), { recursive: true })
      link = path.join(root, 'dist')
    } else if (location === 'source-child') {
      link = path.join(root, 'dist/Example/assets')
    } else if (location === 'public-ancestor') {
      await rm(path.dirname(target), { recursive: true })
      link = path.dirname(target)
    } else if (location === 'target') {
      link = target
    } else {
      await mkdir(target)
      link = path.join(target, 'assets')
    }
    if (!await linkDirectory(t, external, link)) return
    await assert.rejects(prepareGames({ root, manifest: fixtureManifest() }), /linked/)
    assert.equal(await readFile(path.join(external, 'index.html'), 'utf8'), 'outside stays')
  })
}

test('build runner consumes all manifest workspaces and stops on failure', () => {
  const calls = []
  buildPlatformGames(manifest, (command, args, options) => { calls.push({ command, args, options }); return { status: 0 } })
  assert.deepEqual(calls.map((call) => call.args.at(-1)), manifest.games.map((game) => `--workspace=${game.workspace}`))
  assert(calls.every((call) => call.options.stdio === 'inherit'))
  let attempted = 0
  assert.throws(() => buildPlatformGames(manifest, () => { attempted++; return { status: 1 } }), /build failed/)
  assert.equal(attempted, 1)
})

test('catalog permits a valid tenth hosted game without changing the release baseline', () => {
  const games = clone(catalog.allGames)
  const extra = { ...clone(games[0]), id: 'example', title: 'Example', detailHref: '/games/example/', playHref: '/example/', image: '/games/example.webp', score: { scope: 'none', headline: 'Practice only', copy: 'No ranked saving is claimed.' } }
  games.splice(4, 0, extra)
  const changed = clone(manifest)
  changed.games.push(fixtureManifest().games[0])
  assert.equal(validateGameCatalog(asCatalog(games), changed).titles, 10)
})

test('catalog permits an independent addition without copying its build or claiming shared scores', () => {
  const games = clone(catalog.allGames)
  games.push({ ...clone(games.at(-1)), id: 'example', title: 'Example', detailHref: '/games/example/', playHref: 'https://example.com/', image: '/games/example.webp' })
  assert.equal(validateGameCatalog(asCatalog(games), manifest).titles, 10)
})

test('catalog rejects invalid additions, duplicate routes and missing manifest coverage', () => {
  for (const change of [
    (games) => { games[0].id = 'bad/route' },
    (games) => { games.push(clone(games[0])) },
    (games) => { games[1].detailHref = games[0].detailHref },
    (games) => { games[0].highlights[0].copy = '' },
    (games) => { games[0].score.gameKey = 'other' },
    (games) => { games[6].playHref = 'http://bloomfall.io/' },
    (games) => { games[6].score = { ...games[0].score } },
    (games) => { games[0].playHref = '/other/' },
    (games) => { games.push({ ...clone(games[0]), id: 'extra', detailHref: '/games/extra/', playHref: '/extra/', score: { scope: 'none', headline: 'Local', copy: 'Local only' } }) },
  ]) {
    const games = clone(catalog.allGames)
    change(games)
    assert.throws(() => validateGameCatalog(asCatalog(games), manifest))
  }
})

test('catalog preserves existing release games, routes, TankaVOID gate and independent boundaries', () => {
  for (const change of [
    (games) => { games.splice(0, 1) },
    (games) => { [games[0], games[1]] = [games[1], games[0]] },
    (games) => { games[4].status = 'playable'; games[4].playHref = '/tankavoid/' },
    (games) => { games[6].playHref = 'https://unrelated.example/' },
    (games) => { games[3].hosting = 'independent' },
    (games) => { games[5].score.scope = 'none' },
  ]) {
    const games = clone(catalog.allGames)
    change(games)
    assert.throws(() => validateGameCatalog(asCatalog(games), manifest))
  }
  const changed = clone(manifest)
  changed.games[0].publicDirectory = 'Renamed'
  assert.throws(() => validateGameCatalog(catalog, changed), /preserve its existing/)
})
