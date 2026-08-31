/** 从 API 响应生成业主可读的「一句话结论」 */

function fmt(v, digits = 2) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toFixed(digits)
}

function fmtDate(d) {
  if (!d) return '—'
  const s = String(d).replace(/-/g, '')
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return d
}

const HIGHER_IS_WORSE = ['燃弧时间 (ms)', '拉出值 (mm)', '最高温度 (℃)']

function isWorseWhenUp(metric) {
  return HIGHER_IS_WORSE.some((m) => metric.includes(m) || m.includes(metric))
}

export function buildComparisonConclusion(data, metric) {
  const series = data?.series || []
  if (!series.length) {
    return { tone: 'info', title: '分析结论', text: '暂无对比数据，请在左侧选择检测期次。' }
  }
  if (series.length === 1) {
    const s = series[0]
    return {
      tone: 'info',
      title: '分析结论',
      text: `${s.label}：${metric} 均值 ${fmt(s.stats?.mean)}。请再勾选一组数据评估变化趋势。`,
    }
  }
  const newest = series[0]
  const oldest = series[series.length - 1]
  const mNew = newest.stats?.mean
  const mOld = oldest.stats?.mean
  if (mNew == null || mOld == null) {
    return { tone: 'info', title: '分析结论', text: '有效数据不足，无法评估历史变化。' }
  }
  const diff = mNew - mOld
  const pct = mOld !== 0 ? (diff / Math.abs(mOld)) * 100 : 0
  const rising = diff > 0
  const significant = Math.abs(pct) >= 8
  const worse = (rising && isWorseWhenUp(metric)) || (!rising && !isWorseWhenUp(metric) && metric.includes('压力'))
  let tone = 'success'
  if (significant && worse) tone = 'warning'
  else if (significant) tone = 'info'
  const dir = rising ? '上升' : '下降'
  const advice = significant && worse
    ? '变化较明显，建议优先安排现场复核。'
    : significant
      ? '存在一定波动，建议暂时记录相关杆号，定期观察。'
      : '整体波动较小，无需现场检查。'
  return {
    tone,
    title: '对比结论',
    text: `较 ${oldest.label}，${newest.label} 的 ${metric} 均值${dir} ${Math.abs(pct).toFixed(1)}%（${fmt(mOld)} → ${fmt(mNew)}）。${advice}`,
  }
}

export function buildArcConclusion(data) {
  const series = data?.series || []
  const summaries = data?.summaries || []
  if (!series.length) {
    return { tone: 'info', title: '燃弧结论', text: '暂无燃弧数据，请选择检测期次。' }
  }
  let maxPt = null
  for (const s of series) {
    for (const p of s.points || []) {
      const v = p.intensity ?? p.i2t ?? 0
      if (!maxPt || v > (maxPt.intensity ?? maxPt.i2t ?? 0)) {
        maxPt = { ...p, period: s.label, intensity: v }
      }
    }
  }
  const totalCount = summaries.reduce((a, s) => a + (s.exceed_count || s.count || 0), 0)
  const maxSummary = summaries.reduce(
    (best, s) => {
      const mv = s.max_intensity ?? s.max_i2t ?? 0
      const bv = best?.max_intensity ?? best?.max_i2t ?? 0
      return mv > bv ? s : best
    },
    summaries[0],
  )
  const thr = data?.threshold_a2s
  const parts = [
    thr != null ? `按阈值 ${fmt(thr, 1)} A²·s 筛选` : null,
    `共检出超限点 ${totalCount} 处`,
  ].filter(Boolean)
  const maxVal = maxSummary?.max_intensity ?? maxSummary?.max_i2t
  if (maxVal != null) {
    parts.push(`最高燃弧强度出现在 ${maxSummary.label || '某期'}（${fmt(maxVal, 3)} A²·s）`)
  }
  if (maxPt?.station_area_name) {
    parts.push(`最严重位置：${maxPt.station_area_name}（杆号 ${maxPt.pole_no || '—'}，${fmtDate(maxPt.period)}）`)
  }
  const tone = totalCount > 50 ? 'warning' : totalCount > 0 ? 'info' : 'success'
  return {
    tone,
    title: '燃弧结论',
    text: `${parts.join('；')}。建议对高燃弧强度区段优先安排接触网现场巡视、问题排查。`,
  }
}

