const assert = require('assert')
const path = require('path')
const test = require('node:test')

const {
  backendDir,
  backendConfigDir,
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

test('PyInstaller args include release update seed data as runtime data', () => {
  const args = buildPyInstallerArgs()
  const addDataValues = args
    .map((arg, index) => (arg === '--add-data' ? args[index + 1] : undefined))
    .filter(Boolean)
  const seedDataValue = addDataValues.find((value) => value.endsWith(`${path.delimiter}data`))

  assert(seedDataValue, 'expected release update data --add-data value')
  const [source, target] = seedDataValue.split(path.delimiter)

  assert.equal(source, path.join(backendDir, 'data'))
  assert.equal(target, 'data')
})

test('PyInstaller args include backend config as runtime data', () => {
  const args = buildPyInstallerArgs()
  const addDataValues = args
    .map((arg, index) => (arg === '--add-data' ? args[index + 1] : undefined))
    .filter(Boolean)
  const configDataValue = addDataValues.find((value) => value.endsWith(`${path.delimiter}config`))

  assert(configDataValue, 'expected backend config --add-data value')
  const [source, target] = configDataValue.split(path.delimiter)

  assert.equal(source, backendConfigDir)
  assert.equal(target, 'config')
})

test('PyInstaller args exclude unused heavyweight optional packages', () => {
  const args = buildPyInstallerArgs()
  const excludedModules = []

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--exclude-module') {
      excludedModules.push(args[index + 1])
    }
  }

  assert.deepEqual(excludedModules.sort(), [
    'cv2',
    'pyarrow',
    'scipy',
    'sklearn',
    'torch',
  ])
})
