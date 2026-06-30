import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

const repoRoot = resolve(import.meta.dirname, '..', '..')
const giteaWorkflowPath = resolve(repoRoot, '.gitea', 'workflows', 'tos-check.yml')
const gitcodeWorkflowPath = resolve(repoRoot, '.gitcode', 'workflows', 'tos-check.yml')

test('release workflow is owned by Gitea Actions only', () => {
  assert.equal(existsSync(gitcodeWorkflowPath), false, 'old GitCode workflow must be removed')
  assert.equal(existsSync(giteaWorkflowPath), true, 'Gitea workflow must exist')

  const workflow = readFileSync(giteaWorkflowPath, 'utf8')
  assert.doesNotMatch(workflow, /GitCode|GITCODE|gitcode\.com/)
  assert.match(workflow, /\$\{\{\s*secrets\.GITEA_TOKEN\s*\}\}/)
  assert.match(workflow, /refs\/heads\/main/)
  assert.match(workflow, /npm run check/)
  assert.match(workflow, /npm run release -- --no-ci/)
  assert.match(workflow, /git fetch --depth 1 "\$auth_repo_url" "\$GITEA_REF" \|\| true/)
  assert.match(workflow, /apk add --no-cache nodejs npm python3 py3-pip/)
  assert.doesNotMatch(workflow, /nodejs\.org\/dist/)
})
