/** ECharts 公共配置：横轴、提示框、布局 */

export function formatKm(km) {
  if (km == null || km === '') return '—'
  const n = Number(km)
  return Number.isFinite(n) ? n.toFixed(3) : String(km)
}

/** 燃弧强度展示：千分位整数 + 单位，避免「20万 / 5k」业余感 */
export function formatIntensityA2s(value, { withUnit = true } = {}) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const txt = Math.round(n).toLocaleString('zh-CN')
  return withUnit ? `${txt} A²·s` : txt
}

/** 坐标轴用：仅数字千分位 */
export function formatAxisIntensity(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return Math.round(n).toLocaleString('zh-CN')
}

/** 科学计数法：写作 1.20×10⁴ 形式（燃弧强度等） */
export function formatSci(value, digits = 2) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 10000 || abs < 0.01) {
    const exp = Math.floor(Math.log10(abs))
    const mant = n / 10 ** exp
    const supers = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }
    const expStr = String(exp).split('').map((c) => supers[c] ?? c).join('')
    return `${mant.toFixed(digits)}×10${expStr}`
  }
  if (abs >= 100) return n.toFixed(1)
  if (abs >= 1) return n.toFixed(Math.min(digits, 2))
  return n.toFixed(Math.max(digits, 2))
}

export function buildPointTooltip(unit = '') {
  return (params) => {
    const d = params.data
    if (!d || typeof d !== 'object') {
      const val = Array.isArray(params.value) ? params.value[1] : params.value
      return `${params.seriesName}<br/>${params.name || ''}: ${val ?? '—'}`
    }
    const station = d.station_area_name || d.station || '—'
    const pole = d.pole_no || d.pole || '—'
    const km = formatKm(d.kilometer_mark ?? d.km)
    const lines = [`<b>${params.seriesName}</b>`, `站区：${station}`, `杆号：${pole}`, `公里标：${km}`]
    if (d.i2t != null || d.intensity != null) lines.push(`燃弧强度：${formatSci(d.intensity ?? d.i2t)} A²·s`)
    if (d.arc_time_ms != null) lines.push(`燃弧时间：${Number(d.arc_time_ms).toFixed(3)} ms`)
    if (d.speed != null) lines.push(`速度：${Number(d.speed).toFixed(2)} km/h`)
    if (d.current_a != null) lines.push(`电流：${Number(d.current_a).toFixed(1)} A`)
    return lines.join('<br/>')
  }
}

export function buildAxisTooltip(xAxis, seriesList) {
  return (params) => {
    if (!Array.isArray(params) || !params.length) return ''
    const idx = params[0].dataIndex
    const station = xAxis?.stations?.[idx] || '—'
    const pole = xAxis?.poles?.[idx] || '—'
    const km = formatKm(xAxis?.kilometers?.[idx])
    let html = [`站区：${station}`, `杆号：${pole}`, `公里标：${km}`, '---']
    params.forEach((p) => {
      if (p.value == null || (typeof p.value === 'number' && Number.isNaN(p.value))) return
      const val = Array.isArray(p.value) ? p.value[1] : p.value
      html.push(`${p.marker}${p.seriesName}: ${Number(val).toFixed(3)}`)
    })
    return html.join('<br/>')
  }
}

/** 图例默认放底部（缩放条上方），避免遮挡 Y 轴名称与刻度 */
export function baseGrid(isDark, { legendBottom = true, hasDataZoom = true } = {}) {
  return {
    left: 56,
    right: 56,
    top: 36,
    bottom: legendBottom ? (hasDataZoom ? 96 : 72) : (hasDataZoom ? 72 : 48),
    containLabel: true,
  }
}

export function baseDataZoom() {
  return [
    {
      type: 'inside',
      xAxisIndex: 0,
      filterMode: 'none',
      zoomOnMouseWheel: true,
      moveOnMouseMove: true,
      moveOnMouseWheel: false,
    },
    {
      type: 'slider',
      xAxisIndex: 0,
      height: 18,
      bottom: 8,
      filterMode: 'none',
      brushSelect: false,
    },
  ]
}

export function layoutForChart(isDark, {
  legendTop = false,
  hasDataZoom = true,
  hasRotatedLabels = true,
} = {}) {
  const legendBottom = !legendTop
  const bottom = hasDataZoom
    ? (legendBottom ? (hasRotatedLabels ? 108 : 96) : (hasRotatedLabels ? 88 : 72))
    : (legendBottom ? (hasRotatedLabels ? 84 : 72) : (hasRotatedLabels ? 64 : 48))
  return {
    grid: {
      left: 56,
      right: 56,
      top: legendTop ? 52 : 32,
      bottom,
      containLabel: true,
    },
    legend: {
      type: 'scroll',
      ...(legendTop
        ? { top: 4, left: 'center', width: '90%' }
        : { bottom: hasDataZoom ? 30 : 8, left: 'center', width: '92%' }),
      itemGap: 14,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: chartMutedColor(isDark), fontSize: 11 },
      pageIconSize: 10,
      pageTextStyle: { color: chartMutedColor(isDark), fontSize: 10 },
    },
    dataZoom: hasDataZoom ? baseDataZoom() : [],
  }
}

