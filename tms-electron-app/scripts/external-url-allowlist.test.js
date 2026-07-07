const assert = require('assert')
const fs = require('fs')
const path = require('path')
const test = require('node:test')

const mainProcessPath = path.resolve(__dirname, '..', 'main-simple.js')
const {
  isAllowedExternalUrl,
  normalizeAllowedExternalUrl,
} = require('../external-url-allowlist')

test('allows only known HTTPS business and update-source URLs', () => {
  assert.equal(isAllowedExternalUrl('https://network.infornexus.com/'), true)
  assert.equal(isAllowedExternalUrl('https://ai.tomwell.net:56130/tos/tos-desktop/download'), true)
  assert.equal(isAllowedExternalUrl('http://172.16.8.13:56130/tos/tos-desktop/download'), true)
  assert.equal(
    isAllowedExternalUrl('https://updates.example.internal/tos/releases/download.zip', {
      updateFeedUrl: 'https://updates.example.internal/tos/releases/',
    }),
    true,
  )
})

test('rejects unsafe protocols, invalid URLs, and unknown hosts', () => {
  assert.equal(isAllowedExternalUrl('http://network.infornexus.com/'), false)
  assert.equal(isAllowedExternalUrl('https://172.16.8.13:56130/tos/tos-desktop/download'), false)
  assert.equal(isAllowedExternalUrl('file:///C:/Windows/System32/calc.exe'), false)
  assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false)
  assert.equal(isAllowedExternalUrl('data:text/html,hello'), false)
  assert.equal(isAllowedExternalUrl('https://github.com/shikago8515/TOS/releases/latest/download/TOS.zip'), false)
  assert.equal(isAllowedExternalUrl('https://evil.example.com/phishing'), false)
  assert.equal(isAllowedExternalUrl('not a url'), false)
})

test('normalizes allowed external URLs and returns an empty string for denied URLs', () => {
  assert.equal(
    normalizeAllowedExternalUrl('https://network.infornexus.com'),
    'https://network.infornexus.com/',
  )
  assert.equal(normalizeAllowedExternalUrl('https://evil.example.com'), '')
})

test('routes every Electron external open through the allowlist helper', () => {
  const source = fs.readFileSync(mainProcessPath, 'utf8')

  assert.match(source, /require\('\.\/external-url-allowlist'\)/)
  assert.match(source, /normalizeAllowedExternalUrl\(manualDownload\.url,\s*\{\s*updateFeedUrl\s*\}\)/)
  assert.match(source, /normalizeAllowedExternalUrl\(url,\s*\{\s*updateFeedUrl\s*\}\)/)
  assert.match(source, /setWindowOpenHandler\(\(\{\s*url\s*\}\)\s*=>\s*\{[\s\S]*normalizeAllowedExternalUrl\(url,\s*\{\s*updateFeedUrl\s*\}\)/)
})
