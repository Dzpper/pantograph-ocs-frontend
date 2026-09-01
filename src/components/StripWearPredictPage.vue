<template>
  <div class="predict-page" v-loading="loading">
    <div class="page-head">
      <h2 class="page-title">碳滑板磨耗预测</h2>
      <p class="page-sub">按最薄板到限估算可用时间；偏磨/异常磨耗会压缩天数（仅分析，处置由业主决定）</p>
    </div>

    <div class="om-panel om-toolbar">
      <div class="om-toolbar-field">
        <span class="om-toolbar-label">线路</span>
        <el-select v-model="lineCode" class="om-select-line" @change="onSharedFilterChange">
          <el-option
            v-for="l in lines"
            :key="l.line_code"
            :label="formatLineName(l.line_name, l.line_code)"
            :value="l.line_code"
          >
            <span>{{ formatLineName(l.line_name, l.line_code) }}</span>
            <span class="om-option-extra">{{ l.measurement_count || 0 }} 条</span>
          </el-option>
        </el-select>
      </div>
      <div class="om-toolbar-field">
        <span class="om-toolbar-label">车辆</span>
        <el-select
          v-model="vehicleNos"
          multiple
          collapse-tags
          collapse-tags-tooltip
          clearable
          placeholder="全部车辆"
          style="width: 180px"
        >
          <el-option v-for="v in vehicles" :key="v" :label="v" :value="v" />
        </el-select>
      </div>
      <div class="om-toolbar-field">
        <span class="om-toolbar-label">日期范围</span>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          class="om-date-range"
          clearable
          @change="persistShared"
        />
      </div>
      <div class="om-toolbar-field">
        <span class="om-toolbar-label">限厚线</span>
        <el-input-number
          v-model="minThickness"
          :min="0.1"
          :step="0.5"
          :precision="1"
          style="width: 110px"
          @change="onMinThicknessChange"
        />
        <span class="om-toolbar-label">mm</span>
      </div>
      <span class="shared-hint">与看板共用选线/日期；限厚线默认 5 mm，修改后自动重算</span>
      <div class="om-toolbar-actions">
        <el-button type="primary" @click="load">计算</el-button>
      </div>
    </div>

    <template v-if="data && !data.empty">
      <p v-if="skippedHint" class="hint-line">{{ skippedHint }}</p>

      <div class="kpi-row">
        <div class="kpi" :class="{ alert: (summary.urgent_count || 0) > 0 }">
          <div class="kpi-label">需关注</div>
          <div class="kpi-value">{{ summary.urgent_count || 0 }} <small>辆</small></div>
          <div class="kpi-sub">已到限 {{ summary.need_replace_count || 0 }} · 异常 {{ summary.abnormal_count || 0 }}</div>
        </div>
        <div class="kpi" :class="{ warn: ((summary.uneven_replace_count || 0) + (summary.uneven_watch_count || 0)) > 0 }">
          <div class="kpi-label">偏磨车辆</div>
          <div class="kpi-value">{{ (summary.uneven_replace_count || 0) + (summary.uneven_watch_count || 0) }} <small>辆</small></div>
          <div class="kpi-sub">偏磨 {{ summary.uneven_replace_count || 0 }} · 关注 {{ summary.uneven_watch_count || 0 }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">最短可用</div>
          <div class="kpi-value">{{ minRulText }}</div>
          <div class="kpi-sub">{{ summary.min_rul_vehicle || minRulVehicle }} · 共 {{ data.vehicle_count }} 辆</div>
        </div>
      </div>

      <div class="om-panel table-panel">
        <div class="panel-title">评估结果 · 偏磨/红橙行优先 · 点击查看双弓与曲线</div>
        <el-table
          :data="data.predictions"
          size="small"
          stripe
          height="300"
          highlight-current-row
          @row-click="(row) => (selectedVehicle = row.vehicle_no)"
          :row-class-name="rowClass"
        >
          <el-table-column prop="vehicle_no" label="车号" width="80" fixed />
          <el-table-column prop="status" label="状态" width="88">
            <template #default="{ row }">
              <span :class="statusClass(row.status)">{{ row.status }}</span>
            </template>
          </el-table-column>
          <el-table-column label="2车弓" width="78">
            <template #default="{ row }">{{ fmt(row.bow2_avg, 1) }}</template>
          </el-table-column>
          <el-table-column label="5车弓" width="78">
            <template #default="{ row }">{{ fmt(row.bow5_avg, 1) }}</template>
          </el-table-column>
          <el-table-column label="最薄板" width="100">
            <template #default="{ row }">
              {{ row.governing_strip || '—' }} {{ row.current_min_height != null ? fmt(row.current_min_height, 1) : '' }}
            </template>
          </el-table-column>
          <el-table-column label="偏磨" width="88">
            <template #default="{ row }">
              <span :class="{ danger: row.uneven }">{{ row.uneven ? (row.uneven_level || '偏磨') : '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="预计可用" width="88">
            <template #default="{ row }">
              <span :class="rulClass(row)">{{ row.rul_days == null ? '—' : row.rul_days + ' 天' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="剩余公里" width="96">
            <template #default="{ row }">{{ row.remaining_km == null ? '—' : fmt(row.remaining_km, 0) }}</template>
          </el-table-column>
          <el-table-column prop="advice" label="说明" min-width="160" show-overflow-tooltip />
        </el-table>
      </div>

      <div class="charts" v-if="selected">
        <div class="om-panel chart-panel">
          <div class="panel-title">
            {{ selected.vehicle_no }} · {{ topoSummary }}厚度
            <span class="title-meta" v-if="selected.uneven">
              {{ selected.uneven_level }} · {{ selected.uneven_target || '' }}
            </span>
          </div>
          <div class="bow-cards" v-if="selectedBows.length">
            <div
              v-for="bow in selectedBows"
              :key="bow.id"
              class="bow-card"
              :class="{ alert: selected.uneven_target && String(selected.uneven_target).includes(bow.label) }"
            >
              <div class="bow-name">{{ bow.label }}</div>
              <div class="bow-avg">均值 {{ fmt(bow.avg, 1) }} mm</div>
              <div class="bow-strips">
                {{ (bow.thicknesses || []).map((t, i) => `板${i + 1} ${fmt(t, 1)}`).join(' · ') }}
              </div>
            </div>
            <div class="bow-action">
              <el-button type="primary" @click="goRegisterReplace">登记换板</el-button>
              <div class="bow-action-hint">{{ selected.replace_hint || '暂无明显偏磨' }}</div>
            </div>
          </div>
          <v-chart class="chart-canvas chart-short" :option="stripOption" autoresize />
        </div>
        <div class="om-panel chart-panel">
          <div class="panel-title">
            {{ selected.vehicle_no }} · 厚度走势
            <span class="title-meta">
              最薄 {{ selected.governing_strip || '' }} {{ fmt(selected.current_min_height, 1) }} mm ·
              续航约 {{ selected.rul_days == null ? '—' : selected.rul_days + ' 天' }}
              <template v-if="selected.remaining_km != null">（约 {{ fmt(selected.remaining_km, 0) }} 公里）</template>
            </span>
          </div>
          <v-chart class="chart-canvas" :option="thicknessOption" autoresize />
        </div>
      </div>
    </template>

    <div v-else-if="!loading" class="om-panel empty-card">
      <p>{{ data?.message || '请选择线路后点击「计算」。' }}</p>
      <p v-if="skippedHint" class="hint-line">{{ skippedHint }}</p>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch, inject } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import {
  fetchStripWearLines,
  fetchStripWearVehicles,
  postStripWearPredict,
} from '../api/client'
import { loadStripPrefs, saveStripPrefs, defaultStripDateRange, clampMinThickness } from '../utils/stripPrefs'
import { coerceLineCode, formatLineName } from '../utils/lineDisplay'
import { resolveTopology, slotValue, stripColor } from '../utils/stripTopology'

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent])

function fmt(v, digits = 1) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toFixed(digits)
}

const URGENT = new Set(['已到限', '偏磨', '异常磨耗', '需更换', '偏磨换板', '需立即更换', '异常磨耗预警'])
const SOON = new Set(['剩余偏紧', '磨耗加快', '偏磨关注', '尽快安排', '建议尽快安排'])
const WATCH = new Set(['需关注', '纳入计划关注'])

export default {
  name: 'StripWearPredictPage',
  components: { VChart },
  props: {
    navigateContext: { type: Object, default: () => ({}) },
  },
  emits: ['navigate'],
  setup(props, { emit }) {
    const navigateTo = inject('navigateTo', null)
    const ctx = () => props.navigateContext || {}
    const loading = ref(false)
    const lines = ref([])
    const prefs0 = loadStripPrefs()
    const lineCode = ref(prefs0.lineCode || '')
    const vehicles = ref([])
    const vehicleNos = ref([])
    const dateRange = ref(prefs0.dateRange || defaultStripDateRange())
    const minThickness = ref(clampMinThickness(prefs0.minThickness))
    const data = ref(null)
    const selectedVehicle = ref('')

    function persistShared() {
      minThickness.value = clampMinThickness(minThickness.value)
      saveStripPrefs({
        lineCode: lineCode.value,
        dateRange: dateRange.value,
        minThickness: minThickness.value,
      })
    }

    function onMinThicknessChange(val) {
      minThickness.value = clampMinThickness(val)
      persistShared()
      load()
    }

    async function onSharedFilterChange() {
      persistShared()
      await onLineChange()
      await load()
    }

    const selected = computed(() =>
      (data.value?.predictions || []).find((p) => p.vehicle_no === selectedVehicle.value)
      || data.value?.predictions?.[0]
      || null
    )

    const currentTopo = computed(() => resolveTopology(data.value || selected.value))
    const topoSummary = computed(() => currentTopo.value.summary || '双弓多板')
    const selectedBows = computed(() => {
      const p = selected.value
      if (!p) return []
      if (Array.isArray(p.bows) && p.bows.length) return p.bows
      return [
        { id: 'bow2', label: '2车弓', avg: p.bow2_avg, thicknesses: [p.thick_car2, p.thick_col1] },
        { id: 'bow5', label: '5车弓', avg: p.bow5_avg, thicknesses: [p.thick_car5, p.thick_col2] },
      ].filter((b) => b.avg != null || (b.thicknesses || []).some((t) => t != null))
    })

    const summary = computed(() => data.value?.summary || {})

    const statusTone = computed(() => {
      if ((summary.value.urgent_count || 0) > 0) return 'tone-danger'
      if ((summary.value.soon_count || 0) + (summary.value.watch_count || 0) + (summary.value.uneven_watch_count || 0) > 0) return 'tone-warn'
      return 'tone-ok'
    })

    const statusText = computed(() => {
      if (!data.value || data.value.empty) return ''
      const s = summary.value
      const n = data.value.vehicle_count
      const skipped = data.value.skipped_count || s.skipped_count || 0
      const skipTxt = skipped > 0 ? `（另有 ${skipped} 辆因短里程/样本不足未预测）` : ''
      const unevenN = (s.uneven_replace_count || 0) + (s.uneven_watch_count || 0)
      if ((s.urgent_count || 0) > 0) {
        return `共 ${n} 辆纳入预测：${s.urgent_count} 辆需关注${unevenN ? `（含偏磨 ${unevenN}）` : ''}${skipTxt}`
      }
      if ((s.soon_count || 0) + (s.watch_count || 0) + unevenN > 0) {
        return `共 ${n} 辆纳入预测：有近期关注车辆${skipTxt}`
      }
      return `共 ${n} 辆纳入预测，整体正常${skipTxt}`
    })

    const skippedHint = computed(() => {
      const list = data.value?.skipped || []
      if (!list.length) return ''
      return `未预测：${list.map((s) => `${s.vehicle_no}（${s.reason}）`).join('；')}`
    })

    const minRulText = computed(() => {
      if (summary.value.min_rul_days != null) return `${summary.value.min_rul_days} 天`
      const nums = (data.value?.predictions || []).map((p) => p.rul_days).filter((v) => v != null)
      if (!nums.length) return '—'
      return `${Math.min(...nums)} 天`
    })

    const minRulVehicle = computed(() => {
      if (summary.value.min_rul_vehicle) return summary.value.min_rul_vehicle
      const list = (data.value?.predictions || []).filter((p) => p.rul_days != null)
      if (!list.length) return '—'
      return list.reduce((a, b) => (a.rul_days <= b.rul_days ? a : b)).vehicle_no
    })

    const stripOption = computed(() => {
      const p = selected.value
      const hist = p?.strip_history || []
      const topo = resolveTopology(data.value || p)
      const slots = topo.slots || []
      if (!hist.length) {
        if (!p) return {}
        return {
          tooltip: { trigger: 'axis' },
          grid: { left: 48, right: 12, top: 16, bottom: 28 },
          xAxis: { type: 'category', data: slots.map((s) => s.label) },
          yAxis: { type: 'value', name: 'mm', min: 0, scale: true },
          series: [{
            type: 'bar',
            barMaxWidth: 36,
            data: slots.map((slot, idx) => ({
              value: slotValue(p, slot),
              itemStyle: { color: stripColor(idx) },
            })),
            markLine: {
              symbol: 'none',
              data: [{ yAxis: p.min_thickness_mm || minThickness.value }],
              lineStyle: { color: '#e85d6a', type: 'dashed' },
              label: { formatter: '限厚线', fontSize: 10 },
            },
          }],
        }
      }
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: slots.map((s) => s.label), top: 0, textStyle: { fontSize: 11 } },
        grid: { left: 44, right: 12, top: 28, bottom: 36 },
        xAxis: {
          type: 'category',
          data: hist.map((h) => h.date),
          axisLabel: { rotate: 30, fontSize: 10 },
        },
        yAxis: { type: 'value', name: 'mm', min: 0, scale: true },
        series: slots.map((slot, idx) => ({
          name: slot.label,
          type: 'line',
          data: hist.map((h) => slotValue(h, slot)),
          symbolSize: 4,
          itemStyle: { color: stripColor(idx) },
        })),
      }
    })

    const thicknessOption = computed(() => {
      const p = selected.value
      if (!p || !p.history?.length) return {}
      const histDates = p.history.map((h) => h.date)
      const histVals = p.history.map((h) => h.avg_height)
      const forecast = p.forecast || []
      const allDates = [...histDates]
      for (const f of forecast) {
        if (!allDates.includes(f.date)) allDates.push(f.date)
      }
      const histSeries = allDates.map((d) => {
        const idx = histDates.indexOf(d)
        return idx >= 0 ? histVals[idx] : null
      })
      const forecastSeries = allDates.map((d) => {
        const f = forecast.find((x) => x.date === d)
        return f ? f.predicted_avg_height : null
      })
      const lastHist = histDates[histDates.length - 1]
      const joinIdx = allDates.indexOf(lastHist)
      if (joinIdx >= 0) forecastSeries[joinIdx] = histVals[histVals.length - 1]

      return {
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v) => (v == null ? '—' : `${Number(v).toFixed(1)} mm`),
        },
        legend: { data: ['实测', '预估'], top: 0, textStyle: { fontSize: 11 } },
        grid: { left: 44, right: 12, top: 28, bottom: 36 },
        xAxis: { type: 'category', data: allDates, axisLabel: { rotate: 30, fontSize: 10 } },
        yAxis: { type: 'value', name: 'mm', min: 0, scale: true },
        series: [
          {
            name: '实测',
            type: 'line',
            data: histSeries,
            connectNulls: false,
            symbolSize: 6,
            lineStyle: { width: 2.5 },
            itemStyle: { color: '#3488d9' },
          },
          {
            name: '预估',
            type: 'line',
            data: forecastSeries,
            connectNulls: true,
            symbol: 'none',
            lineStyle: { type: 'dashed', width: 2, color: '#e8a84a' },
            markLine: {
              symbol: 'none',
              data: [{
                yAxis: p.min_thickness_mm || minThickness.value,
                label: { formatter: '限厚线', fontSize: 10, color: '#e85d6a' },
                lineStyle: { color: '#e85d6a', type: 'dashed', width: 1.5 },
              }],
            },
          },
        ],
      }
    })

    const rateOption = computed(() => {
      const p = selected.value
      const hist = p?.rate_history || []
      if (!hist.length) return {}
      const normal = p.normal_rate_per_10k
      return {
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v) => (v == null ? '—' : `${Number(v).toFixed(1)}`),
        },
        grid: { left: 44, right: 12, top: 16, bottom: 36 },
        xAxis: {
          type: 'category',
          data: hist.map((h) => h.date),
          axisLabel: { rotate: 30, fontSize: 10 },
        },
        yAxis: { type: 'value', name: 'mm/万公里' },
        series: [{
          type: 'bar',
          barMaxWidth: 28,
          data: hist.map((h) => ({
            value: h.rate_per_10k,
            itemStyle: {
              color: h.abnormal || h.rate_per_10k >= 2 ? '#e85d6a' : '#3488d9',
            },
          })),
          markLine: {
            symbol: 'none',
            data: [
              ...(normal != null ? [{
                yAxis: normal,
                label: { formatter: '常态', fontSize: 10 },
                lineStyle: { color: '#3dbfad', type: 'dashed' },
              }] : []),
              {
                yAxis: 2,
                label: { formatter: '2.0', fontSize: 10 },
                lineStyle: { color: '#e8a84a', type: 'dotted' },
              },
            ],
          },
        }],
      }
    })

    async function loadLines() {
      lines.value = await fetchStripWearLines()
      const fromCtx = ctx().lineCode
      if (fromCtx) lineCode.value = fromCtx
      lineCode.value = coerceLineCode(lineCode.value, lines.value)
      if (!lineCode.value && lines.value.length) {
        const withData = lines.value.find((l) => (l.measurement_count || 0) > 0)
        lineCode.value = (withData || lines.value[0]).line_code
      }
      if (!dateRange.value) dateRange.value = defaultStripDateRange()
      persistShared()
      if (ctx().vehicleNos?.length) vehicleNos.value = [...ctx().vehicleNos]
    }

    async function onLineChange() {
      vehicles.value = lineCode.value ? await fetchStripWearVehicles(lineCode.value) : []
      vehicleNos.value = vehicleNos.value.filter((v) => vehicles.value.includes(v))
    }

    async function load() {
      if (!lineCode.value) return
      persistShared()
      loading.value = true
      try {
        data.value = await postStripWearPredict({
          line_code: lineCode.value,
          vehicle_nos: vehicleNos.value,
          date_from: dateRange.value?.[0] || '',
          date_to: dateRange.value?.[1] || '',
          min_thickness_mm: minThickness.value,
          horizon_days: 90,
          x_axis: 'km',
        })
        selectedVehicle.value = data.value?.predictions?.[0]?.vehicle_no || ''
      } catch (e) {
        data.value = { empty: true, message: e?.response?.data?.detail || e.message }
      } finally {
        loading.value = false
      }
    }

    function statusClass(status) {
      if (URGENT.has(status)) return 'danger'
      if (SOON.has(status)) return 'warn'
      return ''
    }

    function rowClass({ row }) {
      if (URGENT.has(row.status)) return 'row-danger'
      if (SOON.has(row.status)) return 'row-warn'
      return ''
    }

    function rulClass(row) {
      if (URGENT.has(row.status) || SOON.has(row.status)) return 'danger'
      if (WATCH.has(row.status)) return 'warn'
      return ''
    }

    function goRegisterReplace() {
      const nav = {
        center: 'strip-wear',
        page: 'strip-import',
        context: {
          lineCode: lineCode.value,
          vehicleNo: selected.value?.vehicle_no,
          markReplace: true,
          unevenTarget: selected.value?.uneven_target || '',
        },
      }
      if (navigateTo) navigateTo(nav)
      else emit('navigate', nav)
    }

    watch(
      () => props.navigateContext,
      async (nav) => {
        if (!nav || !Object.keys(nav).length) return
        if (nav.lineCode) lineCode.value = nav.lineCode
        if (nav.vehicleNos?.length) vehicleNos.value = [...nav.vehicleNos]
        await onLineChange()
        await load()
      },
    )

    onMounted(async () => {
      await loadLines()
      await onLineChange()
      await load()
    })

    return {
      loading, lines, lineCode, vehicles, vehicleNos, dateRange,
      minThickness, data, selectedVehicle, selected, summary,
      topoSummary, selectedBows,
      statusTone, statusText, skippedHint, minRulText, minRulVehicle,
      stripOption, thicknessOption,
      fmt, load, onLineChange, onSharedFilterChange, onMinThicknessChange, persistShared,
      statusClass, rowClass, rulClass, goRegisterReplace, formatLineName,
    }
  },
}
</script>

