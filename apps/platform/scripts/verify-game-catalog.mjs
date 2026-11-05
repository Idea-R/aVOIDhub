import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { isMain, loadBuildManifest, validateBuildManifest } from './game-build-manifest.mjs'

const requiredIds = ['voidavoid', 'wreckavoid', 'wordavoid', 'flipside', 'tankavoid', 'railavoid', 'bloomfall', 'acrolis', 'ttt3d']
const requiredBuilds = {
  voidavoid: ['@avoid/void-main', 'dist/VOIDaVOID', 'VOIDaVOID', '/voidavoid/'],
  wreckavoid: ['@avoid/wrecka-void', 'games/wrecka-void/dist', 'WreckaVOID', '/wreckavoid/'],
  wordavoid: ['@avoid/word-avoid', 'dist/WORDaVOID', 'WORDaVOID', '/wordavoid/'],
  tankavoid: ['@avoid/tanka-void', 'dist/TankaVOID', 'TankaVOID', null],
  railavoid: ['@avoid/rail-avoid', 'dist/RAILaVOID', 'RAILaVOID', '/railavoid/'],
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const nonempty = (value) => typeof value === 'string' && value.trim().length > 0

function assertHttps(value, message) {
  let url
  try { url = new URL(value) } catch { throw new Error(message) }
  assert(url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password, message)
}

export function loadGameCatalog(sourceUrl = new URL('../src/data/games.ts', import.meta.url)) {
  const compiled = ts.transpileModule(readFileSync(sourceUrl, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: sourceUrl.pathname,
  }).outputText
  const sandbox = { exports: {} }
  vm.runInNewContext(compiled, sandbox, { filename: sourceUrl.pathname, timeout: 1000 })
  return sandbox.exports
}

export function validateGameCatalog({ allGames, getGameById }, manifest) {
  validateBuildManifest(manifest)
  assert(Array.isArray(allGames), 'allGames must be an array')
  assert(typeof getGameById === 'function', 'getGameById must be a function')
  assert(allGames.every((game) => game && typeof game === 'object'), 'Each catalog game must be an object')
  assert(JSON.stringify(allGames.filter((game) => requiredIds.includes(game.id)).map((game) => game.id)) === JSON.stringify(requiredIds), 'Catalog must preserve the nine required V1 titles and their relative order')
  for (const field of ['id', 'detailHref']) {
    assert(new Set(allGames.map((game) => game[field])).size === allGames.length, `Game ${field} values must be unique`)
  }

  const builds = new Map(manifest.games.map((game) => [game.id, game]))
  for (const game of allGames) {
    assert(typeof game.id === 'string' && /^[a-z][a-z0-9-]*$/.test(game.id), 'Game IDs must be canonical lowercase slugs')
    assert(getGameById(game.id) === game, `${game.id} must resolve through getGameById`)
    assert(game.detailHref === `/games/${game.id}/`, `${game.id} must use its canonical detail route`)
    for (const field of ['title', 'eyebrow', 'description', 'premise', 'genre', 'accent', 'meta', 'availability', 'statusNote']) {
      assert(nonempty(game[field]), `${game.id} needs ${field}`)
    }
    assert(typeof game.image === 'string' && /^\/games\/[A-Za-z0-9_-]+\.(?:webp|png|jpe?g|avif|svg)$/.test(game.image), `${game.id} needs a game artwork path`)
    assert(['playable', 'external', 'soon'].includes(game.status), `${game.id} has an invalid status`)
    assert(['hosted', 'subdomain', 'independent'].includes(game.hosting), `${game.id} has an invalid hosting boundary`)
    assert(Array.isArray(game.highlights) && game.highlights.length === 3 && game.highlights.every((entry) => nonempty(entry?.title) && nonempty(entry?.copy)), `${game.id} needs three complete highlights`)
    assert(Array.isArray(game.facts) && game.facts.length >= 3 && game.facts.every((entry) => nonempty(entry?.label) && nonempty(entry?.value)), `${game.id} needs at least three complete facts`)
    assert(Array.isArray(game.deviceSupport) && game.deviceSupport.length >= 2 && game.deviceSupport.every(nonempty), `${game.id} needs explicit device guidance`)
    assert(game.score && ['platform', 'independent', 'none'].includes(game.score.scope) && nonempty(game.score.headline) && nonempty(game.score.copy), `${game.id} needs an honest score contract`)
    if (game.score.scope === 'platform') {
      assert(game.hosting === 'hosted' && game.score.gameKey === game.id, `${game.id} platform score key must match its hosted identity`)
    } else {
      assert(game.score.gameKey === undefined, `${game.id} must not claim a platform score key`)
    }
    if (game.status === 'soon') {
      assert(game.playHref === undefined, `${game.id} coming-soon state must not expose Play`)
    } else {
      assert(nonempty(game.playHref) && nonempty(game.playLabel), `${game.id} needs a play destination and label`)
    }
    if (game.hosting === 'hosted') {
      const build = builds.get(game.id)
      assert(build, `${game.id} needs a hosted build manifest entry`)
      assert(build.playRoute === (game.status === 'soon' ? null : game.playHref), `${game.id} build and catalog play routes must agree`)
      assert(game.status !== 'external', `${game.id} hosted game cannot be external`)
    } else {
      assert(!builds.has(game.id), `${game.id} external build must not be staged into the platform`)
      assert(game.score.scope !== 'platform', `${game.id} must keep its own account and score boundary`)
      if (game.status !== 'soon') assertHttps(game.playHref, `${game.id} must launch an HTTPS destination without credentials`)
    }
  }

  for (const build of manifest.games) {
    assert(allGames.some((game) => game.id === build.id && game.hosting === 'hosted'), `${build.id} build needs a hosted catalog entry`)
  }
  for (const [id, expected] of Object.entries(requiredBuilds)) {
    const build = builds.get(id)
    assert(build && JSON.stringify([build.workspace, build.source, build.publicDirectory, build.playRoute]) === JSON.stringify(expected), `${id} must preserve its existing workspace, build output, public directory and play route`)
  }
  for (const id of ['voidavoid', 'wreckavoid', 'wordavoid']) {
    const game = getGameById(id)
    assert(game.status === 'playable' && game.hosting === 'hosted' && game.playHref === `/${id}/` && game.score.scope === 'platform' && game.score.gameKey === id, `${id} must preserve its hosted play and platform score boundaries`)
  }
  const tank = getGameById('tankavoid')
  assert(tank.status === 'soon' && tank.hosting === 'hosted' && tank.playHref === undefined && tank.score.scope === 'platform' && tank.score.gameKey === 'tankavoid', 'TankaVOID must remain coming soon with its staged platform score boundary')
  const rail = getGameById('railavoid')
  assert(rail.status === 'playable' && rail.hosting === 'hosted' && rail.playHref === '/railavoid/' && rail.score.scope === 'independent', 'RAILaVOID must preserve its playable route and local score boundary')
  for (const [id, href] of Object.entries({ bloomfall: 'https://bloomfall.io/', acrolis: 'https://play.acrolis.io/', ttt3d: 'https://ttt3d.app/' })) {
    const game = getGameById(id)
    assert(game.hosting === 'independent' && game.status === 'external' && game.score.scope === 'independent' && game.playHref === href, `${id} must preserve its independent domain, account and score boundary`)
  }
  const flipside = getGameById('flipside')
  assert(flipside.hosting === 'subdomain' && flipside.status === 'playable' && flipside.playHref === 'https://flipside.avoidgame.io/' && flipside.score.scope === 'independent', 'FLIPSIDE must preserve its subdomain and independent scores')
  return { titles: allGames.length, playDestinations: allGames.filter((game) => game.playHref).length, soon: allGames.filter((game) => game.status === 'soon').length }
}

if (isMain(import.meta.url)) {
  const result = validateGameCatalog(loadGameCatalog(), await loadBuildManifest())
  console.log(`Game catalog contract verified: ${result.titles} titles, ${result.playDestinations} play destinations, ${result.soon} coming-soon states.`)
}
