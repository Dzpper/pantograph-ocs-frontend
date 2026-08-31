/** 分析页共用：稳定序列化筛选指纹，避免 deep watch 因对象引用误触发 */

export function filterFingerprint(parts) {
  try {
    return JSON.stringify(parts)
  } catch {
    return String(parts)
  }
}

/** 简单防抖 */
export function debounce(fn, wait = 120) {
  let timer = null
  const wrapped = (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, wait)
  }
  wrapped.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
  return wrapped
}