export function buildWarningConclusion(data, metric, upper, lower) {
  const series = data?.series || []
  if (!series.length) {
    return { tone: 'info', title: '预警结论', text: '暂无超限数据。' }
  }
  const worst = series.reduce(
    (a, s) => ((s.violations ?? 0) > (a.violations ?? 0) ? s : a),
    series[0],
  )
  const total = series.reduce((a, s) => a + (s.violations ?? 0), 0)
  const tone = total > 0 ? (worst.violations > 10 ? 'warning' : 'info') : 'success'
  const threshold = `阈值 ${lower ?? '—'} ~ ${upper ?? '—'}`
  return {
    tone,
    title: '超限结论',
    text: total > 0
      ? `${metric}（${threshold}）共检出超限 ${total} 处；最多为 ${worst.label}（${worst.violations} 处，最大 ${fmt(worst.max)}）。`
      : `${metric} 在所选期次内均未超出设定阈值。`,
  }
}

export function buildSpeedArcConclusion(segment, metrics) {
  if (!segment) {
    return { tone: 'info', title: '速度-燃弧结论', text: '请选择检测期次并加载区间数据。' }
  }
  const label = segment.label || segment.name || '当前区间'
  const worst = (metrics || []).reduce(
    (a, m) => ((m.count ?? 0) > (a.count ?? 0) ? m : a),
    metrics[0] || {},
  )
  const totalArc = (metrics || []).reduce((a, m) => a + (m.count || 0), 0)
  const tone = totalArc > 20 ? 'warning' : 'info'
  return {
    tone,
    title: '速度-燃弧结论',
    text: `区间「${label}」燃弧点合计 ${totalArc} 处${worst.label ? `；${worst.label} 燃弧最集中（${worst.count || 0} 处）` : ''}。低速区段燃弧高发时应重点检查接触压力与拉出值。`,
  }
}

export function buildOverviewConclusion(dashData, events) {
  if (!dashData) {
    return { tone: 'info', title: '运营概览', text: '请选择线路与检测日期以查看线路健康状态。' }
  }
  const worst = dashData.worst || []
  const abnormal = (dashData.segments || []).filter((s) => s.grade === '差' || s.grade === '中').length
  const lvl1 = (events || []).filter((e) => e.level === 2).length
  let tone = 'success'
  if (dashData.overall_score < 70 || abnormal > 2) tone = 'warning'
  else if (abnormal > 0 || lvl1 > 0) tone = 'info'
  const worstNames = worst.slice(0, 2).map((w) => w.name).join('、')
  const parts = [
    `本期总体健康分 ${dashData.overall_score ?? '—'}（${dashData.overall_grade || '—'}）`,
    abnormal > 0 ? `异常区段 ${abnormal} 个` : '各区段状态良好',
  ]
  if (worstNames) parts.push(`优先关注：${worstNames}`)
  if (lvl1 > 0) parts.push(`检出一级异常 ${lvl1} 条`)
  return {
    tone,
    title: '运营概览',
    text: `${parts.join('；')}。点击示意图区段可查看详细分析。`,
  }
}

