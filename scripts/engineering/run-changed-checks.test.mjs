import assert from 'node:assert/strict'
import test from 'node:test'

import { planChangedChecks } from './run-changed-checks.mjs'

function commandIds(files, options) {
  return planChangedChecks(files, options).commands.map((command) => command.id)
}

test('docs-only changes only require whitespace checks', () => {
  assert.deepEqual(commandIds([
    'README.md',
    'AGENTS.md',
    'docs/engineering-entrypoints.md',
  ]), [
    'git:diff-check:committed',
    'git:diff-check:staged',
    'git:diff-check:working-tree',
  ])
})

test('docs-only committed whitespace checks honor custom base refs', () => {
  const plan = planChangedChecks([
    'docs/engineering-entrypoints.md',
  ], { base: 'main~1' })

  assert.deepEqual(plan.commands[0], {
    id: 'git:diff-check:committed',
    label: 'git:diff-check:committed',
    cwd: '.',
    runner: 'git',
    args: ['diff', '--check', 'main~1...HEAD'],
  })
})

test('frontend source changes use frontend quick checks without full project gate', () => {
  assert.deepEqual(commandIds([
    'tms-frontend/src/app/router.ts',
    'tms-frontend/src/pages/jane/JanePage.vue',
  ]), [
    'frontend:lint',
    'frontend:typecheck',
    'frontend:test',
  ])
})

test('backend module changes map to the matching unittest module', () => {
  assert.deepEqual(commandIds([
    'tms-backend/modules/jane_module.py',
  ]), [
    'backend:test:tests.test_jane_module',
  ])
})

test('backend api changes map to the matching business module unittest', () => {
  assert.deepEqual(commandIds([
    'tms-backend/api/jessca_api.py',
  ]), [
    'backend:test:tests.test_jessca_module',
  ])
})

test('backend test file changes run that test module directly', () => {
  assert.deepEqual(commandIds([
    'tms-backend/tests/test_eric_module.py',
  ]), [
    'backend:test:tests.test_eric_module',
  ])
})

test('unmapped backend changes use the backend full check', () => {
  assert.deepEqual(commandIds([
    'tms-backend/utils/excel_result_history.py',
  ]), [
    'backend:full',
  ])
})

test('mixed frontend and backend changes escalate to the project quick gate', () => {
  assert.deepEqual(commandIds([
    'tms-frontend/src/shared/api/backendClient.ts',
    'tms-backend/api/jane_api.py',
  ]), [
    'root:check:quick',
  ])
})

test('high-risk engineering and package changes escalate to the project quick gate', () => {
  assert.deepEqual(commandIds([
    'package.json',
    'scripts/engineering/run-checks.mjs',
  ]), [
    'root:check:quick',
  ])
})

test('validation planner changes escalate to the project quick gate', () => {
  assert.deepEqual(commandIds([
    'scripts/engineering/run-changed-checks.mjs',
  ]), [
    'root:check:quick',
  ])
})

test('commands and input files are deduplicated', () => {
  assert.deepEqual(commandIds([
    'tms-frontend/src/app/router.ts',
    'tms-frontend/src/app/router.ts',
    'tms-frontend/src/domain/moduleCatalog.ts',
  ]), [
    'frontend:lint',
    'frontend:typecheck',
    'frontend:test',
  ])
})
