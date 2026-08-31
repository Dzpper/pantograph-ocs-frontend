/** 因子 → 分析页 / 指标映射，供点击下钻使用 */
export const FACTOR_TO_METRIC = {
  燃弧: '燃弧时间 (ms)',
  拉出值: '拉出值 (mm)',
  导高: '导高 (mm)',
  压力: '接触压力',
  温度: '最高温度 (℃)',
}

export const FACTOR_ROUTE = {
  燃弧: { center: 'analysis', page: 'arc' },
  拉出值: { center: 'analysis', page: 'warning' },
  导高: { center: 'analysis', page: 'warning' },
  压力: { center: 'analysis', page: 'comparison' },
  温度: { center: 'analysis', page: 'warning' },
}

export const EVENT_TYPE_ROUTE = {
  燃弧: { center: 'analysis', page: 'arc' },
  拉出值: { center: 'analysis', page: 'warning' },
  导高: { center: 'analysis', page: 'warning' },
  压力: { center: 'analysis', page: 'comparison' },
  温度: { center: 'analysis', page: 'warning' },
}

/** @param {string} factor */
export function routeForFactor(factor, context = {}) {
  const base = FACTOR_ROUTE[factor] || { center: 'analysis', page: 'warning' }
  return {
    ...base,
    context: {
      ...context,
      factor,
      metric: FACTOR_TO_METRIC[factor] || null,
    },
  }
}

/** @param {{ type?: string, station?: string, pole_no?: string }} event */
export function routeForEvent(event, context = {}) {
  const type = event?.type || ''
  const base = EVENT_TYPE_ROUTE[type] || { center: 'analysis', page: 'warning' }
  return {
    ...base,
    context: {
      ...context,
      station: event?.station,
      poleNo: event?.pole_no,
      factor: type,
      metric: FACTOR_TO_METRIC[type] || null,
    },
  }
}

/** @param {{ name?: string, bad_factors?: string[] }} segment */
export function routeForSegment(segment, context = {}) {
  const factors = segment?.bad_factors || []
  const first = Array.isArray(factors[0]) ? factors[0]?.key : factors[0]
  if (first && FACTOR_ROUTE[first]) {
    return routeForFactor(first, { ...context, segment: segment?.name })
  }
  return {
    center: 'analysis',
    page: 'warning',
    context: { ...context, segment: segment?.name },
  }
}

export function makeNavHandler(navigateTo, emit) {
  return (payload) => {
    const fn = navigateTo || ((p) => emit?.('navigate', p))
    if (fn) fn(payload)
  }
}
