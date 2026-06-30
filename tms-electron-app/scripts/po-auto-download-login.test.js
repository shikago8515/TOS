const assert = require('assert')
const http = require('http')
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

async function readRequestBody(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
  }
  return body
}
