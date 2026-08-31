/** 界面展示用线路名：不向用户暴露 ZZ_LINE_4 等内部编码 */

const ABBR_CITY = {
  ZZ: '郑州',
  WLMQ: '乌鲁木齐',
  NB: '宁波',
  HZ: '杭州',
  CD: '成都',
  XA: '西安',
  WH: '武汉',
  NJ: '南京',
  SH: '上海',
  BJ: '北京',
  GZ: '广州',
  SZ: '深圳',
  CQ: '重庆',
  TJ: '天津',
  SZU: '苏州',
  WX: '无锡',
  CS: '长沙',
  HF: '合肥',
  FZ: '福州',
  XM: '厦门',
  QD: '青岛',
  DL: '大连',
  SY: '沈阳',
  HRB: '哈尔滨',
  KM: '昆明',
  GY: '贵阳',
  LZ: '兰州',
  NC: '南昌',
  SJZ: '石家庄',
  TY: '太原',
  JN: '济南',
  NN: '南宁',
}

const CODE_RE = /^([A-Z][A-Z0-9]*)_(LINE|STRIP)_(\d+)$/i
const LEGACY_STRIP_RE = /^([A-Z]+)_STRIP(\d+)$/i

export function pickLineCode(row) {
  if (!row) return ''
  if (typeof row === 'string') return row
  return row.code || row.line_code || row.line_id || row.monitor_code || ''
}

export function looksLikeInternalCode(value) {
  if (!value || typeof value !== 'string') return false
  const s = value.trim()
  return CODE_RE.test(s) || LEGACY_STRIP_RE.test(s)
}

export function inferLineNameFromCode(code) {
  if (!code) return '未命名线路'
  const s = String(code).trim()
  let m = s.match(CODE_RE)
  if (m) {
    const city = ABBR_CITY[m[1].toUpperCase()] || ''
    const num = m[3]
    return city ? `${city}地铁${num}号线` : `${num}号线`
  }
  m = s.match(LEGACY_STRIP_RE)
  if (m) {
    const city = ABBR_CITY[m[1].toUpperCase()] || ''
    const num = m[2]
    return city ? `${city}地铁${num}号线` : `${num}号线`
  }
  return '未命名线路'
}

export function pickLineName(row, codeOverride) {
  const code = codeOverride || pickLineCode(row)
  const candidates = []
  if (row && typeof row === 'object') {
    candidates.push(row.line_name, row.name, row.label)
  }
  for (const c of candidates) {
    const v = (c || '').trim()
    if (!v) continue
    if (v === code) continue
    if (looksLikeInternalCode(v)) continue
    return v
  }
  return inferLineNameFromCode(code)
}

/** API 返回的 name 可能是内部编码，统一转为可读名称 */
export function formatLineName(name, code) {
  const c = code || pickLineCode(typeof name === 'object' ? name : null) || ''
  const n = typeof name === 'string' ? name.trim() : ''
  if (n && n !== c && !looksLikeInternalCode(n)) return n
  return inferLineNameFromCode(c || n)
}

export function normalizeLineOption(row) {
  if (!row) return null
  const code = pickLineCode(row)
  const name = pickLineName(row, code)
  return {
    ...row,
    code,
    line_code: code,
    name,
    line_name: name,
    label: name,
  }
}

export function normalizeLineList(rows) {
  return (rows || []).map((r) => normalizeLineOption(r)).filter(Boolean)
}

export function resolveLineName(code, lines, fallback = '未选择') {
  if (!code) return fallback
  const list = lines || []
  const hit = list.find((l) => pickLineCode(l) === code)
  if (hit) return pickLineName(hit, code)
  return inferLineNameFromCode(code) || fallback
}

export function coerceLineCode(code, lines) {
  const list = lines || []
  if (!list.length) return code || ''
  if (code && list.some((l) => pickLineCode(l) === code)) return code
  return pickLineCode(list[0])
}
