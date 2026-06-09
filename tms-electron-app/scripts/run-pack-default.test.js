const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')

const {
  copyDirectoryFiltered,
  findIncompleteFilteredFiles,
} = require('./run-pack-default')

test('allows the backend runtime Sophia Tina template during package resource sync', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-runtime-template-filter-'))
  const sourceRoot = path.join(root, 'source')
  const targetRoot = path.join(root, 'target')
  const templatePath = 'tos-backend/_internal/templates/sophia_tina_pivot_template.xlsx'

  fs.mkdirSync(path.join(sourceRoot, 'tos-backend', '_internal', 'templates'), { recursive: true })
  fs.writeFileSync(path.join(sourceRoot, templatePath), 'pivot-template')
  fs.writeFileSync(path.join(sourceRoot, 'tos-backend', '_internal', 'templates', 'scratch.xlsx'), 'runtime-data')

  copyDirectoryFiltered(sourceRoot, targetRoot, sourceRoot, {
    includeXlsxPaths: [templatePath],
  })

  assert.equal(fs.existsSync(path.join(targetRoot, templatePath)), true)
  assert.equal(
    fs.existsSync(path.join(targetRoot, 'tos-backend', '_internal', 'templates', 'scratch.xlsx')),
    false,
  )
  assert.deepEqual(findIncompleteFilteredFiles(sourceRoot, targetRoot, sourceRoot, {
    includeXlsxPaths: [templatePath],
  }), [])
})