/** 图例默认底部滚动，避免压住左侧 Y 轴 */
export function baseLegend(isDark, extra = {}) {
  return {
    type: 'scroll',
    bottom: 30,
    left: 'center',
    width: '92%',
    itemGap: 14,
    itemWidth: 14,
    itemHeight: 8,
    textStyle: { color: chartMutedColor(isDark), fontSize: 11 },
    pageIconSize: 10,
    pageTextStyle: { color: chartMutedColor(isDark), fontSize: 10 },
    ...extra,
  }
}

function thinTickPositions(tickPositions, tickLabels, maxTicks = 10) {
  const pos = tickPositions || []
  const labels = tickLabels || []
  if (pos.length <= maxTicks) return { tickPositions: pos, tickLabels: labels }
  const step = Math.max(Math.ceil(pos.length / maxTicks), 1)
  const nextPos = []
  const nextLabels = []
  for (let i = 0; i < pos.length; i += step) {
    nextPos.push(pos[i])
    nextLabels.push(labels[i] ?? '')
  }
  const last = pos.length - 1
  if (nextPos[nextPos.length - 1] !== pos[last]) {
    nextPos.push(pos[last])
    nextLabels.push(labels[last] ?? '')
  }
  return { tickPositions: nextPos, tickLabels: nextLabels }
}

/** 沿杆号序列的横轴：底部稀疏站区名，支持缩放后仍可读 */
export function buildCategoryXAxis(xAxis, isDark) {
  const n = xAxis?.poles?.length || 0
  const thinned = thinTickPositions(xAxis?.tick_positions || [], xAxis?.tick_labels || [], 10)
  const tickPositions = thinned.tickPositions
  const tickLabels = thinned.tickLabels
  const muted = chartMutedColor(isDark)
  const lineColor = isDark ? 'rgba(61, 191, 173, 0.28)' : 'rgba(52, 136, 217, 0.25)'
  const tickSet = new Set(tickPositions)

  return {
    type: 'category',
    data: Array.from({ length: n }, (_, i) => i),
    boundaryGap: false,
    position: 'bottom',
    name: '',
    axisLabel: {
      show: true,
      color: muted,
      fontSize: 11,
      hideOverlap: true,
      interval: (index) => tickSet.has(index),
      formatter: (_val, index) => {
        const posIdx = tickPositions.indexOf(index)
        if (posIdx < 0) return ''
        const name = String(tickLabels[posIdx] ?? '')
        return name.length > 8 ? `${name.slice(0, 7)}…` : name
      },
      rotate: 0,
      margin: 10,
    },
    axisTick: { show: false },
    axisLine: { lineStyle: { color: lineColor } },
    splitLine: { show: false },
  }
}

/** 速度-燃弧等区间图的横轴（与 buildCategoryXAxis 一致） */
export function buildSegmentXAxis(xAxis, isDark) {
  return buildCategoryXAxis(xAxis, isDark)
}

/**
 * 站区分界虚线默认关闭（全线站区多时会淹没曲线）。
 * 需要时可传 { enabled: true }；若 series 已有 markLine（如阈值），会合并而非覆盖。
 */
export function applyStationMarkLines(option, boundaries = [], isDark = false, opts = {}) {
  const enabled = opts.enabled === true
  if (!enabled || !boundaries?.length || !option.series?.length) return option

  const stationLines = boundaries.map((x) => ({
    xAxis: x,
    lineStyle: {
      type: 'dotted',
      color: isDark ? 'rgba(61, 191, 173, 0.18)' : 'rgba(148, 163, 184, 0.35)',
      width: 1,
    },
    label: { show: false },
  }))

  const first = option.series[0] || {}
  const prev = first.markLine
  const mergedData = [...(prev?.data || []), ...stationLines]
  option.series[0] = {
    ...first,
    markLine: {
      silent: true,
      symbol: 'none',
      label: { show: false },
      ...(prev || {}),
      data: mergedData,
    },
  }
  return option
}

export function chartTooltipStyle(isDark) {
  return {
    backgroundColor: isDark ? 'rgba(18, 30, 50, 0.96)' : 'rgba(245, 250, 252, 0.98)',
    borderColor: isDark ? 'rgba(61, 191, 173, 0.35)' : 'rgba(52, 136, 217, 0.25)',
    textStyle: { color: isDark ? '#e8f2f8' : '#1a3344' },
  }
}

export function chartBgColor(isDark) {
  return isDark ? '#121e32' : '#f5fafc'
}

export function chartTextColor(isDark) {
  return isDark ? '#e8f2f8' : '#1a3344'
}

export function chartMutedColor(isDark) {
  return isDark ? '#8fa8bc' : '#4a6272'
}

/** 统一 Y 轴：名称与刻度不被图例遮挡 */
export function baseValueYAxis(isDark, name = '') {
  return {
    type: 'value',
    name,
    scale: true,
    nameGap: 12,
    nameTextStyle: { color: chartMutedColor(isDark), fontSize: 12, padding: [0, 0, 0, 0] },
    axisLabel: { color: chartMutedColor(isDark), fontSize: 11 },
    splitLine: {
      show: true,
      lineStyle: { color: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.25)', type: 'solid', width: 1 },
    },
  }
}