<style scoped>
.predict-page {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}
.shared-hint {
  font-size: 12px;
  color: var(--om-text-dim);
  align-self: center;
}
.page-head { margin-bottom: 4px; }
.page-title { margin: 0; font-size: 18px; font-weight: 650; color: var(--om-text); }
.page-sub { margin: 4px 0 0; color: var(--om-text-muted); font-size: 13px; }
.status-line {
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid var(--om-panel-border);
  background: var(--om-panel);
}
.status-line.tone-ok { border-left: 3px solid var(--om-success); }
.status-line.tone-warn {
  border-left: 3px solid var(--om-warning);
  background: rgba(232, 168, 74, 0.08);
}
.status-line.tone-danger {
  border-left: 3px solid var(--om-danger);
  background: rgba(232, 93, 106, 0.08);
}
.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.kpi {
  border: 1px solid var(--om-panel-border);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--om-panel);
  min-width: 0;
}
.kpi.alert { border-color: rgba(232, 93, 106, 0.45); }
.kpi.warn { border-color: rgba(232, 168, 74, 0.45); }
.kpi-label { font-size: 12px; color: var(--om-text-muted); margin-bottom: 4px; }
.kpi-value { font-size: 22px; font-weight: 700; line-height: 1.2; color: var(--om-text); }
.kpi-value small { font-size: 12px; font-weight: 500; color: var(--om-text-muted); }
.kpi-sub { margin-top: 4px; font-size: 12px; color: var(--om-text-muted); }
.table-panel, .chart-panel { padding: 12px 14px; min-width: 0; }
.panel-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; color: var(--om-text); }
.title-meta { font-weight: 400; color: var(--om-text-muted); margin-left: 8px; }
.hint-line {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--om-text-dim);
  line-height: 1.5;
}
.muted { color: var(--om-text-dim); }
.charts {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 12px;
  margin-top: 12px;
}
.chart-canvas { width: 100%; height: 250px !important; }
.chart-short { height: 200px !important; }
.bow-cards {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 10px;
  margin-bottom: 10px;
}
.bow-card {
  border: 1px solid var(--om-panel-border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--om-bg-2);
}
.bow-card.alert { border-color: rgba(232, 93, 106, 0.5); background: rgba(232, 93, 106, 0.06); }
.bow-name { font-weight: 650; font-size: 13px; }
.bow-avg { margin-top: 4px; font-size: 16px; font-weight: 700; }
.bow-strips { margin-top: 4px; font-size: 12px; color: var(--om-text-muted); }
.bow-action { display: flex; flex-direction: column; justify-content: center; gap: 6px; min-width: 120px; }
.bow-action-hint { font-size: 12px; color: var(--om-text-dim); line-height: 1.4; max-width: 180px; }
.danger { color: var(--om-danger); font-weight: 600; }
.warn { color: var(--om-warning); font-weight: 600; }
.empty-card { padding: 32px; text-align: center; color: var(--om-text-muted); }
:deep(.row-danger) { --el-table-tr-bg-color: rgba(232, 93, 106, 0.08); }
:deep(.row-warn) { --el-table-tr-bg-color: rgba(232, 168, 74, 0.08); }
@media (max-width: 1000px) {
  .kpi-row, .charts, .bow-cards { grid-template-columns: 1fr; }
}
</style>
