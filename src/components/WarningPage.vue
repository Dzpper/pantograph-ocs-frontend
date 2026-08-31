<template>
  <div class="chart-page" v-loading="loading">
    <h2 :style="titleStyle">{{ lineName }} {{ direction }} — 超限预警</h2>

    <el-row :gutter="20" style="margin-bottom: 16px" align="middle">
      <el-col :span="8">
        <div class="field-label">指标</div>
        <el-select v-model="metric" style="width: 100%" @change="onMetricChange">
          <el-option v-for="m in metrics" :key="m" :label="m" :value="m" />
        </el-select>
      </el-col>
      <el-col :span="8">
        <div class="field-label">上限</div>
        <el-input-number v-model="upper" :precision="2" :step="1" style="width: 100%" @change="onThresholdChange" />
      </el-col>
      <el-col :span="8">
        <div class="field-label">下限</div>
        <el-input-number v-model="lower" :precision="2" :step="1" style="width: 100%" @change="onThresholdChange" />
      </el-col>
    </el-row>
    <p class="hint">滚轮缩放 · 拖拽平移曲线</p>

    <div class="chart-wrap">
      <v-chart class="chart-canvas" :option="chartOption" autoresize />
    </div>

    <div class="om-panel" style="margin-top: 16px" v-if="summaryRows.length">
      <el-table
        :data="summaryRows"
        size="small"
        stripe
        max-height="200"
      >
        <el-table-column prop="label" label="期次" min-width="120" />
        <el-table-column label="超限点数" min-width="100">
          <template #default="{ row }">
            <span :style="{ color: row.violations > 0 ? '#e74c3c' : '#27ae60', fontWeight: 600 }">
              {{ row.violations }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="最大值" min-width="120">
          <template #default="{ row }">{{ fmt(row.max) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, DataZoomComponent } from 'echarts/components'
import { postWarning, fetchMetrics } from '../api/client'
import { loadAnalysisPrefs, saveAnalysisPrefs } from '../utils/analysisPrefs'
import {
  layoutForChart,
  buildCategoryXAxis,
  buildAxisTooltip,
  baseValueYAxis,
  chartTooltipStyle,
} from '../utils/chartOptions'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, DataZoomComponent])

export default {
  name: 'WarningPage',
  components: { VChart },
  props: {
    lineId: String,
    lineName: String,
    direction: String,
    selectedDates: { type: Array, default: () => [] },
    navigateContext: { type: Object, default: () => ({}) },
    isDark: Boolean,
  },
  setup(props) {
    const prefs = loadAnalysisPrefs()
    const metric = ref(prefs.metric || '导高 (mm)')
    const upper = ref(prefs.upper != null ? prefs.upper : 4200)
    const lower = ref(prefs.lower != null ? prefs.lower : 4000)
    const metrics = ref([])
    const data = ref({ x_axis: {}, series: [] })
    const loading = ref(false)

    const titleStyle = computed(() => ({ color: props.isDark ? '#3dbfad' : '#3488d9' }))
    const fmt = (v) => (v == null ? '—' : Number(v).toFixed(2))

    const summaryRows = computed(() =>
      (data.value.series || []).map((s) => ({
        label: s.label,
        violations: s.violations ?? 0,
        max: s.max,
      })),
    )

    const chartOption = computed(() => {
      const xAxis = data.value.x_axis || {}
      const layout = layoutForChart(props.isDark, { legendTop: false, hasDataZoom: true, hasRotatedLabels: false })
      return {
        ...layout,
        legend: {
          ...layout.legend,
          data: (data.value.series || []).map((s) => s.label),
        },
        tooltip: {
          trigger: 'axis',
          confine: true,
          ...chartTooltipStyle(props.isDark),
          formatter: buildAxisTooltip(xAxis, data.value.series),
        },
        xAxis: buildCategoryXAxis(xAxis, props.isDark),
        yAxis: baseValueYAxis(props.isDark, metric.value),
        series: (data.value.series || []).map((s, idx) => ({
          name: s.label,
          type: 'line',
          data: s.values,
          connectNulls: true,
          showSymbol: false,
          sampling: 'lttb',
          large: true,
          lineStyle: { width: 1.8, color: s.color },
          itemStyle: { color: s.color },
          markLine:
            idx === 0
              ? {
                  silent: true,
                  symbol: 'none',
                  label: { show: true, formatter: '{b}', fontSize: 10 },
                  lineStyle: { color: '#e74c3c', type: 'dashed', width: 1.2 },
                  data: [
                    { yAxis: upper.value, name: '上限' },
                    { yAxis: lower.value, name: '下限' },
                  ],
                }
              : undefined,
        })),
      }
    })

    const loadData = async () => {
      if (!props.lineId || !props.direction || !props.selectedDates?.length) return
      loading.value = true
      try {
        data.value = await postWarning({
          line_id: props.lineId,
          direction: props.direction,
          dates: props.selectedDates,
          metric: metric.value,
          upper: upper.value,
          lower: lower.value,
        })
      } catch (e) {
        console.error('加载预警数据失败:', e)
      } finally {
        loading.value = false
      }
    }

    const applyNavContext = (ctx) => {
      if (!ctx?.metric) return
      if (!metrics.value.length) metrics.value = [ctx.metric]
      if (metrics.value.includes(ctx.metric)) metric.value = ctx.metric
    }

    fetchMetrics().then((m) => {
      metrics.value = m.length ? m : [metric.value]
      if (metrics.value.length && !metrics.value.includes(metric.value)) {
        metric.value = metrics.value[0]
      }
      applyNavContext(props.navigateContext)
    })

    function onMetricChange() {
      saveAnalysisPrefs({ metric: metric.value })
      loadData()
    }

    function onThresholdChange() {
      saveAnalysisPrefs({ upper: upper.value, lower: lower.value })
      loadData()
    }

    watch(() => props.navigateContext, (ctx) => applyNavContext(ctx), { deep: true })
    watch(
      [() => props.lineId, () => props.direction, () => props.selectedDates, metric, upper, lower],
      loadData,
      { immediate: true, deep: true },
    )

    return {
      metric, upper, lower, metrics, chartOption, data, summaryRows,
      titleStyle, fmt, loadData, onMetricChange, onThresholdChange, loading,
    }
  },
}
</script>

<style scoped>
.chart-page { width: 100%; }
.field-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
.hint { margin: -8px 0 10px; font-size: 12px; color: #94a3b8; }
.chart-wrap { width: 100%; height: 520px; }
.chart-canvas { width: 100% !important; height: 100% !important; }
</style>
