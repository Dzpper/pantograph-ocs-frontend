<template>
  <div class="page" v-loading="loading">
    <header class="page-head">
      <div>
        <h2 class="page-title">杆号评估</h2>
        <p class="page-sub" v-if="lineId && selectedDates?.length">
          {{ lineName || lineId }} · {{ direction }} · {{ selectedDates.length }} 个检测日
          <template v-if="result?.window?.period_count">
            · {{ result.window.period_count }} 个对比组
          </template>
          <template v-if="result?.window?.capped">
            · 所选 {{ result.window.requested }} 日，本次取最近 {{ result.window.resolved }} 日
          </template>
        </p>
        <p class="page-sub warn" v-else>请在顶部选择线路与检测日</p>
      </div>
    </header>

    <template v-if="result && !result.empty">
      <section class="kpi-strip">
        <div class="kpi-card">
          <div class="kpi-name">候选杆号</div>
          <div class="kpi-val">{{ result.summary?.pole_count ?? 0 }}</div>
          <div class="kpi-sub">扫描 {{ result.summary?.scanned_poles ?? 0 }} 处</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-name">对比组</div>
          <div class="kpi-val">{{ result.window?.period_count ?? 0 }}</div>
          <div class="kpi-sub">评价与绘图基数</div>
        </div>
        <div class="kpi-card" :class="{ muted: !result.hard_spot_channel }">
          <div class="kpi-name">硬点通道</div>
          <div class="kpi-val">{{ result.hard_spot_channel ? '有' : '无' }}</div>
        </div>
      </section>

      <section class="work-grid">
        <div class="om-panel pole-panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">候选杆号</div>
              <p class="panel-hint">默认按燃弧复发率从高到低。可输入最小复发率（%），留空不限；也可搜杆号/站区。</p>
            </div>
            <div class="panel-filters">
              <el-radio-group v-model="compareMode" size="small">
                <el-radio-button label="all_groups">所选全部组</el-radio-button>
                <el-radio-button label="day_max">各日燃弧最大组</el-radio-button>
              </el-radio-group>
              <el-input
                v-model="minAppearRatePct"
                clearable
                size="small"
                placeholder="不限"
                style="width: 148px"
              >
                <template #prepend>≥</template>
                <template #append>%</template>
              </el-input>
              <el-input
                v-model="poleQuery"
                clearable
                size="small"
                placeholder="杆号/站区"
                style="width: 140px"
              />
            </div>
          </div>
          <el-table
            v-if="filteredPoles.length"
            :data="filteredPoles"
            size="small"
            stripe
            highlight-current-row
            max-height="560"
            class="pole-table"
            :row-class-name="rowClassName"
            @row-click="onPoleClick"
          >
            <el-table-column prop="pole_no" label="杆号" min-width="92" />
            <el-table-column prop="station" label="站区" min-width="110" show-overflow-tooltip />
            <el-table-column label="复发率" min-width="88" align="center" sortable :sort-by="arcAppearRate">
              <template #default="{ row }">{{ fmtRate(arcAppearRate(row)) }}</template>
            </el-table-column>
            <el-table-column label="燃弧" min-width="88" align="center">
              <template #default="{ row }">
                {{ metricAppear(row, 'arc') }}
              </template>
            </el-table-column>
            <el-table-column v-if="result.hard_spot_channel" label="硬点" min-width="88" align="center">
              <template #default="{ row }">
                {{ metricAppear(row, 'hard') }}
              </template>
            </el-table-column>
          </el-table>
          <p v-else class="empty-tip">当前筛选无候选杆号。</p>
        </div>

        <div class="om-panel detail-panel" v-if="selected">
          <div class="detail-head">
            <div>
              <div class="detail-pole">{{ selected.pole_no }}</div>
              <div class="detail-meta">
                {{ selected.station || '—' }}
                <template v-if="selected.kilometer_mark != null">
                  · K{{ Number(selected.kilometer_mark).toFixed(3) }}
                </template>
              </div>
            </div>
          </div>

          <p class="chart-cap">
            评估按所选对比组作图。浅色带为运维基准范围（与超限统计筛选阈值相同）；虚线为该杆窗口自身中位基线；红点为超限点。
            图多会挤，可按需勾选。
          </p>
          <div class="chart-picker">
            <div class="chart-picker-row">
              <span class="chart-picker-label">子图</span>
              <el-checkbox-group v-model="visibleChartKeys" size="small" @change="onChartKeysChange">
                <el-checkbox
                  v-for="m in chartCatalog"
                  :key="m.key"
                  :label="m.key"
                  :disabled="m.key === 'hard' && result && !result.hard_spot_channel"
                >
                  {{ m.label }}
                </el-checkbox>
              </el-checkbox-group>
            </div>
            <div class="chart-picker-actions">
              <el-button text size="small" @click="applyChartPreset('common')">常用</el-button>
              <el-button text size="small" @click="applyChartPreset('contact')">接触</el-button>
              <el-button text size="small" @click="applyChartPreset('all')">全部</el-button>
            </div>
          </div>
          <div class="chart-grid" :class="{ compact: metricCharts.length >= 6, single: metricCharts.length === 1 }">
            <div
              v-for="m in metricCharts"
              :key="`${chartScopeKey}-${m.key}`"
              class="mini-chart"
              :class="{ dim: m.disabled }"
            >
              <div class="mini-title">
                <span>{{ m.label }}</span>
                <small>{{ m.unit }}</small>
                <small v-if="m.baselineText" class="mini-base">{{ m.baselineText }}</small>
                <span v-if="m.disabled" class="mini-off">本线无硬点通道</span>
              </div>
              <v-chart
                v-if="!m.disabled"
                :key="`pb-${chartScopeKey}-${m.key}`"
                class="mini-canvas"
                :option="m.option"
                :update-options="{ notMerge: true }"
                autoresize
              />
            </div>
          </div>
        </div>
        <div class="om-panel detail-panel empty-detail" v-else>
          <el-empty
            :description="missingContextPole
              ? `杆号 ${selectedPole} 未进入本页候选`
              : '点击左侧杆号查看本杆各指标历史'"
            :image-size="72"
          />
        </div>
      </section>

    </template>

    <el-empty
      v-else-if="!loading && result?.empty"
      :description="result.hint || '当前范围无评估结果'"
    />
    <el-empty
      v-else-if="!loading"
      description="在顶部选择线路与检测日后自动评估"
    />
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  MarkAreaComponent,
} from 'echarts/components'
import { postPoleBaseline } from '../api/client'
import { useAnalysisQuery, analysisFingerprint, analysisPayload, cacheKey, getCached } from '../composables/useAnalysisQuery'
import { loadAnalysisPrefs, saveAnalysisPrefs } from '../utils/analysisPrefs'
import { withLineThresholds } from '../utils/alarmRules'

