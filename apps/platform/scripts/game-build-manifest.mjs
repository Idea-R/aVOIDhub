import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const manifestPath = path.join(repositoryRoot, 'apps/platform/game-build-manifest.json')
export const isMain = (url) => Boolean(process.argv[1]) && pathToFileURL(path.resolve(process.argv[1])).href === url
const platformRoutes = new Set(['api', 'games', '_next', 'assets', 'account', 'admin', 'auth', 'teams', 'login', 'leaderboards', 'membership', 'creators', 'players', 'results', 'privacy', 'terms'])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function validateBuildManifest(manifest) {
  assert(manifest?.schemaVersion === 1, 'Game build manifest schemaVersion must be 1')
  assert(Array.isArray(manifest.games) && manifest.games.length > 0, 'Game build manifest needs games')
  const unique = Object.fromEntries(['id', 'workspace', 'source', 'publicDirectory', 'playRoute'].map((key) => [key, new Set()]))
  for (const game of manifest.games) {
    assert(game && typeof game === 'object', 'Each game build must be an object')
    assert(/^[a-z][a-z0-9-]*$/.test(game.id ?? ''), 'Game build needs a canonical lowercase id')
    assert(!platformRoutes.has(game.id), `${game.id} is a reserved platform route`)
    assert(typeof game.name === 'string' && game.name.trim(), `${game.id} needs a build name`)
    assert(/^@avoid\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.workspace ?? ''), `${game.id} needs an @avoid workspace`)
    assert(typeof game.source === 'string' && /^(?:dist\/[A-Za-z0-9_-]+|games\/[a-z0-9-]+\/dist)$/.test(game.source), `${game.id} source must be dist/<directory> or games/<directory>/dist`)
    assert(typeof game.publicDirectory === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(game.publicDirectory), `${game.id} needs one safe public directory`)
    assert(!platformRoutes.has(game.publicDirectory.toLowerCase()), `${game.id} public directory is reserved`)
    assert(game.playRoute === null || game.playRoute === `/${game.id}/`, `${game.id} playRoute must be canonical or null for review only`)
    for (const key of Object.keys(unique)) {
      if (game[key] === null) continue
      const value = game[key].toLowerCase()
      assert(!unique[key].has(value), `Duplicate game build ${key}: ${game[key]}`)
      unique[key].add(value)
    }
  }
  return manifest
}

export async function loadBuildManifest(file = manifestPath) {
  return validateBuildManifest(JSON.parse(await readFile(file, 'utf8')))
}
