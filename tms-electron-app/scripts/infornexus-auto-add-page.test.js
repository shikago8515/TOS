const assert = require('assert')
const test = require('node:test')

const helperModulePath = '../automation-apps/shipping-automation-demo/infornexus-auto-add-page.mjs'

function createLocatorSpyPage() {
  const locatorCalls = []
  return {
    locatorCalls,
    locator(selector) {
      locatorCalls.push(selector)
      return {
        first() {
          return { selector, firstCalled: true }
        },
      }
    },
  }
}

test('auto-add search input locator is scoped to tradecardForm only', async () => {
  const {
    getInfornexusAutoAddSearchInput,
    INFORNEXUS_AUTO_ADD_SEARCH_INPUT_SELECTOR,
  } = await import(helperModulePath)
  const page = createLocatorSpyPage()

  const locator = getInfornexusAutoAddSearchInput(page)

  assert.equal(
    INFORNEXUS_AUTO_ADD_SEARCH_INPUT_SELECTOR,
    '[name="tradecardForm"] [name="TradeSearchCriteria_newSearchParams_searchText"]',
  )
  assert.equal(page.locatorCalls.length, 1)
  assert.equal(page.locatorCalls[0], INFORNEXUS_AUTO_ADD_SEARCH_INPUT_SELECTOR)
  assert.equal(locator.firstCalled, true)
  assert.equal(
    page.locatorCalls[0].includes(', [name="TradeSearchCriteria_newSearchParams_searchText"]'),
    false,
  )
})

test('auto-add search button locator is scoped to tradecardForm only', async () => {
  const {
    getInfornexusAutoAddSearchButton,
    INFORNEXUS_AUTO_ADD_SEARCH_BUTTON_SELECTOR,
  } = await import(helperModulePath)
  const page = createLocatorSpyPage()

  const locator = getInfornexusAutoAddSearchButton(page)

  assert.equal(page.locatorCalls.length, 1)
  assert.equal(page.locatorCalls[0], INFORNEXUS_AUTO_ADD_SEARCH_BUTTON_SELECTOR)
  assert.equal(locator.firstCalled, true)
  assert.match(page.locatorCalls[0], /^\[name="tradecardForm"\]/)
  assert.equal(page.locatorCalls[0].includes(', input[value="Search"]'), false)
})

test('missing auto-add form diagnostics include URL, title, candidates, and screenshot path', async () => {
  const {
    collectInfornexusAutoAddSearchDiagnostics,
    formatInfornexusAutoAddSearchDiagnostics,
    INFORNEXUS_AUTO_ADD_SEARCH_INPUT_SELECTOR,
  } = await import(helperModulePath)
  const page = {
    url() {
      return 'https://network.infornexus.com/en/trade/Home'
    },
    async title() {
      return 'Infor Nexus Home'
    },
    async evaluate(callback, selector) {
      assert.equal(selector, INFORNEXUS_AUTO_ADD_SEARCH_INPUT_SELECTOR)
      return {
        hasTradecardForm: false,
        targetInputCount: 0,
        candidateCount: 1,
        candidates: [
          {
            id: 'navbarsearch',
            name: 'TradeSearchCriteria_newSearchParams_searchText',
            placeholder: 'Search',
            title: 'Shortcut: CTRL-/',
            type: 'text',
            formName: '',
            visible: false,
          },
        ],
      }
    },
  }

  const diagnostics = await collectInfornexusAutoAddSearchDiagnostics(page)
  const message = formatInfornexusAutoAddSearchDiagnostics(
    diagnostics,
    'C:\\Users\\Jax\\run-artifacts\\infornexus-auto-add-error.png',
  )

  assert.equal(diagnostics.hasTradecardForm, false)
  assert.equal(diagnostics.targetInputCount, 0)
  assert.match(message, /url=https:\/\/network\.infornexus\.com\/en\/trade\/Home/)
  assert.match(message, /title=Infor Nexus Home/)
  assert.match(message, /screenshot=C:\\Users\\Jax\\run-artifacts\\infornexus-auto-add-error\.png/)
  assert.match(message, /tradecardForm=false/)
  assert.match(message, /id=navbarsearch/)
  assert.match(message, /visible=false/)
})