use([CanvasRenderer, LineChart, ScatterChart, GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent])

const METRIC_META = [
  { key: 'arc', label: '燃弧', unit: 'ms', color: '#64748b', hitColor: '#b91c1c', zeroFill: true, yMin: 0, group: 'contact' },
  { key: 'hard', label: '硬点', unit: 'g', color: '#64748b', hitColor: '#c2410c', zeroFill: true, yMin: 0, group: 'contact' },
  { key: 'height', label: '导高', unit: 'mm', color: '#64748b', hitColor: '#1d4ed8', group: 'geometry' },
  { key: 'stagger', label: '拉出值', unit: 'mm', color: '#64748b', hitColor: '#7c3aed', group: 'geometry' },
  { key: 'pressure', label: '接触压力', unit: 'N', color: '#64748b', hitColor: '#b45309', group: 'geometry' },
  { key: 'voltage', label: '网压', unit: 'V', color: '#0f766e', hitColor: '#0f766e', group: 'electrical' },
  { key: 'current', label: '电流', unit: 'A', color: '#0f766e', hitColor: '#0f766e', group: 'electrical' },
  { key: 'temperature', label: '温度', unit: '℃', color: '#b45309', hitColor: '#b91c1c', group: 'electrical' },
  { key: 'speed', label: '速度', unit: 'km/h', color: '#64748b', hitColor: '#334155', yMin: 0, group: 'other' },
  { key: 'wear', label: '磨耗', unit: 'mm', color: '#64748b', hitColor: '#57534e', group: 'other' },
  { key: 'wear_width', label: '磨耗宽度', unit: 'mm', color: '#64748b', hitColor: '#57534e', group: 'other' },
]

const CHART_PRESETS = {
  common: ['arc', 'hard', 'height', 'stagger', 'voltage'],
  contact: ['arc', 'hard'],
  all: METRIC_META.map((m) => m.key),
}

