import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url))
const sourceExtensions = /\.(ts|tsx|js|jsx|vue)$/
const nativeAlertPattern = new RegExp('window\\.alert|\\balert\\s*\\(')

function collectSourceFiles(directory: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(path))
      continue
    }
    if (!sourceExtensions.test(path) || /\.test\.(ts|tsx|js|jsx)$/.test(path)) continue
    files.push(path)
  }
  return files
}

describe('App alert source integration', () => {
  it('mounts the custom alert host at the app root', () => {
    const appSource = readFileSync(join(sourceRoot, 'App.vue'), 'utf8')
    expect(appSource).toContain('AppAlertDialog')
  })

  it('does not use native browser alert dialogs in application source files', () => {
    const offenders = collectSourceFiles(sourceRoot).filter((file) => {
      const source = readFileSync(file, 'utf8')
      return nativeAlertPattern.test(source)
    })

    expect(offenders).toEqual([])
  })
})
