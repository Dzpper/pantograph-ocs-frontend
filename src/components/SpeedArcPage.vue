<template>
  <div class="chart-page" v-loading="loading">
    <h2 :style="titleStyle">🚄 {{ lineName }} {{ direction }} — 速度 & {{ scatterMetricLabel }}</h2>
    <p class="caption" :style="{ color: isDark ? '#aaa' : '#666' }">
      按相邻站台速度最低点划分区间；左轴速度、右轴{{ scatterMetricLabel }}（{{ scatterUnit }}）。超过 8 条曲线时图例默认只亮最新 2 期。
    </p>

    <el-text v-if="!selectedDates.length" type="warning" style="display: block; margin-bottom: 12px">
      请在左侧勾选至少一个日期
    </el-text>
    <el-text
      v-else-if="!loading && !segmentList.length"
      type="warning"
      style="display: block; margin-bottom: 12px"
    >
      当前检测组无法切出区间（可能是残缺/折返小批）。请改选杆位更全的检测组后再看图。
    </el-text>

    <template v-if="segmentList.length">
      <el-row :gutter="12" align="middle" style="margin-bottom: 16px">
        <el-col :xs="24" :sm="4">
          <el-button :disabled="segIdx <= 0" @click="goSeg(segIdx - 1)" style="width: 100%">◀ 上一段</el-button>
        </el-col>
        <el-col :xs="24" :sm="10">
          <el-select v-model="segIdx" style="width: 100%" filterable @change="loadSegment">
            <el-option
              v-for="seg in segmentList"
              :key="seg.index"
              :label="segmentOptionLabel(seg)"
              :value="seg.index"
            />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="4">
          <el-button :disabled="segIdx >= segmentList.length - 1" @click="goSeg(segIdx + 1)" style="width: 100%">下一段 ▶</el-button>
        </el-col>
        <el-col :xs="24" :sm="6">
          <div class="scatter-toggle">
            <el-switch v-model="showArcTime" size="small" />
            <span class="scatter-toggle-label">散点：燃弧时间</span>
          </div>
        </el-col>
      </el-row>

      <div class="chart-wrap" v-loading="segmentLoading">
        <v-chart
          v-if="currentSegment"
          :key="`speed-${lineId}|${direction}|${(selectedDates || []).join(',')}|${segIdx}|${showArcTime ? 't' : 'i'}`"
          class="chart-canvas"
          :option="chartOption"
          :update-options="{ notMerge: true }"
          autoresize
        />
      </div>
    </template>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import { fetchSpeedArcSegment } from '../api/client'
import { useAnalysisQuery, analysisFingerprint, analysisPayload, cacheKey, getCached } from '../composables/useAnalysisQuery'
import { chartMutedColor, chartTooltipStyle, chartBgColor, formatSci, layoutForChart, legendSelectedKeepFirst } from '../utils/chartOptions'

use([CanvasRenderer, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent])

