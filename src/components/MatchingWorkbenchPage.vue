<template>
  <div class="page" v-loading="loading">
    <header class="page-head">
      <div>
        <h2 class="page-title">线路简报</h2>
        <p class="page-sub" v-if="lineId && selectedDates?.length">
          {{ lineName || lineId }} · {{ direction }} · {{ selectedDates.length }} 期
          <template v-if="result?.window?.resolved != null && result.window.resolved !== selectedDates.length">
            · 本次取 {{ result.window.resolved }} 期
          </template>
        </p>
        <p class="page-sub warn" v-else>请在顶部选择线路与检测日</p>
      </div>
    </header>

    <template v-if="result?.arc_kpi && !result.arc_kpi.empty">
      <section class="conclude-band">
        <div class="fact-card">
          <div class="fact-name">燃弧时长</div>
          <div class="fact-val">{{ durationText }}</div>
          <div v-if="durationDeltaText" class="fact-delta" :class="durationDeltaClass">{{ durationDeltaText }}</div>
        </div>
        <div class="fact-card">
          <div class="fact-name">燃弧率</div>
          <div class="fact-val">{{ rateText }}</div>
          <div v-if="rateDeltaText" class="fact-delta" :class="rateDeltaClass">{{ rateDeltaText }}</div>
        </div>
      </section>

      <section class="viz-grid">
        <div class="om-panel chart-box">
          <div class="panel-title">各期燃弧总时长</div>
          <p class="fig-cap">全线合计；横轴从左到右为旧日期 → 新日期。</p>
          <v-chart
            class="chart"
            :key="`mw-trend-${chartScopeKey}`"
            :option="trendOption"
            :update-options="{ notMerge: true }"
            autoresize
          />
        </div>
        <div class="om-panel chart-box">
          <div class="panel-title">燃弧率变化</div>
          <p class="fig-cap">各期整线路燃弧率（%）；横轴从左到右为旧日期 → 新日期。</p>
          <v-chart
            class="chart"
            :key="`mw-rate-${chartScopeKey}`"
            :option="rateOption"
            :update-options="{ notMerge: true }"
            autoresize
          />
        </div>
      </section>
    </template>

    <el-empty v-else-if="!loading && result?.arc_kpi?.empty" description="当前范围暂无燃弧数据" />
    <el-empty v-else-if="!loading" description="在顶部选择线路与检测日后自动分析" />
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
} from 'echarts/components'
import { postCorrelationDiagnose } from '../api/client'
import { useAnalysisQuery, analysisFingerprint, analysisPayload, cacheKey, getCached } from '../composables/useAnalysisQuery'

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
])

function roundPct(curr, prev) {
  const c = Number(curr)
  const p = Number(prev)
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null
  return Math.round(((c - p) / p) * 1000) / 10
}

function deltaPhrase(pct) {
  if (pct == null) return ''
  if (pct === 0) return '与上期持平'
  if (pct > 0) return `相比上期上涨 ${pct}%`
  return `相比上期下降 ${Math.abs(pct)}%`
}

function deltaTone(pct) {
  if (pct == null) return ''
  if (pct <= -10) return 'good'
  if (pct >= 10) return 'bad'
  return ''
}

function fmtRatePercent(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const txt = Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(4)
  return `${txt} %`
}

function rateOf(row) {
  const v = row?.arc_rate_percent
  if (v == null || !Number.isFinite(Number(v))) return null
  return Number(v)
}

