const assert = require('assert')
const fs = require('fs/promises')
const http = require('http')
const os = require('os')
const path = require('path')
const test = require('node:test')
const { pathToFileURL } = require('url')

const repoRoot = path.resolve(__dirname, '..', '..')
const poAutoDownloadModuleUrl = pathToFileURL(
  path.join(
    repoRoot,
    'tms-electron-app',
    'automation-apps',
    'shipping-automation-demo',
    'po-auto-download',
    'po-auto-download.mjs',
  ),
).href

test('request login accepts HTTP 200 when Infor Nexus cookies establish a session', async () => {
  const {
    createPoAutoDownloadRequestSession,
  } = await import(poAutoDownloadModuleUrl)

  await withHttpServer(async (req, res) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <form action="/en/trade/login.jsp" method="POST">
          <input name="userid" value="">
          <input name="uPassword" value="">
          <input name="LCSRF_VAL" value="csrf-value">
        </form>
      `)
      return
    }
    if (req.method === 'POST' && pathname === '/en/trade/login.jsp') {
      await readRequestBody(req)
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Set-Cookie': [
          'userToken=user-token-value; Path=/',
          'JSESSIONID=session-cookie-value; Path=/',
          'sToken=s-token-value; Path=/',
        ],
      })
      res.end('<html><title>Infor Nexus Home</title><body>APPLICATIONS</body></html>')
      return
    }
    if (req.method === 'GET' && pathname === '/en/trade/Homepage.jsp') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body>Home</body></html>')
      return
    }
    if (req.method === 'GET' && pathname === '/en/trade/InvoicesView.jsp') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body>InProgressInvoicePageManager</body></html>')
      return
    }
    res.writeHead(404)
    res.end('not found')
  }, async (baseUrl) => {
    const session = await createPoAutoDownloadRequestSession({
      credentials: {
        username: 'test-user',
        password: 'test-password',
      },
      config: {
        loginUrl: baseUrl,
      },
      log: () => {},
      runId: 'test-run',
    })

    assert.equal(session.authMethod, 'request-login')
    assert.equal(session.method, 'request-login')
    assert.equal(session.cookieMap.userToken, 'user-token-value')
    assert.equal(session.cookieMap.JSESSIONID, 'session-cookie-value')
    assert.equal(session.sToken, 's-token-value')
    assert.equal(session.finalUrl, `${baseUrl}/en/trade/InvoicesView.jsp`)
  })
})

test('request login reports friendly login-page failure without exposing HTML', async () => {
  const {
    createPoAutoDownloadRequestSession,
  } = await import(poAutoDownloadModuleUrl)

  await withHttpServer(async (req, res) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <!DOCTYPE html>
        <html><title>Infor Nexus Login</title><body>
          <form action="/en/trade/login.jsp" method="POST">
            <input name="userid" value="">
            <input name="uPassword" value="">
          </form>
        </body></html>
      `)
      return
    }
    if (req.method === 'POST' && pathname === '/en/trade/login.jsp') {
      await readRequestBody(req)
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <!DOCTYPE html>
        <html><title>Infor Nexus Login</title><body>
          Log In Using Password
          <form action="/en/trade/login.jsp" method="POST">
            <input name="userid" value="">
            <input name="uPassword" value="">
          </form>
        </body></html>
      `)
      return
    }
    res.writeHead(404)
    res.end('not found')
  }, async (baseUrl) => {
    await assert.rejects(
      () => createPoAutoDownloadRequestSession({
        credentials: {
          username: 'test-user',
          password: 'test-password',
        },
        config: {
          loginUrl: baseUrl,
        },
        log: () => {},
        runId: 'test-run',
      }),
      (error) => {
        assert.match(error.message, /Infor Nexus 登录失败/)
        assert.doesNotMatch(error.message, /<!DOCTYPE|<html|Log In Using Password/i)
        return true
      },
    )
  })
})

test('browser cookies are converted to request cookie jar', async () => {
  const {
    createCookieJarFromBrowserCookies,
  } = await import(poAutoDownloadModuleUrl)

  const jar = createCookieJarFromBrowserCookies([
    { name: 'userToken', value: 'user-token-value' },
    { name: 'JSESSIONID', value: 'session-cookie-value' },
    { name: 'sToken', value: 's-token-value' },
    { name: '', value: 'ignored' },
  ])

  assert.equal(jar.get('userToken'), 'user-token-value')
  assert.equal(jar.get('JSESSIONID'), 'session-cookie-value')
  assert.equal(jar.get('sToken'), 's-token-value')
  assert.deepEqual(jar.entries(), {
    userToken: 'user-token-value',
    JSESSIONID: 'session-cookie-value',
    sToken: 's-token-value',
  })
  assert.equal(jar.header(), 'userToken=user-token-value; JSESSIONID=session-cookie-value; sToken=s-token-value')
})

test('invoice download accepts active and new STATUS values', async () => {
  const {
    isDownloadableInvoiceStatus,
  } = await import(poAutoDownloadModuleUrl)

  assert.equal(isDownloadableInvoiceStatus('active'), true)
  assert.equal(isDownloadableInvoiceStatus('NEW'), true)
  assert.equal(isDownloadableInvoiceStatus(' New '), true)
  assert.equal(isDownloadableInvoiceStatus('inactive'), false)
  assert.equal(isDownloadableInvoiceStatus(''), false)
})

test('invoice request-flow errors are user-facing messages', async () => {
  const {
    buildInvoiceNotFoundMessage,
    buildInvoicePdfNotAvailableMessage,
  } = await import(poAutoDownloadModuleUrl)

  const notFound = buildInvoiceNotFoundMessage('17-06-26-1548')
  assert.match(notFound, /Infor Nexus 系统没有找到这个 Invoice/)
  assert.match(notFound, /INVOICE NUMBER/)
  assert.doesNotMatch(notFound, /PageResolver URL was not found/i)

  const pdfUnavailable = buildInvoicePdfNotAvailableMessage('17-06-26-1548')
  assert.match(pdfUnavailable, /系统没有返回可下载的 Invoice PDF/)
  assert.match(pdfUnavailable, /手工打开该发票/)
  assert.doesNotMatch(pdfUnavailable, /dyncon URL was not found/i)
})

test('invoice request flow retries transient PageResolver 502 failures', async () => {
  const {
    createPoAutoDownloadAutomation,
  } = await import(poAutoDownloadModuleUrl)

  let pageResolverHits = 0
  await withHttpServer(async (req, res) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname
    if (handleRequestLoginFixture(req, res, pathname)) return
    if (req.method === 'POST' && pathname === '/en/trade/InProgressInvoices') {
      await readRequestBody(req)
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html><body>
          <a href="/en/trade/PageResolver?pageResolverType=InvoicePageResolver&destination=CommercialInvoice&originType=Shipment&originKey=1">INV-RETRY-1</a>
        </body></html>
      `)
      return
    }
    if (req.method === 'GET' && pathname === '/en/trade/PageResolver') {
      pageResolverHits += 1
      if (pageResolverHits === 1) {
        res.writeHead(502, { 'Content-Type': 'text/html' })
        res.end('<!DOCTYPE html><html><body>Bad Gateway</body></html>')
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<iframe src="/dyncon/?renderType=PDF&type=CommercialInvoice&topicName=ADIDAS_FINANCIAL_INVOICE_PDF"></iframe>')
      return
    }
    if (req.method === 'GET' && pathname === '/dyncon/') {
      res.writeHead(200, { 'Content-Type': 'application/pdf' })
      res.end(Buffer.from('%PDF-1.4\n% test pdf\n'))
      return
    }
    res.writeHead(404)
    res.end('not found')
  }, async (baseUrl) => {
    const result = await runSingleInvoiceAutomation({
      baseUrl,
      invoiceNumber: 'INV-RETRY-1',
      body: {
        downloadRetryCount: 1,
        downloadRetryBaseDelayMs: 1,
      },
    })

    assert.equal(result.ok, true)
    assert.equal(result.downloadedPoCount, 1)
    assert.equal(pageResolverHits, 2)
    assert.equal(result.poResults[0].retryRecovered, true)
    assert.equal(result.poResults[0].retryAttemptCount, 1)
  })
})

