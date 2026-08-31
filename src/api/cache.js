const cache = new Map()
const TTL_MS = 5 * 60 * 1000

function stableKey(url, payload) {
  return `${url}:${JSON.stringify(payload)}`
}

export function getCached(key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.time > TTL_MS) {
    cache.delete(key)
    return null
  }
  return hit.data
}

export function setCached(key, data) {
  cache.delete(key)
  if (cache.size > 40) {
    const first = cache.keys().next().value
    cache.delete(first)
  }
  cache.set(key, { time: Date.now(), data })
}

export function cacheKey(url, payload) {
  return stableKey(url, payload)
}

export function clearApiCache() {
  cache.clear()
}

export async function cachedPost(client, url, payload, { force = false } = {}) {
  const key = stableKey(url, payload)
  if (!force) {
    const hit = getCached(key)
    if (hit) return hit
  }
  const res = await client.post(url, payload)
  setCached(key, res.data)
  return res.data
}
