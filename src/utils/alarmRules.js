/** 超限统计筛选阈值：系统默认与按线路本地覆盖
 * 默认数字以后端 HEALTH_FACTOR_THRESHOLDS（GET /lines.health_thresholds）为准，
 * 与杆号评估基准带同一套。FALLBACK 仅接口未返回前占位。
 */

const KEY = 'om_alarm_thresholds_by_line'
const OVERRIDE_KEYS = ['lower', 'upper', 'warn_lower', 'warn_upper', 'min_alarm']

const FALLBACK_ALARM_RULES = [
  { type: '压力', unit: 'N', kind: 'band', lower: 70, upper: 140, warn_lower: 90, warn_upper: 120 },
  { type: '拉出值', unit: 'mm', kind: 'band', lower: -300, upper: 300, warn_lower: -250, warn_upper: 250 },
  { type: '燃弧', unit: 'ms', kind: 'upper', upper: 50, warn_upper: 25, min_alarm: 5 },
  { type: '温度', unit: '℃', kind: 'upper', upper: 120, warn_upper: 80 },
  { type: '导高', unit: 'mm', kind: 'band', lower: 4000, upper: 4200, warn_lower: 4050, warn_upper: 4150 },
  { type: '硬点', unit: 'g', kind: 'abs_upper', upper: 10, warn_upper: 5, abs_value: true },
]

let catalogRules = null
const catalogListeners = new Set()

export function setAlarmRuleCatalog(rules) {
  if (!Array.isArray(rules) || !rules.length) return
  catalogRules = rules.map((r) => ({
    type: r.type,
    field: r.field,
    unit: r.unit || '',
    kind: r.kind || (r.abs_value ? 'abs_upper' : (r.lower != null && r.upper != null ? 'band' : 'upper')),
    abs_value: !!r.abs_value,
    lower: r.lower,
    upper: r.upper,
    warn_lower: r.warn_lower,
    warn_upper: r.warn_upper,
    min_alarm: r.min_alarm,
  }))
  catalogListeners.forEach((fn) => fn())
}

export function onAlarmRuleCatalog(fn) {
  catalogListeners.add(fn)
  if (catalogRules) fn()
  return () => catalogListeners.delete(fn)
}

export const DEFAULT_ALARM_RULES = FALLBACK_ALARM_RULES

export function cloneAlarmRules(rules) {
  return (rules || defaultAlarmRules()).map((r) => ({ ...r }))
}

export function defaultAlarmRules() {
  return cloneAlarmRules(catalogRules || FALLBACK_ALARM_RULES)
}

export function compactThresholds(rules) {
  const out = {}
  for (const r of rules || []) {
    const slot = {}
    for (const k of OVERRIDE_KEYS) {
      if (r[k] != null && r[k] !== '') {
        const n = Number(r[k])
        if (Number.isFinite(n)) slot[k] = n
      }
    }
    if (Object.keys(slot).length) out[r.type] = slot
  }
  return out
}

export function withLineThresholds(payload, lineId) {
  const out = { ...(payload || {}) }
  const compact = compactThresholds(loadAlarmRules(lineId))
  if (Object.keys(compact).length) out.thresholds = compact
  return out
}

export function isDefaultAlarmRules(rules) {
  return JSON.stringify(compactThresholds(rules)) === JSON.stringify(compactThresholds(defaultAlarmRules()))
}

export function loadAlarmRules(lineId) {
  const defaults = defaultAlarmRules()
  if (!lineId) return defaults
  try {
    const raw = localStorage.getItem(KEY)
    const byLine = raw ? JSON.parse(raw) : {}
    const saved = byLine?.[lineId]
    if (!saved || typeof saved !== 'object') return defaults
    return defaults.map((r) => {
      const ov = saved[r.type]
      if (!ov || typeof ov !== 'object') return r
      const next = { ...r }
      for (const k of OVERRIDE_KEYS) {
        if (ov[k] != null && ov[k] !== '') {
          const n = Number(ov[k])
          if (Number.isFinite(n)) next[k] = n
        }
      }
      return next
    })
  } catch {
    return defaults
  }
}

export function saveAlarmRules(lineId, rules) {
  if (!lineId) return
  try {
    const raw = localStorage.getItem(KEY)
    const byLine = raw ? JSON.parse(raw) : {}
    if (isDefaultAlarmRules(rules)) delete byLine[lineId]
    else byLine[lineId] = compactThresholds(rules)
    localStorage.setItem(KEY, JSON.stringify(byLine))
  } catch {
    /* ignore quota / private mode */
  }
}

export function ruleByType(rules, type) {
  return (rules || []).find((r) => r.type === type) || null
}

const METRIC_TYPE_ALIASES = [
  ['硬点加速度', '硬点'],
  ['硬点', '硬点'],
  ['振动', '硬点'],
  ['燃弧', '燃弧'],
  ['导高', '导高'],
  ['拉出', '拉出值'],
  ['温度', '温度'],
  ['接触压力', '压力'],
  ['压力', '压力'],
]

export function typeForMetric(metric) {
  const m = String(metric || '')
  for (const [hint, type] of METRIC_TYPE_ALIASES) {
    if (m.includes(hint)) return type
  }
  return null
}

/** 超限预警包络：双边指标给 lower/upper，单边上限定只给 upper。 */
export function envelopeForMetric(metric, lineId) {
  const type = typeForMetric(metric)
  const rule = type ? ruleByType(loadAlarmRules(lineId), type) : null
  if (!rule) return { lower: null, upper: null }
  const upper = rule.upper != null && Number.isFinite(Number(rule.upper)) ? Number(rule.upper) : null
  const lower = rule.lower != null && Number.isFinite(Number(rule.lower)) ? Number(rule.lower) : null
  return { lower, upper }
}
