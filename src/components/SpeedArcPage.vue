<template>
  <div class="chart-page" v-loading="loading">
    <h2 :style="titleStyle">🚄 {{ lineName }} {{ direction }} — 速度 & 燃弧强度</h2>
    <p class="caption" :style="{ color: isDark ? '#aaa' : '#666' }">
      按相邻站台速度最低点划分区间；左轴速度、右轴燃弧强度（A²·s）
    </p>

    <el-text v-if="!selectedDates.length" type="warning" style="display: block; margin-bottom: 12px">
      请在左侧勾选至少一个日期
    </el-text>

    <template v-if="segmentList.length">
      <el-row :gutter="12" align="middle" style="margin-bottom: 16px">
        <el-col :span="4">
          <el-button :disabled="segIdx <= 0" @click="goSeg(segIdx - 1)" style="width: 100%">◀ 上一段</el-button>
        </el-col>
        <el-col :span="16">
          <el-select v-model="segIdx" style="width: 100%" filterable @change="loadSegment">
            <el-option
              v-for="seg in segmentList"
              :key="seg.index"
              :label="segmentOptionLabel(seg)"
              :value="seg.index"
            />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-button :disabled="segIdx >= segmentList.length - 1" @click="goSeg(segIdx + 1)" style="width: 100%">下一段 ▶</el-button>
        </el-col>
      </el-row>

      <div class="chart-wrap" v-loading="segmentLoading">
        <v-chart v-if="currentSegment" class="chart-canvas" :option="chartOption" autoresize />
      </div>

      <div v-if="currentSegment" class="kpi-row">
        <span v-for="m in segmentMetrics" :key="m.label" class="kpi-item">
          <b>{{ m.label }}</b> 均 {{ m.avg }} · 最大 {{ m.max }} · {{ m.count }} 点
        </span>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import { fetchSpeedArcMeta, fetchSpeedArcSegment } from '../api/client'
import { chartMutedColor, chartTooltipStyle, chartBgColor, formatSci, layoutForChart } from '../utils/chartOptions'

use([CanvasRenderer, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent])