export default {
  name: 'PoleBaselinePage',
  components: { VChart },
  props: {
    lineId: String,
    lineName: String,
    direction: { type: String, default: '上行' },
    selectedDates: { type: Array, default: () => [] },
    dateRange: { type: Array, default: () => null },
    isDark: Boolean,
    manualBatch: { type: Boolean, default: false },
    batchByDate: { type: Object, default: () => ({}) },
    batchesByDate: { type: Object, default: () => ({}) },
    navigateContext: { type: Object, default: () => ({}) },
  },
  setup(props) {
    const result = ref(null)
    const selectedPole = ref('')
    const poleQuery = ref('')
    const compareMode = ref('all_groups')
    const minAppearRatePct = ref('50')
    const prefs = loadAnalysisPrefs()
    const allowedChartKeys = new Set(METRIC_META.map((m) => m.key))
    const visibleChartKeys = ref(
      (prefs.poleChartKeys || CHART_PRESETS.common).filter((k) => allowedChartKeys.has(k)),
    )
    if (!visibleChartKeys.value.length) visibleChartKeys.value = [...CHART_PRESETS.common]

    const chartCatalog = METRIC_META

    function hasMultiGroupSelection(raw) {
      return Object.values(raw || {}).some((ids) => (Array.isArray(ids) ? ids : []).length > 1)
    }

    const poles = computed(() => result.value?.poles || [])

    const filteredPoles = computed(() => {
      const q = (poleQuery.value || '').trim().toLowerCase()
      const raw = String(minAppearRatePct.value ?? '').trim()
      const minPct = raw === '' ? 0 : Number(raw)
      const minRate = Number.isFinite(minPct) ? Math.max(0, minPct) / 100 : 0
      const rows = poles.value.filter((p) => {
        if (arcAppearRate(p) < minRate - 1e-9) return false
        if (q) {
          const hay = `${p.pole_no || ''} ${p.station || ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      return [...rows].sort((a, b) => {
        const d = arcAppearRate(b) - arcAppearRate(a)
        if (d) return d
        const ad = Number(a?.metrics?.arc?.appear_days || 0) - Number(b?.metrics?.arc?.appear_days || 0)
        return -ad
      })
    })

    const selected = computed(() => {
      const key = selectedPole.value
      if (!key) return null
      return filteredPoles.value.find((p) => p.pole_no === key)
        || poles.value.find((p) => p.pole_no === key)
        || null
    })

    const missingContextPole = computed(() => {
      const pole = selectedPole.value
      if (!pole || selected.value) return false
      return !!props.navigateContext?.pole_no && String(props.navigateContext.pole_no) === String(pole)
    })

    function arcAppearRate(row) {
      const m = row?.metrics?.arc
      if (m?.appear_rate != null && Number.isFinite(Number(m.appear_rate))) {
        return Number(m.appear_rate)
      }
      const ad = Number(m?.appear_days)
      const td = Number(m?.total_days)
      if (Number.isFinite(ad) && Number.isFinite(td) && td > 0) return ad / td
      return 0
    }
    function fmtRate(v) {
      if (v == null || !Number.isFinite(Number(v))) return '—'
      return `${Math.round(Number(v) * 100)}%`
    }
    function metricAppear(row, key) {
      const m = row?.metrics?.[key]
      if (!m || m.total_days == null) return '—'
      return `${m.appear_days ?? 0}/${m.total_days}组`
    }
    function rowClassName({ row }) {
      return row?.pole_no === selectedPole.value ? 'is-current' : ''
    }
    function onPoleClick(row) {
      if (row?.pole_no) selectedPole.value = row.pole_no
    }

    function chartColors() {
      return {
        text: props.isDark ? '#e6f0ff' : '#1f2d3d',
        muted: props.isDark ? '#8aa0c8' : '#5c6b7f',
        line: props.isDark ? 'rgba(77,166,255,0.25)' : '#d0d7e5',
      }
    }

    function displayValue(meta, p) {
      const v = p?.value
      if (v == null || Number.isNaN(Number(v))) {
        return meta.zeroFill ? 0 : null
      }
      return Number(v)
    }

    function pointLevel(meta, p, y) {
      if (p?.level != null && p.level !== '') return Number(p.level) || 0
      if (y == null) return 0
      if (meta.warn != null) {
        if (meta.severe != null && y > meta.severe) return 2
        if (y > meta.warn) return 1
        return 0
      }
      if (meta.lower != null || meta.upper != null) {
        if (meta.lower != null && y < meta.lower) return 2
        if (meta.upper != null && y > meta.upper) return 2
        if (meta.warnLower != null && y < meta.warnLower) return 1
        if (meta.warnUpper != null && y > meta.warnUpper) return 1
      }
      return 0
    }

    function bandOf(meta) {
      if (meta.bandLow != null && meta.bandHigh != null) {
        return [Number(meta.bandLow), Number(meta.bandHigh)]
      }
      return null
    }

    function rangeText(meta) {
      const b = bandOf(meta)
      if (b) return `基准 ${formatCompactNumber(b[0])}～${formatCompactNumber(b[1])}`
      if (meta.lower != null && meta.upper != null) return `基准 ${formatCompactNumber(meta.lower)}～${formatCompactNumber(meta.upper)}`
      if (meta.upper != null) return `上限 ${formatCompactNumber(meta.upper)}`
      if (meta.lower != null) return `下限 ${formatCompactNumber(meta.lower)}`
      return '无统一包络'
    }

    function formatCompactNumber(v) {
      const n = Number(v)
      if (!Number.isFinite(n)) return ''
      if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n))
      const abs = Math.abs(n)
      if (abs >= 100) return n.toFixed(1)
      if (abs >= 1) return n.toFixed(2)
      return n.toFixed(2)
    }

    function shortDateLabel(p) {
      const tag = String(p?.date || '').replace(/-/g, '').slice(0, 8)
      const md = tag.length === 8 ? `${tag.slice(4, 6)}-${tag.slice(6, 8)}` : String(p?.date_label || p?.date || '')
      const lab = String(p?.date_label || '')
      const g = lab.match(/组\s*(\d+)/)
      return g ? `${md}·${g[1]}` : md
    }

    function miniOption(meta, series) {
      const colors = chartColors()
      const points = series || []
      const labels = points.map((p) => shortDateLabel(p))
      const values = points.map((p) => displayValue(meta, p))
      const levels = points.map((p, i) => pointLevel(meta, p, values[i]))
      const lineColor = meta.color || '#64748b'
      const hitColor = meta.hitColor || '#b91c1c'
      const band = bandOf(meta)
      const nums = values.filter((v) => v != null)
      const markLine = []
      const lineYs = []
      if (band) {
        const edges = Math.abs(band[0]) < 1e-9 ? [band[1]] : band
        lineYs.push(...edges)
      } else {
        if (meta.lower != null) lineYs.push(Number(meta.lower))
        if (meta.upper != null) lineYs.push(Number(meta.upper))
      }
      if (meta.warn != null) lineYs.push(Number(meta.warn))
      if (meta.warnLower != null) lineYs.push(Number(meta.warnLower))
      if (meta.warnUpper != null) lineYs.push(Number(meta.warnUpper))
      const seenY = new Set()
      for (const y of lineYs) {
        if (!Number.isFinite(y) || seenY.has(y)) continue
        seenY.add(y)
        markLine.push({
          yAxis: y,
          label: { show: false },
          lineStyle: { type: 'dashed', color: colors.muted, width: 1 },
        })
      }
      const hitData = values.map((v, i) => {
        if (v == null || levels[i] < 2) return null
        return {
          value: v,
          itemStyle: {
            color: '#991b1b',
            borderColor: '#fff',
            borderWidth: 1.5,
          },
        }
      })
      const yAxis = {
        type: 'value',
        axisLabel: {
          fontSize: 10,
          color: colors.muted,
          hideOverlap: true,
          formatter: (val) => formatCompactNumber(val),
        },
        splitLine: { lineStyle: { color: colors.line } },
      }
      let yMin = nums.length ? Math.min(...nums) : 0
      let yMax = nums.length ? Math.max(...nums) : 1
      if (band) {
        yMin = Math.min(yMin, band[0])
        yMax = Math.max(yMax, band[1])
      }
      if (meta.yMin === 0) yMin = 0
      if (meta.severe != null) yMax = Math.max(yMax, Number(meta.severe))
      const selfBase = points.map((p) => p?.self_baseline).find((v) => v != null && Number.isFinite(Number(v)))
      if (selfBase != null && Number.isFinite(Number(selfBase))) {
        const y = Number(selfBase)
        markLine.push({
          yAxis: y,
          name: '自身基线',
          label: {
            show: true,
            formatter: '自身中位',
            position: 'insideEndTop',
            fontSize: 10,
            color: colors.muted,
          },
          lineStyle: { type: 'dotted', color: '#0f766e', width: 1.5 },
        })
        yMin = Math.min(yMin, y)
        yMax = Math.max(yMax, y)
      }
      const condBase = points.map((p) => p?.cond_baseline).find((v) => v != null && Number.isFinite(Number(v)))
      if (condBase != null && Number.isFinite(Number(condBase))) {
        const y = Number(condBase)
        // 与无条件中位明显不同才画，避免双线重合噪声
        if (selfBase == null || Math.abs(y - Number(selfBase)) > 1e-6) {
          markLine.push({
            yAxis: y,
            name: '条件基线',
            label: {
              show: true,
              formatter: '工况基线',
              position: 'insideEndBottom',
              fontSize: 10,
              color: '#b45309',
            },
            lineStyle: { type: 'dashed', color: '#b45309', width: 1.5 },
          })
          yMin = Math.min(yMin, y)
          yMax = Math.max(yMax, y)
        }
      }
      const pad = (yMax - yMin) === 0 ? 1 : (yMax - yMin) * 0.08
      yAxis.min = yMin - (meta.yMin === 0 ? 0 : pad)
      yAxis.max = yMax + pad
      const rotate = labels.length > 8
      const bandFill = props.isDark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(14, 116, 179, 0.10)'
      return {
        color: [lineColor, hitColor],
        tooltip: {
          trigger: 'axis',
          confine: true,
          formatter: (params) => {
            const list = Array.isArray(params) ? params : [params]
            const line = list.find((x) => x.seriesType === 'line') || list[0]
            const idx = line?.dataIndex ?? 0
            const v = values[idx]
            const lv = levels[idx]
            const lab = labels[idx] || ''
            const shown = v == null ? '—' : `${formatCompactNumber(v)} ${meta.unit}`
            const tag = lv >= 2 ? `<br/><span style="color:${hitColor}">● 超限</span>` : ''
            const rng = band ? `<br/>基准范围 ${formatCompactNumber(band[0])}～${formatCompactNumber(band[1])} ${meta.unit}` : ''
            const baseTxt = selfBase != null ? `<br/>自身中位基线 ${formatCompactNumber(selfBase)} ${meta.unit}` : ''
            const condTxt = condBase != null ? `<br/>工况条件基线 ${formatCompactNumber(condBase)} ${meta.unit}` : ''
            return `${lab}<br/>${meta.label} ${shown}${tag}${rng}${baseTxt}${condTxt}`
          },
        },
        grid: {
          left: 8,
          right: 12,
          top: 14,
          bottom: rotate ? 28 : 16,
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: labels,
          boundaryGap: true,
          axisLabel: {
            fontSize: labels.length > 20 ? 9 : 10,
            color: colors.muted,
            rotate: rotate ? 40 : 0,
            interval: labels.length > 16 ? 'auto' : 0,
            hideOverlap: true,
            margin: 10,
            formatter: (val) => {
              const s = String(val || '')
              return s.length > 8 ? `${s.slice(0, 7)}…` : s
            },
          },
          axisLine: { lineStyle: { color: colors.line } },
        },
        yAxis,
        series: [
          {
            name: meta.label,
            type: 'line',
            smooth: false,
            showSymbol: true,
            symbol: 'circle',
            symbolSize: labels.length > 24 ? 4 : 6,
            connectNulls: false,
            clip: true,
            data: values,
            lineStyle: { width: 1.6, color: lineColor },
            itemStyle: { color: lineColor },
            markLine: markLine.length
              ? { silent: true, symbol: 'none', animation: false, data: markLine }
              : undefined,
            markArea: band
              ? {
                  silent: true,
                  itemStyle: { color: bandFill },
                  data: [[{ yAxis: band[0] }, { yAxis: band[1] }]],
                }
              : undefined,
            z: 2,
          },
          {
            name: '超限',
            type: 'scatter',
            data: hitData,
            symbol: 'circle',
            clip: true,
            symbolSize: 14,
            z: 4,
          },
        ],
      }
    }

    const chartScopeKey = computed(() => {
      const dates = result.value?.window?.dates || props.selectedDates || []
      return `${selected.value?.pole_no || ''}|${dates.join(',')}`
    })

    function withBands(meta) {
      const b = result.value?.bands?.[meta.key] || {}
      return {
        ...meta,
        lower: b.lower,
        upper: b.upper,
        warnLower: b.warn_lower,
        warnUpper: b.warn_upper,
        warn: b.warn_upper,
        severe: b.upper,
        bandLow: b.band_low,
        bandHigh: b.band_high,
        unit: b.unit || meta.unit,
        label: b.label || meta.label,
      }
    }

    const metricCharts = computed(() => {
      const pole = selected.value
      const hardOn = !!result.value?.hard_spot_channel
      const selectedKeys = new Set(visibleChartKeys.value)
      return METRIC_META.filter((raw) => selectedKeys.has(raw.key)).map((raw) => {
        const meta = withBands(raw)
        const disabled = meta.key === 'hard' && !hardOn
        const series = pole?.series?.[meta.key] || []
        return {
          ...meta,
          disabled,
          baselineText: disabled ? '' : rangeText(meta),
          option: disabled ? {} : miniOption(meta, series),
        }
      })
    })

    function persistChartKeys(keys) {
      const next = (keys || []).filter((k) => allowedChartKeys.has(k))
      visibleChartKeys.value = next.length ? next : [...CHART_PRESETS.common]
      saveAnalysisPrefs({ poleChartKeys: visibleChartKeys.value })
    }

    function onChartKeysChange(keys) {
      persistChartKeys(keys)
    }

    function applyChartPreset(name) {
      let keys = CHART_PRESETS[name] ? [...CHART_PRESETS[name]] : [...CHART_PRESETS.common]
      if (!result.value?.hard_spot_channel) {
        keys = keys.filter((k) => k !== 'hard')
        if (name === 'contact' && !keys.length) keys = ['arc']
      }
      persistChartKeys(keys)
    }

    function applyContextPole() {
      const pole = props.navigateContext?.pole_no
      if (pole) selectedPole.value = String(pole)
    }

    const { loading } = useAnalysisQuery({
      fingerprint: () => analysisFingerprint(props, [compareMode.value, JSON.stringify(withLineThresholds({}, props.lineId).thresholds || {})]),
      load: async ({ nextSeq, isStale, start, finish }) => {
        if (!props.lineId || !props.selectedDates?.length) {
          result.value = null
          selectedPole.value = ''
          loading.value = false
          return
        }
        const dates = props.selectedDates || []
        const payload = withLineThresholds(analysisPayload({
          line_id: props.lineId,
          direction: props.direction || '上行',
          dates: dates.map((d) => String(d).replace(/-/g, '').slice(0, 8)),
          compare_mode: compareMode.value,
        }, props), props.lineId)
        const cached = getCached(cacheKey('/pole-baseline', payload))
        if (cached) {
          result.value = cached
          const list = cached.poles || []
          const ctxPole = props.navigateContext?.pole_no
          if (ctxPole) selectedPole.value = String(ctxPole)
          else if (!selectedPole.value && list.length) selectedPole.value = list[0].pole_no
          return
        }
        const seq = nextSeq()
        start(seq)
        try {
          const data = await postPoleBaseline(payload)
          if (isStale(seq)) return
          result.value = data
          const list = data?.poles || []
          const ctxPole = props.navigateContext?.pole_no
          if (ctxPole) {
            selectedPole.value = String(ctxPole)
          } else if (!list.some((p) => p.pole_no === selectedPole.value)) {
            selectedPole.value = list[0]?.pole_no || ''
          }
          if (data?.window?.capped) {
            ElMessage.info(`所选 ${data.window.requested} 个检测日超过上限，本次评估最近 ${data.window.resolved} 日`)
          }
        } catch (e) {
          if (isStale(seq)) return
          ElMessage.error(e?.response?.data?.detail || e.message || '杆号评估失败')
        } finally {
          finish(seq)
        }
      },
    })

    watch(
      () => hasMultiGroupSelection(props.batchesByDate),
      (multi, wasMulti) => {
        if (multi && !wasMulti) compareMode.value = 'all_groups'
      },
      { immediate: true },
    )

    watch(filteredPoles, (list) => {
      if (selectedPole.value && list.some((p) => p.pole_no === selectedPole.value)) return
      if (props.navigateContext?.pole_no && String(props.navigateContext.pole_no) === String(selectedPole.value)) return
      selectedPole.value = list[0]?.pole_no || selectedPole.value
    })

    watch(
      () => props.navigateContext,
      () => applyContextPole(),
      { immediate: true, deep: true },
    )

    return {
      loading,
      result,
      poleQuery,
      compareMode,
      minAppearRatePct,
      filteredPoles,
      selected,
      selectedPole,
      missingContextPole,
      chartCatalog,
      visibleChartKeys,
      metricCharts,
      chartScopeKey,
      onChartKeysChange,
      applyChartPreset,
      fmtRate,
      arcAppearRate,
      metricAppear,
      rowClassName,
      onPoleClick,
    }
  },
}
</script>

<style scoped>
.page {
  padding: 8px 4px 28px;
  width: 100%;
  box-sizing: border-box;
}
.page-head {
  margin-bottom: 12px;
}
.page-title {
  margin: 0 0 6px;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--om-text);
}
.page-sub {
  margin: 0;
  font-size: 0.85rem;
  color: var(--om-text-muted);
}
.page-sub.warn { color: var(--om-warning); }
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 4px 0 14px;
}
.kpi-card {
  background: var(--om-panel, rgba(0, 0, 0, 0.03));
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid var(--om-border, rgba(0, 0, 0, 0.06));
}
.kpi-card.muted .kpi-val { color: var(--om-text-dim); }
.kpi-name {
  font-size: 12px;
  color: var(--om-text-dim);
}
.kpi-val {
  margin-top: 4px;
  font-size: 22px;
  font-weight: 700;
  color: var(--om-text);
}
.kpi-sub {
  margin-top: 2px;
  font-size: 11px;
  color: var(--om-text-dim);
}
.work-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.95fr) minmax(360px, 1.15fr);
  gap: 14px;
  align-items: start;
}
.pole-panel,
.detail-panel {
  padding: 14px 16px 16px;
  min-height: 420px;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.panel-title {
  font-weight: 650;
  color: var(--om-text);
}
.panel-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--om-text-dim);
}
.panel-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pole-table { width: 100%; }
.empty-tip {
  margin: 24px 0;
  text-align: center;
  color: var(--om-text-dim);
  font-size: 13px;
}
.detail-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 12px;
}
.detail-pole {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--om-text);
}
.detail-meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--om-text-dim);
}
.chart-cap {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--om-text-dim);
}
.chart-picker {
  margin: 0 0 10px;
  padding: 8px 10px;
  border: 1px solid var(--om-border, rgba(0, 0, 0, 0.06));
  border-radius: 8px;
  background: var(--om-panel, rgba(0, 0, 0, 0.02));
}
.chart-picker-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.chart-picker-label {
  flex: 0 0 auto;
  margin-top: 4px;
  font-size: 12px;
  color: var(--om-text-dim);
}
.chart-picker-row :deep(.el-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 4px;
}
.chart-picker-row :deep(.el-checkbox) {
  margin-right: 8px;
  height: 24px;
}
.chart-picker-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  padding-left: 32px;
}
.chart-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-width: 0;
}
.chart-grid.single {
  grid-template-columns: 1fr;
}
.chart-grid.compact .mini-canvas {
  height: 140px;
}
.mini-chart {
  border: 1px solid var(--om-border, rgba(0, 0, 0, 0.06));
  border-radius: 8px;
  padding: 8px 8px 4px;
  overflow: hidden;
  min-width: 0;
}
.mini-chart.dim {
  min-height: 88px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.mini-title {
  font-size: 12px;
  font-weight: 650;
  color: var(--om-text);
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}
.mini-title small {
  font-weight: 400;
  color: var(--om-text-dim);
  white-space: nowrap;
}
.mini-base {
  overflow: hidden;
  text-overflow: ellipsis;
}
.mini-off {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  color: var(--om-text-dim);
}
.mini-canvas {
  width: 100%;
  height: 168px;
  overflow: hidden;
}
.empty-detail {
  display: flex;
  align-items: center;
  justify-content: center;
}
:deep(.el-table__row) { cursor: pointer; }
:deep(.el-table .is-current) {
  --el-table-tr-bg-color: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}
@media (max-width: 1100px) {
  .kpi-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .work-grid { grid-template-columns: 1fr; }
}
</style>
