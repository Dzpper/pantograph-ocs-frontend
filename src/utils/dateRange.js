/** 检测日期 YYYYMMDD 与 Date 互转、按范围筛选 */

export function parseInspectDate(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr).replace(/-/g, '').slice(0, 8)
  if (s.length !== 8) return null
  const y = parseInt(s.slice(0, 4), 10)
  const m = parseInt(s.slice(4, 6), 10) - 1
  const d = parseInt(s.slice(6, 8), 10)
  const dt = new Date(y, m, d)
  return Number.isNaN(dt.getTime()) ? null : dt
}

export function formatInspectDate(dateStr) {
  if (!dateStr) return ''
  const s = String(dateStr).replace(/-/g, '').slice(0, 8)
  if (s.length !== 8) return dateStr
  return `${s.slice(0, 4)}年${s.slice(4, 6)}月${s.slice(6, 8)}日`
}

export function toPickerDate(date) {
  if (!date) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 在可用检测日期列表中，筛选落在 [start, end] 内的日期（保持原列表顺序，新→旧） */
export function filterDatesByRange(allDates, rangeStart, rangeEnd) {
  if (!allDates?.length || !rangeStart || !rangeEnd) return []
  const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate())
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59)
  return allDates.filter((d) => {
    const dt = parseInspectDate(d)
    return dt && dt >= start && dt <= end
  })
}

/** 默认范围：最近 months 个月（基于最新一期检测日） */
export function defaultRangeForDates(allDates, months = 3) {
  if (!allDates?.length) return null
  const newest = parseInspectDate(allDates[0])
  const oldest = parseInspectDate(allDates[allDates.length - 1])
  if (!newest) return null
  const start = new Date(newest)
  start.setMonth(start.getMonth() - months)
  const rangeStart = oldest && start < oldest ? oldest : start
  return [rangeStart, newest]
}
