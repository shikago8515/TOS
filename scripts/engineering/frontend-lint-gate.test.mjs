import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')

test('frontend package exposes a lint gate', async () => {
  const packageJson = JSON.parse(
    await readFile(join(repoRoot, 'tms-frontend', 'package.json'), 'utf8'),
  )

  assert.equal(
    packageJson.scripts?.lint,
    'eslint "src/**/*.{ts,vue}" "vite.config.ts"',
  )
})

test('root frontend checks run lint before typecheck', async () => {
  const runChecks = await readFile(join(repoRoot, 'scripts', 'engineering', 'run-checks.mjs'), 'utf8')
  const lintCommand = "command('frontend:lint', 'tms-frontend', npmCommand.executable, [...npmCommand.args, 'run', 'lint'], npmCommand.shell)"
  const typecheckCommand = "command('frontend:typecheck', 'tms-frontend', npmCommand.executable, [...npmCommand.args, 'run', 'typecheck'], npmCommand.shell)"

  assert.match(runChecks, /function createNpmCommand\(\)/)
  assert.match(runChecks, /process\.env\.npm_execpath/)
  const lintOccurrences = Array.from(runChecks.matchAll(new RegExp(escapeRegExp(lintCommand), 'g')))
  assert.equal(lintOccurrences.length, 2)

  const fullLintIndex = runChecks.indexOf(lintCommand)
  const fullTypecheckIndex = runChecks.indexOf(typecheckCommand)
  assert.ok(fullLintIndex >= 0)
  assert.ok(fullTypecheckIndex > fullLintIndex)

  const quickLintIndex = runChecks.indexOf(lintCommand, fullLintIndex + lintCommand.length)
  const quickTypecheckIndex = runChecks.indexOf(typecheckCommand, fullTypecheckIndex + typecheckCommand.length)
  assert.ok(quickLintIndex >= 0)
  assert.ok(quickTypecheckIndex > quickLintIndex)
})

test('root quick checks include changed-check planner tests', async () => {
  const runChecks = await readFile(join(repoRoot, 'scripts', 'engineering', 'run-checks.mjs'), 'utf8')

  assert.match(runChecks, /run-changed-checks-test/)
  assert.match(runChecks, /scripts\/engineering\/run-changed-checks\.test\.mjs/)
})

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