test('invoice request flow follows PDF HTTP 302 redirects', async () => {
  const {
    createPoAutoDownloadAutomation,
  } = await import(poAutoDownloadModuleUrl)

  await withHttpServer(async (req, res) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname
    if (handleRequestLoginFixture(req, res, pathname)) return
    if (req.method === 'POST' && pathname === '/en/trade/InProgressInvoices') {
      await readRequestBody(req)
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html><body>
          <a href="/en/trade/PageResolver?pageResolverType=InvoicePageResolver&destination=CommercialInvoice&originType=Shipment&originKey=1">INV-REDIRECT-1</a>
        </body></html>
      `)
      return
    }
    if (req.method === 'GET' && pathname === '/en/trade/PageResolver') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<iframe src="/dyncon/?renderType=PDF&type=CommercialInvoice&topicName=ADIDAS_FINANCIAL_INVOICE_PDF"></iframe>')
      return
    }
    if (req.method === 'GET' && pathname === '/dyncon/') {
      res.writeHead(302, { Location: '/pdf/INV-REDIRECT-1.pdf' })
      res.end('')
      return
    }
    if (req.method === 'GET' && pathname === '/pdf/INV-REDIRECT-1.pdf') {
      res.writeHead(200, { 'Content-Type': 'application/pdf' })
      res.end(Buffer.from('%PDF-1.4\n% redirected pdf\n'))
      return
    }
    res.writeHead(404)
    res.end('not found')
  }, async (baseUrl) => {
    const result = await runSingleInvoiceAutomation({
      baseUrl,
      invoiceNumber: 'INV-REDIRECT-1',
    })

    assert.equal(result.ok, true)
    assert.equal(result.downloadedPoCount, 1)
    assert.equal(result.poResults[0].pdfRedirectCount, 1)
  })
})

async function withHttpServer(handler, callback) {
  const server = http.createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(error instanceof Error ? error.stack : String(error))
    })
  })

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve)
    server.on('error', reject)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    await callback(baseUrl)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }
}

function handleRequestLoginFixture(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`
      <form action="/en/trade/login.jsp" method="POST">
        <input name="userid" value="">
        <input name="uPassword" value="">
        <input name="LCSRF_VAL" value="csrf-value">
      </form>
    `)
    return true
  }
  if (req.method === 'POST' && pathname === '/en/trade/login.jsp') {
    req.resume()
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Set-Cookie': [
        'userToken=user-token-value; Path=/',
        'JSESSIONID=session-cookie-value; Path=/',
        'sToken=s-token-value; Path=/',
      ],
    })
    res.end('<html><title>Infor Nexus Home</title><body>APPLICATIONS</body></html>')
    return true
  }
  if (req.method === 'GET' && pathname === '/en/trade/Homepage.jsp') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body>Home</body></html>')
    return true
  }
  if (req.method === 'GET' && pathname === '/en/trade/InvoicesView.jsp') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body>InProgressInvoicePageManager</body></html>')
    return true
  }
  return false
}

async function runSingleInvoiceAutomation(options) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'po-auto-download-test-'))
  const invoiceNumber = options.invoiceNumber || 'INV-1'
  const body = {
    fileName: 'invoice-test.xlsx',
    fileBase64: Buffer.from('fake workbook').toString('base64'),
    downloadDirectory: tmpDir,
    headless: true,
    requestConcurrency: 1,
    ...options.body,
  }
  const xlsx = {
    read: () => ({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    }),
    utils: {
      sheet_to_json: () => [
        {
          'INVOICE NUMBER': invoiceNumber,
          STATUS: 'active',
        },
      ],
    },
  }
  const activeRuns = new Map()
  const {
    createPoAutoDownloadAutomation,
  } = await import(poAutoDownloadModuleUrl)
  const automation = createPoAutoDownloadAutomation({
    artifactsDir: '',
    browserEngines: {},
    buildVisibleBrowserLaunchOptions: () => ({}),
    config: {
      browser: 'chromium',
      headless: true,
      loginUrl: options.baseUrl,
    },
    ensureLoggedIn: async () => ({}),
    log: () => {},
    normalizeUploadFileName: (payload) => payload.fileName || 'invoice-test.xlsx',
    recordCompletedRun: () => {},
    registerActiveRun: (run) => {
      const activeRun = {
        ...run,
        runId: 'test-run',
        startedAt: new Date().toISOString(),
      }
      activeRuns.set(activeRun.runId, activeRun)
      return activeRun
    },
    resolveCredentials: () => ({
      username: 'test-user',
      password: 'test-password',
    }),
    safePageTitle: async () => '',
    safePageUrl: async () => '',
    showAutomationBadge: async () => {},
    unregisterActiveRun: (runId) => activeRuns.delete(runId),
    xlsx,
  })
  const response = await automation.handleRequest(body)
  assert.equal(response.statusCode, 200)
  return response.body
}

async function readRequestBody(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
  }
  return body
}
