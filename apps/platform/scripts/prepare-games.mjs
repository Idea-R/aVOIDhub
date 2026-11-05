import { cp, lstat, mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { isMain, loadBuildManifest, repositoryRoot, validateBuildManifest } from './game-build-manifest.mjs'

async function statsIfPresent(file) {
  return lstat(file).catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
}

async function assertUnlinkedPath(root, target) {
  const relative = path.relative(root, target)
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error(`Refusing path outside repository: ${target}`)
  }
  let current = root
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment)
    const stats = await statsIfPresent(current)
    if (stats?.isSymbolicLink()) throw new Error(`Refusing linked game path: ${current}`)
    if (stats && !stats.isDirectory()) throw new Error(`Game path must be a directory: ${current}`)
  }
}

async function assertUnlinkedTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    const stats = await lstat(file)
    if (stats.isSymbolicLink()) throw new Error(`Refusing linked game build entry: ${file}`)
    if (stats.isDirectory()) await assertUnlinkedTree(file)
    else if (!stats.isFile()) throw new Error(`Refusing special game build entry: ${file}`)
  }
}

export async function prepareGames({ root = repositoryRoot, manifest, log = console.log } = {}) {
  manifest = validateBuildManifest(manifest ?? await loadBuildManifest())
  root = path.resolve(root)
  const publicRoot = path.join(root, 'apps/platform/public')
  const games = manifest.games.map((game) => ({
    ...game,
    sourcePath: path.resolve(root, game.source),
    targetPath: path.join(publicRoot, game.publicDirectory),
  }))

  // Validate every source and target before replacing any previously staged build.
  for (const game of games) {
    await assertUnlinkedPath(root, game.sourcePath)
    await assertUnlinkedPath(root, game.targetPath)
    const sourceStats = await statsIfPresent(game.sourcePath)
    if (!sourceStats?.isDirectory()) throw new Error(`Missing ${game.name} build output: ${game.sourcePath}`)
    await assertUnlinkedTree(game.sourcePath)
    const indexStats = await statsIfPresent(path.join(game.sourcePath, 'index.html'))
    if (!indexStats?.isFile() || indexStats.size === 0) throw new Error(`Missing or empty ${game.name} index.html`)
    if (await statsIfPresent(game.targetPath)) await assertUnlinkedTree(game.targetPath)
  }

  await mkdir(publicRoot, { recursive: true })
  for (const game of games) {
    await assertUnlinkedPath(root, game.sourcePath)
    await assertUnlinkedPath(root, game.targetPath)
    if (await statsIfPresent(game.targetPath)) await rm(game.targetPath, { recursive: true, force: false })
    await cp(game.sourcePath, game.targetPath, { recursive: true, errorOnExist: true, force: false })
    log(`Prepared ${game.name} at ${path.relative(root, game.targetPath)}`)
  }
}

if (isMain(import.meta.url)) await prepareGames()
