const assert = require('assert')
const test = require('node:test')

const helperModulePath = '../automation-apps/shipping-automation-demo/infornexus-auto-add-page.mjs'
const expectedAutoAddSearchUrl =
  'https://network.infornexus.com/en/trade/Search.jsp?___bounce=1&userAction=search&unifiedUser=true&TradeSearchCriteria_newSearchParams_searchText=&refSearchUsed=true#searchResults'

test('manual auto-add search session opens Search.jsp and stays active', async () => {
  const { createInfornexusAutoAddManualSessionManager } = await import(helperModulePath)
  const events = []
  const fakePage = createFakePage(events)
  const fakeContext = createFakeContext(fakePage, events)
  const fakeBrowser = createFakeBrowser(fakeContext, events)
  let readySession = null
  const manager = createInfornexusAutoAddManualSessionManager({
    browserEngines: {
      chromium: {
        async launch(options) {
          events.push({ type: 'launch', options })
          return fakeBrowser
        },
      },
    },
    buildVisibleBrowserLaunchOptions(options, browserName) {
      events.push({ type: 'visible-options', options, browserName })
      return { ...options, args: ['--start-maximized'] }
    },
    config: createConfig(),
    createManualSessionId: () => 'manual-session-1',
    ensureLoggedIn: async (page, credentials) => {
      events.push({ type: 'login', page, credentials })
    },
    log: () => {},
    onManualSessionReady: async (session) => {
      readySession = session
      events.push({ type: 'manual-ready', manualSessionId: session.manualSessionId })
    },
    safePageTitle: (page) => page.title(),
    safePageUrl: (page) => page.url(),
  })

  const result = await manager.open({ username: 'user@example.com', password: 'secret' }, { headless: false })

  assert.equal(result.ok, true)
  assert.equal(result.loginSuccess, true)
  assert.equal(result.searchOpened, true)
  assert.equal(result.manualSessionId, 'manual-session-1')
  assert.equal(result.autoAddSearchUrl, expectedAutoAddSearchUrl)
  assert.equal(result.finalUrl, expectedAutoAddSearchUrl)
  assert.equal(manager.getSessionSummary().manualSessionId, 'manual-session-1')
  assert.equal(readySession.manualSessionId, 'manual-session-1')
  assert.equal(readySession.page, fakePage)
  assert.equal(events.some((event) => event.type === 'manual-ready'), true)
  assert.equal(events.some((event) => event.type === 'context-close'), false)
  assert.equal(events.some((event) => event.type === 'browser-close'), false)

  await manager.close('test-cleanup')

  assert.equal(manager.getSessionSummary(), null)
  assert.equal(events.some((event) => event.type === 'context-close'), true)
  assert.equal(events.some((event) => event.type === 'browser-close'), true)
})

test('manual auto-add search session replaces an existing session before opening another', async () => {
  const { createInfornexusAutoAddManualSessionManager } = await import(helperModulePath)
  const events = []
  const pages = [createFakePage(events), createFakePage(events)]
  const contexts = pages.map((page) => createFakeContext(page, events))
  const browsers = contexts.map((context) => createFakeBrowser(context, events))
  let launchIndex = 0
  let sessionIndex = 0
  const manager = createInfornexusAutoAddManualSessionManager({
    browserEngines: {
      chromium: {
        async launch() {
          const browser = browsers[launchIndex]
          launchIndex += 1
          return browser
        },
      },
    },
    buildVisibleBrowserLaunchOptions: (options) => options,
    config: createConfig(),
    createManualSessionId: () => {
      sessionIndex += 1
      return `manual-session-${sessionIndex}`
    },
    ensureLoggedIn: async () => {},
    log: () => {},
    safePageTitle: (page) => page.title(),
    safePageUrl: (page) => page.url(),
  })

  await manager.open({ username: 'first', password: 'secret' }, { headless: false })
  const secondResult = await manager.open({ username: 'second', password: 'secret' }, { headless: false })

  assert.equal(secondResult.manualSessionId, 'manual-session-2')
  assert.equal(manager.getSessionSummary().manualSessionId, 'manual-session-2')
  assert.equal(events.filter((event) => event.type === 'context-close').length, 1)
  assert.equal(events.filter((event) => event.type === 'browser-close').length, 1)

  await manager.close('test-cleanup')
})

function createConfig() {
  return {
    autoAddSearchUrl: expectedAutoAddSearchUrl,
    browser: 'chromium',
    launchOptions: {},
    loginUrl: 'https://network.infornexus.com',
    navigationTimeoutMs: 12345,
    postLoginWaitMs: 25,
    slowMo: 0,
  }
}

function createFakePage(events) {
  const handlers = new Map()
  let currentUrl = ''
  return {
    async goto(url, options) {
      currentUrl = url
      events.push({ type: 'page-goto', url, options })
    },
    isClosed() {
      return false
    },
    on(eventName, handler) {
      handlers.set(eventName, handler)
    },
    setDefaultNavigationTimeout(timeoutMs) {
      events.push({ type: 'default-navigation-timeout', timeoutMs })
    },
    setDefaultTimeout(timeoutMs) {
      events.push({ type: 'default-timeout', timeoutMs })
    },
    async title() {
      return 'Infor Nexus Search'
    },
    url() {
      return currentUrl
    },
    async waitForLoadState(state, options) {
      events.push({ type: 'wait-for-load-state', state, options })
    },
    async waitForTimeout(timeoutMs) {
      events.push({ type: 'wait-for-timeout', timeoutMs })
    },
    _emit(eventName) {
      handlers.get(eventName)?.()
    },
  }
}

function createFakeContext(page, events) {
  const handlers = new Map()
  return {
    async close() {
      events.push({ type: 'context-close' })
      handlers.get('close')?.()
    },
    async newPage() {
      return page
    },
    on(eventName, handler) {
      handlers.set(eventName, handler)
    },
  }
}

function createFakeBrowser(context, events) {
  const handlers = new Map()
  return {
    async close() {
      events.push({ type: 'browser-close' })
      handlers.get('disconnected')?.()
    },
    async newContext() {
      return context
    },
    on(eventName, handler) {
      handlers.set(eventName, handler)
    },
  }
}
