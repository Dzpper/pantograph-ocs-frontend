import { ref, watch, onActivated, onDeactivated, onBeforeUnmount, inject, unref } from 'vue'
import { debounce, filterFingerprint } from '../utils/loadGuard'
import { withBatchPayload } from '../utils/batchPrefs'
import { cacheKey, getCached } from '../api/cache'

export { filterFingerprint, withBatchPayload, cacheKey, getCached }

/** 分析页共用筛选指纹（含检测组） */
export function analysisFingerprint(props, extra = []) {
  return filterFingerprint([
    props.lineId,
    props.direction,
    props.selectedDates,
    props.manualBatch,
    props.batchByDate,
    props.batchesByDate,
    props.queryNonce,
    ...extra,
  ])
}

/** 合并检测组到 POST body */
export function analysisPayload(base, props) {
  return withBatchPayload(
    base,
    props.manualBatch,
    props.batchByDate,
    props.batchesByDate,
  )
}

/**
 * 分析页加载：指纹变化 → debounce → load。
 * keep-alive 后台页不发请求；缓存命中或切回前台时立即加载。
 */
export function useAnalysisQuery({
  fingerprint,
  load,
  debounceMs = 180,
  immediate = true,
} = {}) {
  const loading = ref(false)
  let loadSeq = 0
  let lastFp = ''
  let pending = false
  const isActive = ref(true)
  const queryNonce = inject('analysisQueryNonce', 0)

  function nextSeq() {
    loadSeq += 1
    return loadSeq
  }

  function isStale(seq) {
    return seq !== loadSeq
  }

  function fpNow() {
    const base = typeof fingerprint === 'function'
      ? String(fingerprint() ?? '')
      : String(fingerprint?.value ?? fingerprint ?? '')
    return `${base}#${unref(queryNonce) || 0}`
  }

  async function run() {
    if (typeof load !== 'function') return
    lastFp = fpNow()
    pending = false
    await load({
      loading,
      nextSeq,
      isStale,
      start(seq) {
        if (seq == null || seq === loadSeq) loading.value = true
      },
      finish(seq) {
        if (seq == null || seq === loadSeq) loading.value = false
      },
    })
  }

  const runDebounced = debounce(run, debounceMs)

  function schedule() {
    if (!isActive.value) {
      pending = true
      runDebounced.cancel?.()
      return
    }
    const fp = fpNow()
    if (fp && fp === lastFp) return
    if (!lastFp) {
      runDebounced.cancel?.()
      run()
      return
    }
    runDebounced()
  }

  watch(fpNow, schedule, { immediate })

  onActivated(() => {
    isActive.value = true
    const fp = fpNow()
    if (!pending && fp && fp === lastFp) return
    pending = false
    runDebounced.cancel?.()
    run()
  })

  onDeactivated(() => {
    isActive.value = false
    runDebounced.cancel?.()
  })

  onBeforeUnmount(() => {
    loadSeq += 1
    isActive.value = false
    runDebounced.cancel?.()
  })

  return { loading, run, runDebounced, nextSeq, isStale }
}
