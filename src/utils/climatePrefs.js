/** 温湿度模块共享筛选 */

const KEY = 'om_climate_prefs'

function pad(n) {
  return String(n).padStart(2, '0')
}

function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function defaultClimateDateRange() {
  const to = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - 6)
  return [fmtDate(from), fmtDate(to)]
}

export function loadClimatePrefs() {
  try {
    const raw = localStorage.getItem(KEY)
    const p = raw ? JSON.parse(raw) : {}
    const dateRange =
      Array.isArray(p.dateRange) && p.dateRange.length === 2
        ? p.dateRange
        : defaultClimateDateRange()
    return {
      lineCode: p.lineCode || '',
      dateRange,
    }
  } catch {
    return { lineCode: '', dateRange: defaultClimateDateRange() }
  }
}

export function saveClimatePrefs(partial = {}) {
  try {
    const cur = loadClimatePrefs()
    const next = { ...cur, ...partial }
    localStorage.setItem(KEY, JSON.stringify(next))
    return next
  } catch {
    return partial
  }
}
