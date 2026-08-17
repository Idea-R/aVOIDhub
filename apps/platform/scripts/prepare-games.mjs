import { cp, lstat, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '../../..')
const publicRoot = path.join(repositoryRoot, 'apps', 'platform', 'public')

const games = [
  {
    name: 'VOIDaVOID',
    source: path.join(repositoryRoot, 'dist', 'VOIDaVOID'),
    target: path.join(publicRoot, 'VOIDaVOID'),
  },
  {
    name: 'WreckaVOID',
    source: path.join(repositoryRoot, 'games', 'wrecka-void', 'dist'),
    target: path.join(publicRoot, 'WreckaVOID'),
  },
  {
    name: 'WORDaVOID',
    source: path.join(repositoryRoot, 'dist', 'WORDaVOID'),
    target: path.join(publicRoot, 'WORDaVOID'),
  },
]

const allowedTargets = new Set(games.map((game) => path.resolve(game.target)))
const publicBoundary = `${path.resolve(publicRoot)}${path.sep}`

await mkdir(publicRoot, { recursive: true })

for (const game of games) {
  const source = path.resolve(game.source)
  const target = path.resolve(game.target)

  if (!allowedTargets.has(target) || !target.startsWith(publicBoundary)) {
    throw new Error(`Refusing unexpected game target: ${target}`)
  }

  const sourceStats = await lstat(source).catch(() => null)
  if (!sourceStats?.isDirectory() || sourceStats.isSymbolicLink()) {
    throw new Error(`Missing or unsafe ${game.name} build output: ${source}`)
  }

  const targetStats = await lstat(target).catch(() => null)
  if (targetStats?.isSymbolicLink()) {
    throw new Error(`Refusing linked game target: ${target}`)
  }

  if (targetStats) {
    await rm(target, { recursive: true, force: false })
  }

  await cp(source, target, { recursive: true, errorOnExist: true })
  console.log(`Prepared ${game.name} at ${path.relative(repositoryRoot, target)}`)
}