export default {
  name: 'SpeedArcPage',
  components: { VChart },
  props: {
    lineId: String,
    lineName: String,
    direction: String,
    selectedDates: { type: Array, default: () => [] },
    isDark: Boolean,
  },
  setup(props) {
    const loading = ref(false)
    const segmentLoading = ref(false)
    const meta = ref({ strategy: '', unit: 'A²·s', global_markers: [] })
    const segmentList = ref([])
    const currentSegment = ref(null)
    const segIdx = ref(0)

    const titleStyle = computed(() => ({ color: props.isDark ? '#3dbfad' : '#3488d9' }))

    const basePayload = () => ({
      line_id: props.lineId,
      direction: props.direction,
      dates: props.selectedDates,
    })

    const segmentMetrics = computed(() => {
      const seg = currentSegment.value
      if (!seg) return []
      return (seg.series || []).map((s) => {
        const vals = (s.i2t_points || []).map((p) => p.i2t).filter((v) => v > 0)
        return {
          label: s.label,
          avg: vals.length ? `${formatSci(vals.reduce((a, b) => a + b, 0) / vals.length)} A²·s` : 'N/A',
          max: vals.length ? `${formatSci(Math.max(...vals))} A²·s` : 'N/A',
          count: vals.length,
        }
      })
    })

    const segmentOptionLabel = (seg) => {
      const n = String(seg.index + 1).padStart(2, '0')
      const ms = seg.marker_start
      const me = seg.marker_end
      const spd =
        ms?.speed != null && me?.speed != null
          ? ` · 标记 ${Number(ms.speed).toFixed(1)}/${Number(me.speed).toFixed(1)} km/h`
          : ''
      return `${n}. ${seg.display_name}（${seg.pole_count}杆${spd}）`
    }

    const chartOption = computed(() => {
      const seg = currentSegment.value
      if (!seg) return {}
      const xAxisData = seg.x_axis || {}
      const poles = xAxisData.poles || []
      const stations = xAxisData.stations || []
      const kilometers = xAxisData.kilometers || []
      const echartsSeries = []
      let speedMax = 0
      ;(seg.series || []).forEach((s) => {
        const vals = (s.speed || []).filter((v) => v != null)
        if (vals.length) speedMax = Math.max(speedMax, ...vals)
      })
      const speedYMax = speedMax > 0 ? speedMax * 1.2 : 100
      const poleCount = poles.length
      const zoomEnd = poleCount > 80 ? Math.round((80 / poleCount) * 100) : 100
      const markerStart = seg.marker_start
      const markerEnd = seg.marker_end
      const markLineData = []
      if (poleCount > 0 && markerStart) {
        markLineData.push({
          xAxis: 0,
          label: { show: false },
        })
      }
      if (poleCount > 1 && markerEnd) {
        markLineData.push({
          xAxis: poleCount - 1,
          label: { show: false },
        })
      }

      const startName =
        (xAxisData.tick_labels && xAxisData.tick_labels[0]) ||
        markerStart?.station_name ||
        stations[0] ||
        '起点'
      const endName =
        (xAxisData.tick_labels && xAxisData.tick_labels[xAxisData.tick_labels.length - 1]) ||
        markerEnd?.station_name ||
        stations[stations.length - 1] ||
        '终点'
      // 类别轴只用起、终点站名，中间留空，避免显示杆位数字
      const xCategories = Array.from({ length: poleCount }, (_, i) => {
        if (i === 0) return startName
        if (i === poleCount - 1) return endName
        return ''
      })

      ;(seg.series || []).forEach((s) => {
        echartsSeries.push({
          name: `${s.label} 速度`,
          type: 'line',
          yAxisIndex: 0,
          data: s.speed,
          connectNulls: false,
          showSymbol: false,
          lineStyle: { width: 2.5, color: s.color },
          itemStyle: { color: s.color },
          large: true,
        })
        echartsSeries.push({
          name: `${s.label} 燃弧强度`,
          type: 'scatter',
          yAxisIndex: 1,
          symbolSize: 10,
          itemStyle: { color: s.color, opacity: 0.9 },
          data: (s.i2t_points || []).map((p) => ({ value: [p.x_index, p.i2t], ...p })),
        })
      })

      const layout = layoutForChart(props.isDark, { legendTop: false, hasDataZoom: true, hasRotatedLabels: false })

      return {
        backgroundColor: chartBgColor(props.isDark),
        textStyle: { fontSize: 13 },
        ...layout,
        legend: {
          ...layout.legend,
          type: 'scroll',
          itemWidth: 14,
          itemHeight: 8,
          pageIconColor: chartMutedColor(props.isDark),
          pageTextStyle: { color: chartMutedColor(props.isDark) },
        },
        dataZoom: layout.dataZoom.map((z, i) =>
          i === 1 ? { ...z, end: zoomEnd } : z
        ),
        tooltip: {
          trigger: 'item',
          confine: true,
          ...chartTooltipStyle(props.isDark),
          textStyle: { fontSize: 13 },
          formatter: (p) => {
            const d = p.data || {}
            const idx = p.seriesType === 'line' ? p.dataIndex : d.x_index
            const station = d.station_area_name || stations[idx] || '—'
            const pole = d.pole_no || poles[idx] || '—'
            const km = d.kilometer_mark ?? kilometers[idx]
            const kmStr = km != null ? Number(km).toFixed(3) : '—'
            if (p.seriesType === 'line') {
              const val = p.value == null ? '—' : Number(p.value).toFixed(1)
              return [`<b>${p.seriesName}</b>`, `站区：${station}`, `杆号：${pole}`, `公里标：${kmStr}`, `速度：${val} km/h`].join('<br/>')
            }
            return [
              `<b>${p.seriesName}</b>`,
              `站区：${station}`,
              `杆号：${pole}`,
              `公里标：${kmStr}`,
              `燃弧强度：${formatSci(d.i2t)} A²·s`,
            ].join('<br/>')
          },
        },
        xAxis: {
          type: 'category',
          data: xCategories,
          boundaryGap: false,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: props.isDark ? 'rgba(61, 191, 173, 0.28)' : 'rgba(52, 136, 217, 0.25)' } },
          axisLabel: {
            show: true,
            color: chartMutedColor(props.isDark),
            fontSize: 14,
            interval: 0,
            hideOverlap: true,
            formatter: (val) => val || '',
          },
        },
        yAxis: [
          {
            type: 'value',
            name: '速度 (km/h)',
            position: 'left',
            min: 0,
            max: speedYMax,
            nameGap: 14,
            nameTextStyle: { fontSize: 12, color: chartMutedColor(props.isDark) },
            axisLabel: {
              color: chartMutedColor(props.isDark),
              fontSize: 11,
              formatter: (v) => Number(v).toFixed(1),
            },
            splitLine: {
              lineStyle: { color: props.isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.25)' },
            },
          },
          {
            type: 'value',
            name: '燃弧强度 (A²·s)',
            position: 'right',
            scale: true,
            nameGap: 14,
            nameTextStyle: { fontSize: 12, color: chartMutedColor(props.isDark) },
            axisLabel: {
              color: chartMutedColor(props.isDark),
              fontSize: 11,
              formatter: (v) => formatSci(v, 2),
            },
            splitLine: { show: false },
          },
        ],
        series: echartsSeries.map((s, idx) =>
          idx === 0 && markLineData.length
            ? {
                ...s,
                markLine: {
                  silent: true,
                  symbol: 'none',
                  label: { show: false },
                  lineStyle: { type: 'dashed', color: props.isDark ? 'rgba(61,191,173,0.45)' : 'rgba(52,136,217,0.4)' },
                  data: markLineData,
                },
              }
            : s
        ),
      }
    })

    const loadSegment = async () => {
      if (!props.lineId || !props.direction || !props.selectedDates?.length) return
      segmentLoading.value = true
      try {
        const res = await fetchSpeedArcSegment(basePayload(), segIdx.value)
        currentSegment.value = res.segment
      } catch (e) {
        console.error(e)
      } finally {
        segmentLoading.value = false
      }
    }

    const loadMeta = async () => {
      if (!props.lineId || !props.direction || !props.selectedDates?.length) {
        segmentList.value = []
        currentSegment.value = null
        return
      }
      loading.value = true
      try {
        const res = await fetchSpeedArcMeta(basePayload())
        meta.value = res
        segmentList.value = res.segment_list || []
        segIdx.value = 0
        if (segmentList.value.length) await loadSegment()
        else currentSegment.value = null
      } catch (e) {
        console.error(e)
      } finally {
        loading.value = false
      }
    }

    const goSeg = (idx) => {
      segIdx.value = idx
      loadSegment()
    }

    watch(
      [() => props.lineId, () => props.direction, () => props.selectedDates],
      loadMeta,
      { immediate: true, deep: true }
    )

    return {
      loading,
      segmentLoading,
      meta,
      segmentList,
      currentSegment,
      segIdx,
      chartOption,
      segmentMetrics,
      segmentOptionLabel,
      titleStyle,
      loadSegment,
      goSeg,
    }
  },
}
</script>

<style scoped>
.chart-page { width: 100%; min-height: 200px; }
.caption { margin: 0 0 12px; font-size: 13px; }
.chart-wrap { width: 100%; height: 560px; }
.chart-canvas { width: 100% !important; height: 100% !important; }
.kpi-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-top: 14px;
  padding: 10px 12px;
  font-size: 13px;
  background: rgba(52, 136, 217, 0.06);
  border-radius: 6px;
}
.kpi-item { color: var(--om-text-muted); }
</style>
