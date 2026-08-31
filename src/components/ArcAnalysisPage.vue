<template>
  <div class="arc-page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2 class="page-title"><span class="dot" />燃弧强度分析</h2>
        <p class="page-sub">
          {{ lineName || '未选线路' }} · {{ direction }}
          <template v-if="selectedDates?.length"> · {{ selectedDates.length }} 个检测日叠加对比</template>
        </p>
      </div>
      <div class="head-tools">
        <span class="tool-label">强度阈值</span>
        <el-input-number
          v-model="thresholdA2s"
          :min="0"
          :step="10000"
          :precision="0"
          controls-position="right"
          class="thr-input"
          @change="loadData"
        />
        <span class="tool-unit">A²·s</span>
        <el-button-group class="thr-presets">
          <el-button size="small" :type="thresholdA2s === 100000 ? 'primary' : 'default'" @click="setThreshold(100000)">10万</el-button>
          <el-button size="small" :type="thresholdA2s === 200000 ? 'primary' : 'default'" @click="setThreshold(200000)">20万</el-button>
          <el-button size="small" :type="thresholdA2s === 500000 ? 'primary' : 'default'" @click="setThreshold(500000)">50万</el-button>
        </el-button-group>
      </div>
    </div>

    <DataSourceNote
      type="info"
      title="口径说明"
      message="多期检测日叠加在同一图中（与多期对比/汇报一致），图例可显隐各期。仅展示不低于阈值的超限点；横轴公里标，纵轴燃弧强度（A²·s）。默认阈值 200,000 A²·s。"
    />

    <p v-if="!selectedDates.length" class="empty-tip">请在上方选择至少一个检测日。</p>

    <template v-else>
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">检测日</div>
          <div class="kpi-value">{{ seriesList.length }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">超限点合计</div>
          <div class="kpi-value">{{ totalExceed }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">最大强度</div>
          <div class="kpi-value kpi-value-sm">{{ maxIntensityTxt }}</div>
        </div>
        <div class="kpi-card kpi-accent">
          <div class="kpi-label">当前阈值</div>
          <div class="kpi-value kpi-value-sm">{{ thrText }}</div>
        </div>
      </div>

      <div class="om-panel chart-panel">
        <div class="panel-head">
          <div class="panel-title">燃弧强度空间分布</div>
          <span class="panel-sub">底部图例可显隐各期 · 滑块缩放公里标</span>
        </div>
        <v-chart
          v-if="hasPoints"
          class="chart-canvas"
          :option="chartOption"
          autoresize
        />
        <p v-else-if="!loading" class="empty-tip chart-empty">当前阈值下无超限点。</p>
      </div>

      <div v-if="periodRows.length" class="om-panel table-panel">
        <div class="panel-head">
          <div class="panel-title">各期摘要</div>
          <span class="panel-sub">共 {{ periodRows.length }} 期</span>
        </div>
        <el-table :data="periodRows" stripe size="small" class="arc-table" max-height="220">
          <el-table-column label="" width="36" align="center">
            <template #default="{ row }">
              <span class="series-dot" :style="{ background: row.color }" />
            </template>
          </el-table-column>
          <el-table-column prop="label" label="检测日" min-width="110" />
          <el-table-column prop="exceed" label="超限点" min-width="90" align="right" sortable />
          <el-table-column label="最大强度" min-width="120" align="right" sortable :sort-method="sortPeriodMax">
            <template #default="{ row }">{{ row.maxTxt }}</template>
          </el-table-column>
          <el-table-column label="平均强度" min-width="120" align="right" sortable :sort-method="sortPeriodAvg">
            <template #default="{ row }">{{ row.avgTxt }}</template>
          </el-table-column>
        </el-table>
      </div>

      <div v-if="tableRows.length" class="om-panel table-panel">
        <div class="panel-head">
          <div class="panel-title">超限明细</div>
          <span class="panel-sub">按强度降序 · 共 {{ tableRows.length }} 条</span>
        </div>
        <el-table :data="tableRows" stripe size="small" max-height="360" class="arc-table">
          <el-table-column prop="label" label="检测日" min-width="110" />
          <el-table-column prop="pole_no" label="杆号" min-width="100" />
          <el-table-column label="公里标" min-width="100" align="right">
            <template #default="{ row }">
              {{ row.km != null ? Number(row.km).toFixed(3) : '—' }}
            </template>
          </el-table-column>
          <el-table-column prop="station_area_name" label="站区" min-width="120" show-overflow-tooltip />
          <el-table-column label="燃弧强度 (A²·s)" min-width="140" align="right" sortable :sort-method="sortByIntensity">
            <template #default="{ row }">
              <b>{{ fmtIntensity(row.intensity) }}</b>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  DataZoomComponent,
} from 'echarts/components'
import { postArcAnalysis } from '../api/client'
import {
  chartMutedColor,
  chartTooltipStyle,
  chartBgColor,
  formatIntensityA2s,
  formatAxisIntensity,
  layoutForChart,
} from '../utils/chartOptions'
import DataSourceNote from './common/DataSourceNote.vue'

use([
  CanvasRenderer,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  DataZoomComponent,
])

const DEFAULT_THRESHOLD = 200000
const FALLBACK_COLORS = ['#2471A3', '#C0392B', '#1ABC9C', '#8E44AD', '#E67E22', '#16A085']

/** 图例用短日期：同年 MM-DD，跨年 YY-MM-DD */
function shortLegendLabel(label, date, crossYear) {
  const raw = String(date || label || '').replace(/-/g, '')
  if (raw.length >= 8 && /^\d{8}/.test(raw)) {
    return crossYear
      ? `${raw.slice(2, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
      : `${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  }
  const t = String(label || '')
  return t.length > 10 ? t.slice(5, 10) : t
}

function detectCrossYear(list) {
  const years = new Set()
  for (const s of list) {
    const raw = String(s.date || s.label || '').replace(/-/g, '')
    if (raw.length >= 8 && /^\d{8}/.test(raw)) years.add(raw.slice(0, 4))
  }
  return years.size > 1
}

export default {
  name: 'ArcAnalysisPage',
  components: { VChart, DataSourceNote },
  props: {
    lineId: String,
    lineName: String,
    direction: String,
    selectedDates: { type: Array, default: () => [] },
    isDark: Boolean,
  },
  setup(props) {
    const data = ref({ series: [], summaries: [], unit: 'A²·s', threshold_a2s: DEFAULT_THRESHOLD })
    const loading = ref(false)
    const thresholdA2s = ref(DEFAULT_THRESHOLD)

    const summaries = computed(() => data.value.summaries || [])
    const seriesList = computed(() => data.value.series || [])

    const thrText = computed(() =>
      Number(thresholdA2s.value || 0).toLocaleString('zh-CN'),
    )

    const fmtIntensity = (v) => formatIntensityA2s(v, { withUnit: false })

    const periodRows = computed(() =>
      seriesList.value.map((s, idx) => {
        const sm = summaries.value[idx] || {}
        const exceed = sm.exceed_count ?? s.points?.length ?? 0
        const maxV = sm.max_intensity ?? sm.max_i2t
        const avgV = sm.avg_intensity ?? sm.avg_i2t
        return {
          date: s.date,
          label: s.label,
          color: s.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
          exceed,
          maxV: maxV ?? 0,
          avgV: avgV ?? 0,
          maxTxt: formatIntensityA2s(maxV, { withUnit: false }),
          avgTxt: formatIntensityA2s(avgV, { withUnit: false }),
        }
      }),
    )

    const totalExceed = computed(() =>
      periodRows.value.reduce((sum, k) => sum + (k.exceed || 0), 0),
    )

    const maxIntensityTxt = computed(() => {
      let max = null
      for (const r of periodRows.value) {
        if (r.maxV != null && (max == null || r.maxV > max)) max = r.maxV
      }
      return formatIntensityA2s(max, { withUnit: false })
    })

    const tableRows = computed(() => {
      const rows = []
      for (const s of seriesList.value) {
        for (const r of s.exceed_rows || []) rows.push(r)
      }
      rows.sort((a, b) => (b.intensity || 0) - (a.intensity || 0))
      return rows
    })

    const hasPoints = computed(() =>
      seriesList.value.some((s) => (s.points || []).length > 0),
    )

    const sortByIntensity = (a, b) => (a.intensity || 0) - (b.intensity || 0)
    const sortPeriodMax = (a, b) => (a.maxV || 0) - (b.maxV || 0)
    const sortPeriodAvg = (a, b) => (a.avgV || 0) - (b.avgV || 0)

    const setThreshold = (v) => {
      thresholdA2s.value = v
      loadData()
    }

    const chartOption = computed(() => {
      const list = seriesList.value
      const threshold = data.value.threshold_a2s ?? thresholdA2s.value
      const crossYear = detectCrossYear(list)
      const legendNames = list.map((s) => shortLegendLabel(s.label, s.date, crossYear))
      let yMax = threshold || 1

      const echartsSeries = list.map((s, i) => {
        const color = s.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]
        const points = s.points || []
        const fullLabel = s.label || s.date || legendNames[i]
        points.forEach((p) => {
          const v = p.intensity ?? p.i2t
          if (v != null) yMax = Math.max(yMax, v)
        })
        return {
          name: legendNames[i],
          type: 'scatter',
          symbolSize: (val, params) => {
            const norm = params.data?.size_norm ?? 0.5
            return Math.min(Math.max(norm * 12 + 5, 5), 14)
          },
          itemStyle: {
            color,
            opacity: 0.82,
            borderColor: props.isDark ? 'rgba(0,0,0,0.25)' : '#fff',
            borderWidth: 0.5,
          },
          data: points.map((p) => ({
            value: [p.km, p.intensity ?? p.i2t],
            fullLabel,
            ...p,
          })),
          ...(i === 0 && threshold != null
            ? {
                markLine: {
                  silent: true,
                  symbol: 'none',
                  lineStyle: { type: 'dashed', color: '#c0392b', width: 1.2 },
                  label: {
                    formatter: () => `阈值 ${formatAxisIntensity(threshold)}`,
                    position: 'insideEndTop',
                    color: '#c0392b',
                    fontSize: 10,
                  },
                  data: [{ yAxis: threshold }],
                },
              }
            : {}),
        }
      })

      const layout = layoutForChart(props.isDark, { legendTop: false, hasDataZoom: true, hasRotatedLabels: false })

      return {
        backgroundColor: chartBgColor(props.isDark),
        animation: false,
        ...layout,
        legend: {
          ...layout.legend,
          type: 'scroll',
          orient: 'horizontal',
          itemWidth: 10,
          itemHeight: 8,
          itemGap: 14,
          icon: 'circle',
          data: legendNames,
          pageIconSize: 10,
          pageIconColor: chartMutedColor(props.isDark),
          pageIconInactiveColor: props.isDark ? 'rgba(255,255,255,0.2)' : '#c0c4cc',
          pageTextStyle: { color: chartMutedColor(props.isDark), fontSize: 10 },
        },
        grid: {
          ...layout.grid,
          left: 16,
          right: 24,
        },
        dataZoom: layout.dataZoom.map((z) =>
          z.type === 'slider'
            ? {
                ...z,
                height: 14,
                bottom: 4,
                borderColor: props.isDark ? 'rgba(255,255,255,0.12)' : '#e4e7ed',
                fillerColor: props.isDark ? 'rgba(61,191,173,0.25)' : 'rgba(52,136,217,0.18)',
                handleSize: '80%',
                textStyle: { color: chartMutedColor(props.isDark), fontSize: 10 },
              }
            : z
        ),
        tooltip: {
          trigger: 'item',
          confine: true,
          ...chartTooltipStyle(props.isDark),
          formatter: (p) => {
            const d = p.data || {}
            const intensity = d.intensity ?? d.i2t
            const title = d.fullLabel || p.seriesName || ''
            return [
              `<b>${title}</b>`,
              `站区：${d.station_area_name || '—'}`,
              `杆号：${d.pole_no || '—'}`,
              `公里标：${d.km != null ? Number(d.km).toFixed(3) : '—'} km`,
              `燃弧强度：${formatIntensityA2s(intensity)}`,
              `燃弧时间：${d.arc_time_ms != null ? Number(d.arc_time_ms).toFixed(2) : '—'} ms`,
              `电流：${d.current_a != null ? Number(d.current_a).toFixed(1) : '—'} A`,
            ].join('<br/>')
          },
        },
        xAxis: {
          type: 'value',
          name: 'km',
          nameLocation: 'end',
          nameGap: 8,
          nameTextStyle: { fontSize: 11, color: chartMutedColor(props.isDark) },
          scale: true,
          axisLabel: {
            color: chartMutedColor(props.isDark),
            hideOverlap: true,
            formatter: (v) => Number(v).toFixed(1),
          },
          axisTick: { show: false },
          splitLine: {
            lineStyle: { color: props.isDark ? 'rgba(255,255,255,0.06)' : '#eef2f7' },
          },
        },
        yAxis: {
          type: 'value',
          name: 'A²·s',
          nameLocation: 'end',
          nameGap: 10,
          nameTextStyle: { fontSize: 11, color: chartMutedColor(props.isDark) },
          min: 0,
          max: yMax * 1.12,
          axisLabel: {
            color: chartMutedColor(props.isDark),
            formatter: formatAxisIntensity,
          },
          axisTick: { show: false },
          splitLine: {
            lineStyle: { color: props.isDark ? 'rgba(255,255,255,0.06)' : '#eef2f7' },
          },
        },
        series: echartsSeries,
      }
    })

    const loadData = async () => {
      if (!props.lineId || !props.direction || !props.selectedDates?.length) return
      loading.value = true
      try {
        data.value = await postArcAnalysis({
          line_id: props.lineId,
          direction: props.direction,
          dates: props.selectedDates,
          threshold_a2s: thresholdA2s.value,
        })
      } catch (e) {
        console.error('加载燃弧数据失败:', e)
      } finally {
        loading.value = false
      }
    }

    watch(
      [() => props.lineId, () => props.direction, () => props.selectedDates],
      loadData,
      { immediate: true, deep: true },
    )

    return {
      loading,
      seriesList,
      chartOption,
      hasPoints,
      tableRows,
      periodRows,
      thresholdA2s,
      thrText,
      totalExceed,
      maxIntensityTxt,
      fmtIntensity,
      sortByIntensity,
      sortPeriodMax,
      sortPeriodAvg,
      setThreshold,
      loadData,
    }
  },
}
</script>

<style scoped>
.arc-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--om-text);
  display: flex;
  align-items: center;
  gap: 8px;
}
.page-title .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--om-accent);
  box-shadow: 0 0 8px var(--om-accent);
}
.page-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--om-text-dim);
}
.head-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tool-label {
  font-size: 13px;
  color: var(--om-text-dim);
}
.tool-unit {
  font-size: 12px;
  color: var(--om-text-dim);
}
.thr-input {
  width: 140px;
}
.thr-presets :deep(.el-button) {
  min-width: 52px;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 900px) {
  .kpi-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.kpi-card {
  background: var(--om-panel);
  border: 1px solid var(--om-panel-border);
  border-radius: 10px;
  padding: 12px 14px;
}
.kpi-accent {
  border-left: 3px solid var(--om-accent);
}
.kpi-label {
  font-size: 12px;
  color: var(--om-text-dim);
  margin-bottom: 6px;
}
.kpi-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--om-text);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.kpi-value-sm {
  font-size: 18px;
}

.chart-panel,
.table-panel {
  padding: 14px 16px;
}
.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--om-text);
}
.panel-sub {
  font-size: 12px;
  color: var(--om-text-dim);
}
.chart-canvas {
  width: 100%;
  height: 460px;
}
.chart-empty {
  margin: 48px 0;
}
.series-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  vertical-align: middle;
}
.arc-table {
  width: 100%;
}
.empty-tip {
  margin: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--om-text-muted);
}
</style>
