import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
describe('platform stylesheet validity', () => {
  it.each(['../app/globals.css', '../app/teams/teams.css'])('parses %s without silently recovering unclosed blocks', name => {
    const file = new URL(name, import.meta.url)
    expect(() => postcss.parse(readFileSync(file, 'utf8'), { from: file.pathname })).not.toThrow()
  })
})
