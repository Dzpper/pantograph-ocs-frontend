/** 碳滑板模块共享筛选（线路 / 日期 / 限厚线），避免看板与预测反复重选 */

const KEY = 'om_strip_prefs'
const MIN_THICKNESS_MM = 5
const MAX_THICKNESS_MM = 20

function pad(n) {
  return String(n).padStart(2, '0')
}

function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 默认近半年 */
export function defaultStripDateRange() {
  const to = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - 6)
  return [fmtDate(from), fmtDate(to)]
}

/** 限厚线不得低于 5 mm（键盘输入也会被钳制） */
export function clampMinThickness(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return MIN_THICKNESS_MM
  return Math.min(MAX_THICKNESS_MM, Math.max(MIN_THICKNESS_MM, n))
}

export function loadStripPrefs() {
  try {
    const raw = localStorage.getItem(KEY)
    const p = raw ? JSON.parse(raw) : {}
    const dateRange =
      Array.isArray(p.dateRange) && p.dateRange.length === 2
        ? p.dateRange
        : defaultStripDateRange()
    return {
      lineCode: p.lineCode || '',
      dateRange,
      minThickness: clampMinThickness(p.minThickness != null ? p.minThickness : MIN_THICKNESS_MM),
    }
  } catch {
    return {
      lineCode: '',
      dateRange: defaultStripDateRange(),
      minThickness: MIN_THICKNESS_MM,
    }
  }
}

export function saveStripPrefs(partial = {}) {
  try {
    const cur = loadStripPrefs()
    const next = { ...cur, ...partial }
    if (next.minThickness != null) next.minThickness = clampMinThickness(next.minThickness)
    localStorage.setItem(KEY, JSON.stringify(next))
    return next
  } catch {
    return partial
  }
}
