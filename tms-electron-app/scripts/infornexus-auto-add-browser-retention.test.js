const assert = require('assert')
const fs = require('fs')
const path = require('path')
const test = require('node:test')

const serverPath = path.join(__dirname, '..', 'automation-apps', 'shipping-automation-demo', 'server.mjs')

test('Infornexus auto-add keeps the visible browser open after a completed run', () => {
  const source = fs.readFileSync(serverPath, 'utf8')
  const retainStart = source.indexOf('if (!resolveRunHeadless(runContext) && page && !page.isClosed?.())')
  const finallyStart = source.indexOf('} finally {', source.indexOf('async function runInfornexusAutoAddWorkflow'))
  const finallyEnd = source.indexOf('async function runShippingWorkflow', finallyStart)
  const finallySource = source.slice(finallyStart, finallyEnd)

  assert.notEqual(retainStart, -1, 'visible auto-add runs should have a browser-retention branch')
  assert.match(source.slice(retainStart, retainStart + 900), /retainAutoAddBrowserSession/)
  assert.match(source.slice(retainStart, retainStart + 900), /browserRetainedAfterCompletion = true/)
  assert.match(source.slice(retainStart, retainStart + 900), /result\.browserRetained = true/)
  assert.match(finallySource, /if \(!browserRetainedAfterCompletion\)/)
  assert.match(finallySource, /await context\?\.close\(\)\.catch/)
  assert.match(finallySource, /await browser\?\.close\(\)\.catch/)
})

test('retained Infornexus auto-add sessions expose a top-right Excel continuation panel', () => {
  const source = fs.readFileSync(serverPath, 'utf8')

  assert.match(source, /AUTO_ADD_CONTINUE_PANEL_ID = "tos-infornexus-auto-add-continue-panel"/)
  assert.match(source, /AUTO_ADD_CONTINUE_BINDING = "__tosInfornexusAutoAddUpload"/)
  assert.match(source, /AUTO_ADD_REMOVE_BATCH_PRINT_ITEM_SELECTOR = 'a\[href\*="remove\.batch\.print\.item"\]'/)
  assert.match(source, /onManualSessionReady: installInfornexusAutoAddContinuationForManualSession/)
  assert.match(source, /async function installInfornexusAutoAddContinuationForManualSession/)
  assert.match(source, /sessionSource: "manual-search"/)
  assert.match(source, /retainedAutoAddSessions: getRetainedAutoAddSessionSummaries\(\)/)
  assert.match(source, /async function installInfornexusAutoAddContinuationPanel/)
  assert.match(source, /await page\.exposeBinding\(AUTO_ADD_CONTINUE_BINDING/)
  assert.match(source, /async function injectInfornexusAutoAddContinuationPanel/)
  assert.match(source, /right:18px/)
  assert.match(source, /top:18px/)
  assert.doesNotMatch(source, /bottom:18px/)
  assert.match(source, /data-tos-auto-add-drag-handle/)
  assert.match(source, /title\.addEventListener\("pointerdown"/)
  assert.match(source, /继续上传 Excel/)
  assert.match(source, /async function reopenInfornexusAutoAddSearchFromHome/)
  assert.match(source, /async function clickInfornexusAutoAddRemoveBeforeContinuation/)
  assert.match(source, /async function tryClickInfornexusAutoAddRemoveOnInitialEntry/)
  assert.match(source, /async function clickInfornexusAutoAddRemoveLocator/)
  assert.match(source, /async function tryFindInfornexusAutoAddRemoveLocator/)
  assert.match(source, /async function findInfornexusAutoAddRemoveLocator/)
  assert.match(source, /forceClickLocator\(removeLocator, "Infornexus Auto Add Remove"\)/)
  assert.match(source, /async function runRetainedAutoAddContinuation/)
  assert.match(source, /extractInfornexusAutoAddRowsFromWorkbookPayload\(payload\)/)
  assert.match(source, /openInfornexusAutoAddSearchPage\(page/)
  assert.match(source, /processInfornexusAutoAddId\(page, id\)/)

  const reenterCall = source.indexOf('reenteredBeforeRemove = await reopenInfornexusAutoAddSearchFromHome(page, inputFileName)')
  const removeCall = source.indexOf('removeBeforeContinue = await clickInfornexusAutoAddRemoveBeforeContinuation(page, inputFileName)', reenterCall)
  const searchCall = source.indexOf('await openInfornexusAutoAddSearchPage(page', removeCall)
  assert.notEqual(reenterCall, -1, 'continuation flow should re-enter Auto Add from the home entry before Remove')
  assert(removeCall > reenterCall, 'continuation flow should click Remove after re-entering Auto Add')
  assert(searchCall > removeCall, 'continuation flow should reopen Search after Remove before filling the new Excel')
})

test('initial Infornexus auto-add run attempts Remove before filling Excel IDs', () => {
  const source = fs.readFileSync(serverPath, 'utf8')
  const workflowStart = source.indexOf('async function runInfornexusAutoAddWorkflow')
  const searchReady = source.indexOf('await waitForInfornexusAutoAddSearchReady(page);', workflowStart)
  const removeCall = source.indexOf('removeOnInitialEntry = await tryClickInfornexusAutoAddRemoveOnInitialEntry(page, runContext?.inputFileName || "")', searchReady)
  const reopenCall = source.indexOf('autoAddSearchUrl = await openInfornexusAutoAddSearchPage(page', removeCall)
  const loopStart = source.indexOf('for (let index = 0; index < idRows.length; index += 1)', removeCall)

  assert.notEqual(workflowStart, -1, 'auto-add workflow should exist')
  assert.notEqual(searchReady, -1, 'initial run should wait for the Auto Add page before Remove')
  assert(removeCall > searchReady, 'initial run should try Remove after the Auto Add page is ready')
  assert(reopenCall > removeCall, 'initial run should reopen the Auto Add page after a clicked Remove')
  assert(loopStart > removeCall, 'initial run should attempt Remove before filling Excel IDs')
  assert.match(source, /phase: "initial-remove"/)
  assert.match(source, /phase: "initial-remove-skipped"/)
  assert.match(source, /removeOnInitialEntry,/)
})

test('browser automation status badge is draggable from its title row', () => {
  const source = fs.readFileSync(serverPath, 'utf8')

  assert.match(source, /data-tos-badge-drag-handle/)
  assert.match(source, /pointer-events:auto/)
  assert.match(source, /cursor:move/)
  assert.match(source, /pointerdown/)
  assert.match(source, /pointermove/)
  assert.match(source, /root\.style\.left = `\$\{nextLeft\}px`/)
  assert.match(source, /root\.style\.top = `\$\{nextTop\}px`/)
})

test('shipping executor ships and self-installs the Infor Nexus Print-Scan-Ship extension', () => {
  const source = fs.readFileSync(serverPath, 'utf8')
  const extensionRoot = path.join(
    path.dirname(serverPath),
    'infor-nexus-extension',
    'fkmgjdbgapopggcnkapkodfjeblddieo',
  )

  assert.equal(fs.existsSync(path.join(extensionRoot, 'manifest.json')), true)
  assert.equal(fs.existsSync(path.join(extensionRoot, 'background.js')), true)
  assert.match(source, /function resolveBundledInforNexusExtensionPath/)
  assert.match(source, /function installInforNexusExtensionFromBundle/)
  assert.match(source, /copyDirectoryRecursive\(sourceDir, targetDir\)/)
  assert.match(source, /return bundledResolved/)
  assert.match(source, /function canUseInforNexusExtensionLaunch/)
  assert.doesNotMatch(source, /channel === "chrome"/)
})
