<template>
  <div class="chart-page" v-loading="loading">
    <h2 :style="titleStyle">{{ lineName }} {{ direction }} — 多期对比</h2>

    <el-row :gutter="20" style="margin-bottom: 16px">
      <el-col :span="12">
        <el-select v-model="metric" style="width: 100%" @change="onMetricChange">
          <el-option v-for="m in metrics" :key="m" :label="m" :value="m" />
        </el-select>
      </el-col>
      <el-col :span="12">
        <el-text v-if="!selectedDates.length" type="warning">请在顶部勾选至少一个日期</el-text>
        <el-text v-else type="info">已选 {{ selectedDates.length }} 个日期 · 滚轮缩放 / 拖拽平移</el-text>
      </el-col>
    </el-row>

    <div class="chart-wrap">
      <v-chart class="chart-canvas" :option="chartOption" autoresize />
    </div>

    <div class="om-panel" style="margin-top: 16px" v-if="isArcTimeScatter && arcRows.length">
      <el-table
        :data="arcRows"
        size="small"
        stripe
        max-height="280"
      >
        <el-table-column prop="label" label="期次" min-width="120" />
        <el-table-column prop="arc_count" label="燃弧点数" min-width="100" />
        <el-table-column label="最大燃弧时间" min-width="130">
          <template #default="{ row }">{{ fmtArcTime(row.max_arc_time) }}</template>
        </el-table-column>
        <el-table-column label="总燃弧时间" min-width="130">
          <template #default="{ row }">{{ fmtArcTime(row.total_arc_time) }}</template>
        </el-table-column>
        <el-table-column label="燃弧率" min-width="120">
          <template #default="{ row }">{{ fmtArcRate(row.arc_rate_percent) }}</template>
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
import { LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent } from 'echarts/components'
import { postComparison, fetchMetrics } from '../api/client'
import { loadAnalysisPrefs, saveAnalysisPrefs } from '../utils/analysisPrefs'
import {
  baseGrid,
  baseDataZoom,
  baseLegend,
  baseValueYAxis,
  buildCategoryXAxis,
  buildAxisTooltip,
  buildPointTooltip,
  chartTooltipStyle,
} from '../utils/chartOptions'

use([CanvasRenderer, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent])

export default {
  name: 'ComparisonPage',
  components: { VChart },
  props: {
    lineId: String,
    lineName: String,
    direction: String,
    selectedDates: { type: Array, default: () => [] },
    isDark: Boolean,
  },
  setup(props) {
    const prefs = loadAnalysisPrefs()
    const metric = ref(prefs.metric || '导高 (mm)')
    const metrics = ref([])
    const data = ref({ x_axis: {}, series: [] })
    const loading = ref(false)

    const titleStyle = computed(() => ({ color: props.isDark ? '#3dbfad' : '#3488d9' }))
    const fmtArcTime = (v) => (v == null ? '—' : `${Number(v).toFixed(3)} ms`)
    const fmtArcRate = (v) => (v == null ? '—' : `${Number(v).toFixed(4)} %`)

    const isArcTimeScatter = computed(
      () => data.value.chart_type === 'arc_time_scatter' || metric.value === '燃弧时间 (ms)',
    )

    const arcRows = computed(() =>
      (data.value.series || []).map((s) => ({
        label: s.label,
        color: s.color,
        arc_count: s.stats?.arc_count ?? 0,
        max_arc_time: s.stats?.max_arc_time,
        total_arc_time: s.stats?.total_arc_time,
        arc_rate_percent: s.stats?.arc_rate_percent,
      })),
    )

    const chartOption = computed(() => {
      const xAxis = data.value.x_axis || {}
      const legend = baseLegend(props.isDark, {
        data: (data.value.series || []).map((s) => s.label),
      })
      const grid = baseGrid(props.isDark)

      if (isArcTimeScatter.value) {
        return {
          tooltip: {
            trigger: 'item',
            confine: true,
            ...chartTooltipStyle(props.isDark),
            formatter: buildPointTooltip('ms'),
          },
          legend,
          grid,
          dataZoom: baseDataZoom(),
          xAxis: buildCategoryXAxis(xAxis, props.isDark),
          yAxis: baseValueYAxis(props.isDark, '燃弧时间 (ms)'),
          series: (data.value.series || []).map((s) => ({
            name: s.label,
            type: 'scatter',
            symbolSize: 9,
            data: (s.points || []).map((p) => ({
              value: [p.x_index, p.arc_time_ms],
              station_area_name: p.station_area_name,
              pole_no: p.pole_no,
              km: p.km,
              arc_time_ms: p.arc_time_ms,
            })),
            itemStyle: { color: s.color },
          })),
        }
      }

      return {
        tooltip: {
          trigger: 'axis',
          confine: true,
          ...chartTooltipStyle(props.isDark),
          formatter: buildAxisTooltip(xAxis, data.value.series),
        },
        legend,
        grid,
        dataZoom: baseDataZoom(),
        xAxis: buildCategoryXAxis(xAxis, props.isDark),
        yAxis: baseValueYAxis(props.isDark, metric.value),
        series: (data.value.series || []).map((s) => ({
          name: s.label,
          type: 'line',
          data: s.values,
          connectNulls: false,
          showSymbol: false,
          smooth: false,
          sampling: 'lttb',
          large: true,
          lineStyle: { width: 1.8, color: s.color },
          itemStyle: { color: s.color },
        })),
      }
    })

    const loadData = async () => {
      if (!props.lineId || !props.direction || !props.selectedDates?.length) return
      loading.value = true
      try {
        data.value = await postComparison({
          line_id: props.lineId,
          direction: props.direction,
          dates: props.selectedDates,
          metric: metric.value,
        })
      } catch (e) {
        console.error('加载对比数据失败:', e)
      } finally {
        loading.value = false
      }
    }

    fetchMetrics().then((m) => {
      metrics.value = m.length ? m : ['导高 (mm)', '拉出值 (mm)', '网压 (V)', '电流 (A)', '燃弧时间 (ms)', '最高温度 (℃)', '速度 (km/h)']
      if (metrics.value.length && !metrics.value.includes(metric.value)) {
        metric.value = metrics.value[0]
      }
    })

    function onMetricChange() {
      saveAnalysisPrefs({ metric: metric.value })
      loadData()
    }

    watch(
      [() => props.lineId, () => props.direction, () => props.selectedDates, metric],
      loadData,
      { immediate: true, deep: true },
    )

    return {
      metric, metrics, chartOption, data, titleStyle,
      fmtArcTime, fmtArcRate, isArcTimeScatter, arcRows,
      loadData, onMetricChange, loading,
    }
  },
}
</script>

<style scoped>
.chart-page { width: 100%; max-width: 100%; }
.chart-wrap { width: 100%; height: 520px; position: relative; }
.chart-canvas { width: 100% !important; height: 100% !important; }
</style>
