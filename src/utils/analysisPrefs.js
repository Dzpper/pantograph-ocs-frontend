/** 检测分析页共享物理量等偏好，与线路/日期正交 */

const KEY = 'om_analysis_prefs'

const DEFAULT_METRIC = '导高 (mm)'
const DEFAULT_POLE_CHARTS = ['arc', 'hard', 'height', 'stagger', 'voltage']

export function loadAnalysisPrefs() {
  try {
    const raw = localStorage.getItem(KEY)
    const p = raw ? JSON.parse(raw) : {}
    const poleCharts = Array.isArray(p.poleChartKeys) && p.poleChartKeys.length
      ? p.poleChartKeys.map(String)
      : [...DEFAULT_POLE_CHARTS]
    return {
      metric: p.metric || DEFAULT_METRIC,
      upper: p.upper != null && Number.isFinite(Number(p.upper)) ? Number(p.upper) : null,
      lower: p.lower != null && Number.isFinite(Number(p.lower)) ? Number(p.lower) : null,
      poleChartKeys: poleCharts,
    }
  } catch {
    return {
      metric: DEFAULT_METRIC,
      upper: null,
      lower: null,
      poleChartKeys: [...DEFAULT_POLE_CHARTS],
    }
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
