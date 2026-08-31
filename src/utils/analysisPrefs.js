/** 检测分析页共享物理量等偏好，与线路/日期正交 */

const KEY = 'om_analysis_prefs'

const DEFAULT_METRIC = '导高 (mm)'

export function loadAnalysisPrefs() {
  try {
    const raw = localStorage.getItem(KEY)
    const p = raw ? JSON.parse(raw) : {}
    return {
      metric: p.metric || DEFAULT_METRIC,
      upper: p.upper != null ? Number(p.upper) : 4200,
      lower: p.lower != null ? Number(p.lower) : 4000,
    }
  } catch {
    return { metric: DEFAULT_METRIC, upper: 4200, lower: 4000 }
  }
}

export function saveAnalysisPrefs(partial = {}) {
  try {
    const cur = loadAnalysisPrefs()
    const next = { ...cur, ...partial }
    localStorage.setItem(KEY, JSON.stringify(next))
    return next
  } catch {
    return partial
  }
}