export default {
  name: 'MatchingWorkbenchPage',
  components: { VChart },
  props: {
    lineId: String,
    lineName: String,
    direction: { type: String, default: '上行' },
    selectedDates: { type: Array, default: () => [] },
    manualBatch: { type: Boolean, default: false },
    batchByDate: { type: Object, default: () => ({}) },
    batchesByDate: { type: Object, default: () => ({}) },
    isDark: Boolean,
  },
  setup(props) {
    const result = ref(null)

    const chartScopeKey = computed(() =>
      `${props.lineId}|${props.direction}|${(props.selectedDates || []).join(',')}`,
    )

    const sortedDaily = computed(() => {
      const daily = [...(result.value?.arc_kpi?.daily || [])]
      daily.sort((a, b) => {
        const ka = String(a?.inspect_date || '').replace(/-/g, '').slice(0, 8)
        const kb = String(b?.inspect_date || '').replace(/-/g, '').slice(0, 8)
        return ka.localeCompare(kb)
      })
      return daily
    })

    const durationText = computed(() => {
      const v = result.value?.arc_kpi?.kpi?.arc_duration_sum
      if (v == null) return '—'
      return `${v} ms`
    })
    const durationDeltaPct = computed(() => {
      const d = result.value?.arc_kpi?.kpi?.delta_duration_pct
      return d == null ? null : Number(d)
    })
    const durationDeltaText = computed(() => deltaPhrase(durationDeltaPct.value))
    const durationDeltaClass = computed(() => deltaTone(durationDeltaPct.value))

    const rateText = computed(() => {
      const v = result.value?.arc_kpi?.kpi?.arc_rate_percent
      if (v == null) return '—'
      return fmtRatePercent(v)
    })
    const rateDeltaPct = computed(() => {
      const daily = sortedDaily.value
      if (daily.length < 2) return null
      return roundPct(rateOf(daily[daily.length - 1]), rateOf(daily[daily.length - 2]))
    })
    const rateDeltaText = computed(() => deltaPhrase(rateDeltaPct.value))
    const rateDeltaClass = computed(() => deltaTone(rateDeltaPct.value))

    const trendOption = computed(() => {
      const daily = sortedDaily.value
      return {
        color: ['#1d4ed8'],
        tooltip: { trigger: 'axis' },
        grid: { left: 52, right: 16, top: 24, bottom: 48 },
        xAxis: {
          type: 'category',
          data: daily.map((d) => d.inspect_date),
          axisLabel: { rotate: 35, fontSize: 10 },
        },
        yAxis: { type: 'value', name: 'ms', nameTextStyle: { fontSize: 11 } },
        series: [{
          type: 'line',
          smooth: true,
          symbolSize: 6,
          areaStyle: { opacity: 0.08 },
          data: daily.map((d) => d.arc_duration_sum),
        }],
      }
    })

    const rateOption = computed(() => {
      const daily = sortedDaily.value
      return {
        color: ['#b45309'],
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v) => (v == null ? '—' : fmtRatePercent(v)),
        },
        grid: { left: 56, right: 16, top: 24, bottom: 48 },
        xAxis: {
          type: 'category',
          data: daily.map((d) => d.inspect_date),
          axisLabel: { rotate: 35, fontSize: 10 },
        },
        yAxis: {
          type: 'value',
          name: '%',
          nameTextStyle: { fontSize: 11 },
          scale: true,
        },
        series: [{
          name: '燃弧率',
          type: 'line',
          smooth: true,
          symbolSize: 6,
          connectNulls: false,
          areaStyle: { opacity: 0.08 },
          data: daily.map((d) => rateOf(d)),
        }],
      }
    })

    const { loading } = useAnalysisQuery({
      fingerprint: () => analysisFingerprint(props),
      load: async ({ nextSeq, isStale, start, finish }) => {
        if (!props.lineId || !props.selectedDates?.length) {
          result.value = null
          return
        }
        const payload = analysisPayload({
          line_code: props.lineId,
          direction: props.direction,
          dates: props.selectedDates.map((d) => String(d).replace(/-/g, '').slice(0, 8)),
          brief: true,
        }, props)
        const cached = getCached(cacheKey('/correlation/diagnose', payload))
        if (cached) {
          result.value = cached
          return
        }
        const seq = nextSeq()
        start(seq)
        try {
          const data = await postCorrelationDiagnose(payload)
          if (isStale(seq)) return
          result.value = data
        } catch (e) {
          if (!isStale(seq)) {
            ElMessage.error(e?.response?.data?.detail || e.message || '分析失败')
          }
        } finally {
          finish(seq)
        }
      },
    })

    return {
      loading,
      result,
      chartScopeKey,
      durationText,
      durationDeltaText,
      durationDeltaClass,
      rateText,
      rateDeltaText,
      rateDeltaClass,
      trendOption,
      rateOption,
    }
  },
}
</script>

<style scoped>
.page {
  padding: 8px 4px 28px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.page-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.page-title {
  margin: 0 0 6px;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--om-text);
}
.toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.window-hint {
  width: 100%;
  margin: 6px 0 0;
  font-size: 0.8rem;
  color: var(--om-text-muted);
}
.window-hint b { color: var(--om-text); font-weight: 650; }
.window-hint .warn { color: var(--om-warning); margin-left: 4px; }

.conclude-band {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}
.fact-card {
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--om-panel-border);
  background: var(--om-bg-3);
}
.fact-name {
  font-size: 0.78rem;
  color: var(--om-text-muted);
}
.fact-val {
  margin-top: 4px;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--om-text);
}
.fact-delta {
  margin-top: 6px;
  font-size: 0.86rem;
  color: var(--om-text-muted);
}
.fact-delta.good { color: var(--om-success); }
.fact-delta.bad { color: var(--om-danger); }

.viz-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}
.chart-box { padding: 12px 14px; }
.chart { height: 220px; width: 100%; }
.panel-title {
  margin: 0 0 4px;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--om-text);
}
.fig-cap {
  margin: 0 0 8px;
  font-size: 0.78rem;
  color: var(--om-text-dim);
  line-height: 1.45;
}

@media (max-width: 900px) {
  .conclude-band, .viz-grid { grid-template-columns: 1fr; }
}
</style>
