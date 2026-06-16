const STATIC_ALLOWED_EXTERNAL_URLS = [
  {
    host: 'network.infornexus.com',
    pathPrefix: '/',
  },
  {
    host: 'ai.tomwell.net:56130',
    pathPrefix: '/tos/',
  },
]

function parseHttpsUrl(value) {
  if (typeof value !== 'string') return null

  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url : null
  } catch (_error) {
    return null
  }
}

function pathStartsWith(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)
}

function isStaticAllowedUrl(url) {
  return STATIC_ALLOWED_EXTERNAL_URLS.some((rule) => (
    url.host === rule.host && pathStartsWith(url.pathname, rule.pathPrefix)
  ))
}

function isUpdateFeedUrl(url, updateFeedUrl) {
  const feedUrl = parseHttpsUrl(updateFeedUrl)
  if (!feedUrl) return false
  if (url.origin !== feedUrl.origin) return false

  return pathStartsWith(url.pathname, feedUrl.pathname)
}

function normalizeAllowedExternalUrl(value, options = {}) {
  const url = parseHttpsUrl(value)
  if (!url) return ''

  if (isStaticAllowedUrl(url) || isUpdateFeedUrl(url, options.updateFeedUrl)) {
    return url.toString()
  }

  return ''
}

function isAllowedExternalUrl(value, options = {}) {
  return Boolean(normalizeAllowedExternalUrl(value, options))
}

module.exports = {
  isAllowedExternalUrl,
  normalizeAllowedExternalUrl,
}