export function buildAlarmConclusion(summary, stationCompare, trend) {
  const total = summary?.total ?? 0
  const level1 = summary?.level1 ?? 0
  if (!total) {
    return { tone: 'success', title: '报警结论', text: '所选时间范围内未检出超阈值异常点。' }
  }
  const topStation = (stationCompare || []).reduce(
    (a, s) => ((s.level1 + s.level2) > ((a?.level1 || 0) + (a?.level2 || 0)) ? s : a),
    stationCompare[0],
  )
  const items = trend || []
  let trendText = ''
  if (items.length >= 2) {
    const last = items[items.length - 1]?.total ?? 0
    const prev = items[items.length - 2]?.total ?? 0
    if (last > prev) trendText = `最近一期报警较上期增加 ${last - prev} 条；`
    else if (last < prev) trendText = `最近一期报警较上期减少 ${prev - last} 条；`
  }
  const tone = level1 > 5 ? 'warning' : 'info'
  return {
    tone,
    title: '报警结论',
    text: `${trendText}共检出分析报警 ${total} 条（一级 ${level1} 条）${topStation?.station ? `；报警最多站区：${topStation.station}` : ''}。以下为基于检测阈值的派生统计，非工单闭环真值。`,
  }
}

export function buildHealthDashboardConclusion(data, prevScore) {
  if (!data) {
    return { tone: 'info', title: '健康分析结论', text: '请选择线路以查看设备健康。' }
  }
  const score = data.overall_score
  const grade = data.overall_grade
  const segs = data.segments || []
  const worst = data.worst || []
  const chronic = data.chronic_segments || []
  const abnormal = segs.filter((s) => s.grade === '差' || s.grade === '中').length
  const contrib = data.factor_contrib || []
  const topFactor = contrib.find((c) => c.deduct > 0)
  const effectivePrev = prevScore ?? data.prev_score

  let tone = 'success'
  if (score != null && score < 60) tone = 'danger'
  else if (score != null && score < 70) tone = 'warning'
  else if (abnormal > 0 || chronic.length) tone = 'info'

  const parts = [`当期（${fmtDate(data.date)}）健康分 ${score ?? '—'}（${grade}）`]
  if (effectivePrev != null && score != null) {
    const d = score - effectivePrev
    if (d > 0.5) parts.push(`较上期上升 ${d.toFixed(2)} 分`)
    else if (d < -0.5) parts.push(`较上期下降 ${Math.abs(d).toFixed(2)} 分`)
  }
  parts.push(`${segs.length} 个区段中当期异常 ${abnormal} 个`)
  if (topFactor) parts.push(`主要扣分因子：${topFactor.factor}`)
  if (chronic.length) parts.push(`全库扫描发现复发/恶化区段 ${chronic.length} 个`)
  if (worst.length) parts.push(`当期最差：${worst[0].name}（${worst[0].score} 分）`)
  return {
    tone,
    title: '健康分析结论',
    text: `${parts.join('；')}。建议优先处理本期 P0/P1 及历史复发项。`,
  }
}

export function buildPredictConclusion(data, metric) {
  const segs = data?.segments || []
  if (!segs.length) {
    return { tone: 'info', title: '预测结论', text: data?.hint || '需至少 2 个检测日期才能做趋势预测，请在左侧选择多期。' }
  }
  const overdue = segs.filter((s) => s.status === '已超限')
  const high = segs.filter((s) => s.status === '高风险')
  const mid = segs.filter((s) => s.status === '中风险')
  const urgent = segs.filter((s) => s.rul_days != null && s.rul_days <= 30)
  let tone = 'success'
  if (overdue.length || high.length) tone = 'danger'
  else if (mid.length || urgent.length) tone = 'warning'
  const parts = []
  if (overdue.length) parts.push(`已超限区段 ${overdue.length} 个`)
  if (high.length) parts.push(`高风险区段 ${high.length} 个（30 天内可能超限）`)
  if (mid.length) parts.push(`中风险 ${mid.length} 个`)
  if (urgent.length) parts.push(`30 天内可能超限 ${urgent.length} 个`)
  if (!parts.length) parts.push(`各区段 ${metric} 趋势正常，暂无短期超限风险`)
  const worst = segs[0]
  if (worst?.rul_days != null && worst.rul_days > 0) {
    parts.push(`最近可能超限：${worst.name}（约 ${worst.rul_days} 天）`)
  }
  return {
    tone,
    title: '预测结论',
    text: `${parts.join('；')}。预测基于多期线性回归，置信度随检测期次增加而提高，建议结合现场复核。`,
  }
}
