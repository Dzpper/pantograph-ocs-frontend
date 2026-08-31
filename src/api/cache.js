const cache = new Map()
const inflight = new Map()
const TTL_MS = 5 * 60 * 1000
const MAX_ENTRIES = 80

function stableKey(url, payload) {
  return `${url}:${JSON.stringify(payload ?? null)}`
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
  while (cache.size >= MAX_ENTRIES) {
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
  inflight.clear()
}

async function runCached(key, force, fetcher) {
  if (!force) {
    const hit = getCached(key)
    if (hit != null) return hit
    const pending = inflight.get(key)
    if (pending) return pending
  }
  const task = (async () => {
    try {
      const data = await fetcher()
      setCached(key, data)
      return data
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, task)
  return task
}

export async function cachedPost(client, url, payload, { force = false } = {}) {
  const key = stableKey(url, payload)
  return runCached(key, force, async () => {
    const res = await client.post(url, payload)
    return res.data
  })
}

/** GET 缓存（/dates、/day-batches 等） */
export async function cachedGet(client, url, params = {}, { force = false } = {}) {
  const key = stableKey(url, params)
  return runCached(key, force, async () => {
    const res = await client.get(url, { params })
    return res.data
  })
}
