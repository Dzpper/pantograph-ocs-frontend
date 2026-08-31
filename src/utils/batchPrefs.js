/** 检测分析：检测组选择（默认燃弧最大组），按线路+行别分 scope 避免混用 */

const KEY = 'om_batch_prefs_v2'
const LEGACY_KEY = 'om_batch_prefs'

function scopeKey(lineId, direction) {
  return `${lineId || ''}|${direction || '上行'}`
}

export function normalizeBatchesByDate(raw) {
  const out = {}
  for (const [k, v] of Object.entries(raw || {})) {
    const tag = String(k || '').replace(/-/g, '').slice(0, 8)
    if (!tag) continue
    const ids = (Array.isArray(v) ? v : [v]).map((x) => Number(x)).filter((x) => x > 0)
    const uniq = [...new Set(ids)]
    if (uniq.length > 1) out[tag] = uniq
  }
  return out
}

export function loadBatchPrefs(lineId = '', direction = '上行') {
  try {
    const raw = localStorage.getItem(KEY)
    const all = raw ? JSON.parse(raw) : {}
    const sk = scopeKey(lineId, direction)
    let p = all[sk]
    if (!p) {
      const legacyRaw = localStorage.getItem(LEGACY_KEY)
      if (legacyRaw && lineId) {
        const legacy = JSON.parse(legacyRaw)
        p = {
          manualBatch: !!legacy.manualBatch,
          batchByDate: legacy.batchByDate && typeof legacy.batchByDate === 'object'
            ? { ...legacy.batchByDate }
            : {},
          batchesByDate: {},
        }
      }
    }
    p = p || {}
    const batchesByDate = {}
    for (const [k, v] of Object.entries(p.batchesByDate || {})) {
      const tag = String(k).replace(/-/g, '').slice(0, 8)
      const ids = (Array.isArray(v) ? v : []).map((x) => Number(x)).filter((x) => x > 0)
      if (tag && ids.length > 1) batchesByDate[tag] = [...new Set(ids)]
    }
    return {
      manualBatch: !!p.manualBatch,
      batchByDate: p.batchByDate && typeof p.batchByDate === 'object' ? { ...p.batchByDate } : {},
      batchesByDate,
    }
  } catch {
    return { manualBatch: false, batchByDate: {}, batchesByDate: {} }
  }
}

export function saveBatchPrefs(partial = {}, lineId = '', direction = '上行') {
  try {
    if (!lineId) return partial
    const raw = localStorage.getItem(KEY)
    const all = raw ? JSON.parse(raw) : {}
    const sk = scopeKey(lineId, direction)
    const cur = all[sk] || { manualBatch: false, batchByDate: {}, batchesByDate: {} }
    const next = { ...cur, ...partial }
    if (next.batchByDate && typeof next.batchByDate === 'object') {
      next.batchByDate = { ...next.batchByDate }
    }
    if (next.batchesByDate && typeof next.batchesByDate === 'object') {
      next.batchesByDate = { ...next.batchesByDate }
    }
    all[sk] = next
    localStorage.setItem(KEY, JSON.stringify(all))
    return next
  } catch {
    return partial
  }
}

/** 合并到图表 / 线路概况 API 请求体 */
export function withBatchPayload(base, manualBatch, batchByDate, batchesByDate) {
  const out = { ...base }
  out.manual_batch = !!manualBatch
  out.batch_by_date = manualBatch && batchByDate ? { ...batchByDate } : {}
  const multi = normalizeBatchesByDate(batchesByDate)
  if (Object.keys(multi).length) {
    out.batches_by_date = multi
  }
  return out
}
