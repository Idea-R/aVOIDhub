import { spawnSync } from 'node:child_process'
import { isMain, loadBuildManifest, repositoryRoot, validateBuildManifest } from '../apps/platform/scripts/game-build-manifest.mjs'

export function buildPlatformGames(manifest, run = spawnSync) {
  validateBuildManifest(manifest)
  for (const game of manifest.games) {
    const args = ['run', 'build', `--workspace=${game.workspace}`]
    console.log(`Building ${game.name} (${game.workspace})`)
    const npmEntry = process.env.npm_execpath
    const result = run(npmEntry ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm', npmEntry ? [npmEntry, ...args] : args, {
      cwd: repositoryRoot,
      stdio: 'inherit',
      env: process.env,
      shell: !npmEntry && process.platform === 'win32',
    })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`${game.name} build failed (${result.signal ?? result.status})`)
  }
}

if (isMain(import.meta.url)) buildPlatformGames(await loadBuildManifest())