export default {
  name: 'SpeedArcPage',
  components: { VChart },
  props: {
    lineId: String,
    lineName: String,
    direction: String,
    selectedDates: { type: Array, default: () => [] },
    manualBatch: { type: Boolean, default: false },
    batchByDate: { type: Object, default: () => ({}) },
    batchesByDate: { type: Object, default: () => ({}) },
    isDark: Boolean,
  },
  setup(props) {
    const segmentLoading = ref(false)
    const meta = ref({ strategy: '', unit: 'A²·s', global_markers: [] })
    const segmentList = ref([])
    const currentSegment = ref(null)
    const segIdx = ref(0)
    /** false=燃弧强度（默认）；true=燃弧时间 */
    const showArcTime = ref(false)
    let segmentLoadSeq = 0

    const titleStyle = computed(() => ({ color: props.isDark ? '#3dbfad' : '#3488d9' }))
    const scatterMetricLabel = computed(() => (showArcTime.value ? '燃弧时间' : '燃弧强度'))
    const scatterUnit = computed(() => (showArcTime.value ? 'ms' : 'A²·s'))

    const basePayload = () => analysisPayload({
      line_id: props.lineId,
      direction: props.direction,
      dates: props.selectedDates,
    }, props)

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
      const useArcTime = showArcTime.value
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

      const scatterName = useArcTime ? '燃弧时间' : '燃弧强度'
      ;(seg.series || []).forEach((s) => {
        // 无效/缺失速度一律 null；connectNulls=false，断开处不连线、不插值
        const speedData = (s.speed || []).map((v) => {
          if (v == null || v === '' || Number.isNaN(Number(v))) return null
          const n = Number(v)
          return n > 0 ? n : null
        })
        echartsSeries.push({
          name: `${s.label} 速度`,
          type: 'line',
          yAxisIndex: 0,
          data: speedData,
          connectNulls: false,
          showSymbol: false,
          sampling: 'lttb',
          large: true,
          lineStyle: { width: 2.5, color: s.color },
          itemStyle: { color: s.color },
        })
        const points = (s.i2t_points || [])
          .map((p) => {
            const y = useArcTime ? p.arc_time_ms : p.i2t
            if (y == null || !(Number(y) > 0)) return null
            return { value: [p.x_index, Number(y)], ...p }
          })
          .filter(Boolean)
        echartsSeries.push({
          name: `${s.label} ${scatterName}`,
          type: 'scatter',
          yAxisIndex: 1,
          symbolSize: 10,
          itemStyle: { color: s.color, opacity: 0.9 },
          data: points,
        })
      })

      const layout = layoutForChart(props.isDark, { legendTop: false, hasDataZoom: true, hasRotatedLabels: false })

      return {
        animation: false,
        backgroundColor: chartBgColor(props.isDark),
        textStyle: { fontSize: 13 },
        ...layout,
        legend: {
          ...layout.legend,
          type: 'scroll',
          itemWidth: 14,
          itemHeight: 8,
          selected: legendSelectedKeepFirst(echartsSeries.map((s) => s.name), { keep: 4, activateAt: 8 }),
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
            const intensity = d.i2t != null ? `${formatSci(d.i2t)} A²·s` : '—'
            const arcMs = d.arc_time_ms != null ? `${Number(d.arc_time_ms).toFixed(1)} ms` : '—'
            return [
              `<b>${p.seriesName}</b>`,
              `站区：${station}`,
              `杆号：${pole}`,
              `公里标：${kmStr}`,
              `燃弧强度：${intensity}`,
              `燃弧时间：${arcMs}`,
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
            name: useArcTime ? '燃弧时间 (ms)' : '燃弧强度 (A²·s)',
            position: 'right',
            scale: true,
            nameGap: 14,
            nameTextStyle: { fontSize: 12, color: chartMutedColor(props.isDark) },
            axisLabel: {
              color: chartMutedColor(props.isDark),
              fontSize: 11,
              formatter: (v) => (useArcTime ? Number(v).toFixed(1) : formatSci(v, 2)),
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
      if (!props.lineId || !props.direction || !props.selectedDates?.length) {
        currentSegment.value = null
        return
      }
      const seq = ++segmentLoadSeq
      const reqPayload = basePayload()
      const cached = getCached(cacheKey('/speed-arc', { ...reqPayload, segment_index: segIdx.value }))
      if (cached?.segment) {
        currentSegment.value = cached.segment
        return
      }
      segmentLoading.value = true
      currentSegment.value = null
      try {
        const res = await fetchSpeedArcSegment(basePayload(), segIdx.value)
        if (seq !== segmentLoadSeq) return
        currentSegment.value = res.segment
      } catch (e) {
        console.error(e)
        if (seq === segmentLoadSeq) currentSegment.value = null
      } finally {
        if (seq === segmentLoadSeq) segmentLoading.value = false
      }
    }

    const { loading } = useAnalysisQuery({
      fingerprint: () => analysisFingerprint(props),
      load: async ({ nextSeq, isStale, start, finish }) => {
        if (!props.lineId || !props.direction || !props.selectedDates?.length) {
          segmentList.value = []
          currentSegment.value = null
          meta.value = { strategy: '', unit: 'A²·s', global_markers: [] }
          return
        }
        const cached = getCached(cacheKey('/speed-arc', { ...basePayload(), segment_index: 0 }))
        if (cached?.segment_list) {
          meta.value = cached
          segmentList.value = cached.segment_list || []
          segIdx.value = 0
          currentSegment.value = cached.segment || null
          return
        }
        const seq = nextSeq()
        start(seq)
        segmentList.value = []
        currentSegment.value = null
        try {
          const res = await fetchSpeedArcSegment(basePayload(), 0)
          if (isStale(seq)) return
          meta.value = res
          segmentList.value = res.segment_list || []
          segIdx.value = 0
          currentSegment.value = res.segment || null
        } catch (e) {
          console.error(e)
          if (!isStale(seq)) {
            segmentList.value = []
            currentSegment.value = null
          }
        } finally {
          finish(seq)
        }
      },
    })

    const goSeg = (idx) => {
      segIdx.value = idx
      loadSegment()
    }

    return {
      loading,
      segmentLoading,
      meta,
      segmentList,
      currentSegment,
      segIdx,
      showArcTime,
      scatterMetricLabel,
      scatterUnit,
      chartOption,
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
.chart-wrap { width: 100%; }
.chart-canvas { width: 100%; height: 520px; }
.scatter-toggle {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  height: 100%;
  min-height: 32px;
}
.scatter-toggle-label {
  font-size: 12px;
  color: var(--om-text-dim, #666);
  white-space: nowrap;
}
</style>
