const STATIC_ALLOWED_EXTERNAL_URLS = [
  {
    host: 'network.infornexus.com',
    pathPrefix: '/',
    protocol: 'https:',
  },
  {
    host: 'ai.tomwell.net:56130',
    pathPrefix: '/tos/',
    protocol: 'https:',
  },
  {
    host: '172.16.8.13',
    pathPrefix: '/tos/',
    protocol: 'http:',
  },
]

function parseUrl(value) {
  if (typeof value !== 'string') return null

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch (_error) {
    return null
  }
}

function pathStartsWith(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)
}

function isStaticAllowedUrl(url) {
  return STATIC_ALLOWED_EXTERNAL_URLS.some((rule) => (
    url.protocol === rule.protocol && url.host === rule.host && pathStartsWith(url.pathname, rule.pathPrefix)
  ))
}

function isUpdateFeedUrl(url, updateFeedUrl) {
  const feedUrl = parseUrl(updateFeedUrl)
  if (!feedUrl) return false
  if (feedUrl.protocol !== 'https:' || url.protocol !== 'https:') return false
  if (url.origin !== feedUrl.origin) return false

  return pathStartsWith(url.pathname, feedUrl.pathname)
}

function normalizeAllowedExternalUrl(value, options = {}) {
  const url = parseUrl(value)
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
