const assert = require('assert')
const path = require('path')
const test = require('node:test')

const {
  backendDir,
  buildPyInstallerArgs,
} = require('./build-backend-runtime')

test('PyInstaller args include Sophia Tina templates as runtime data', () => {
  const args = buildPyInstallerArgs()
  const addDataIndex = args.indexOf('--add-data')

  assert.notEqual(addDataIndex, -1, 'expected --add-data in PyInstaller args')
  const addDataValue = args[addDataIndex + 1]
  const [source, target] = addDataValue.split(path.delimiter)

  assert.equal(source, path.join(backendDir, 'templates'))
  assert.equal(target, 'templates')
})
