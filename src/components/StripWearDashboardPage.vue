<template>
  <div class="wear-dash" v-loading="loading">
    <div class="page-head">
      <div>
        <h2 class="page-title">碳滑板磨耗看板</h2>
        <p class="page-sub" v-if="data && !data.empty">
          {{ dashboardLineTitle }} · {{ data.date_from }} ~ {{ data.date_to }} · 一眼看清磨耗水平与高风险车
        </p>
        <p class="page-sub" v-else>选择线路后查看全线磨耗概况</p>
      </div>
    </div>

    <div class="om-panel om-toolbar">
      <div class="om-toolbar-field">
        <span class="om-toolbar-label">线路</span>
        <el-select v-model="lineCode" class="om-select-line" @change="onFilterChange">
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
          @change="onFilterChange"
        />
      </div>
      <span class="shared-hint">与「可用预估」共用选线/日期，默认近半年</span>
      <div class="om-toolbar-actions">
        <el-button type="primary" @click="load">刷新</el-button>
        <el-button @click="goPredict">去预测</el-button>
      </div>
    </div>

    <template v-if="data && !data.empty">
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-label">全线磨耗率</div>
          <div class="kpi-value">{{ fmt(data.kpi.fleet_wear_rate_per_10k, 4) }} <small>mm/万公里</small></div>
          <div class="kpi-sub">最新检测 {{ data.kpi.latest_date || '—' }}</div>
        </div>
        <div class="kpi" :class="{ alert: data.kpi.high_wear_vehicle_count > 0 }">
          <div class="kpi-label">高磨耗车辆</div>
          <div class="kpi-value">{{ data.kpi.high_wear_vehicle_count }} <small>辆 ≥2.0</small></div>
          <div class="kpi-sub">在测 {{ data.kpi.vehicle_count }} 辆</div>
        </div>
        <div class="kpi" :class="{ alert: (data.kpi.uneven_vehicle_count || 0) > 0 }">
          <div class="kpi-label">偏磨车辆</div>
          <div class="kpi-value">{{ data.kpi.uneven_vehicle_count || 0 }} <small>辆</small></div>
          <div class="kpi-sub">双弓四板厚度差偏大</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">换板记录</div>
          <div class="kpi-value">{{ data.kpi.replace_count }} <small>次</small></div>
          <div class="kpi-sub">测点 {{ data.kpi.measurement_count }} 条</div>
        </div>
      </div>

      <div class="charts">
        <div class="om-panel chart-panel">
          <div class="panel-title">各日万公里磨耗</div>
          <v-chart class="chart-canvas" :option="trendOption" autoresize />
        </div>
        <div class="om-panel chart-panel">
          <div class="panel-title">各车累计万公里磨耗（累计公里≥5000）</div>
          <v-chart class="chart-canvas" :option="vehicleRateOption" autoresize @click="onChartClick" />
        </div>
      </div>

      <div class="charts detail-charts">
        <div class="om-panel chart-panel">
          <div class="panel-title">各车最新厚度 · 点击选择单车曲线</div>
          <v-chart class="chart-canvas" :option="heightOption" autoresize @click="onChartClick" />
        </div>
        <div class="om-panel chart-panel">
          <div class="panel-title">双弓厚度对比（2车弓 / 5车弓）· 点击选择单车曲线</div>
          <v-chart class="chart-canvas" :option="bowCompareOption" autoresize @click="onChartClick" />
        </div>
      </div>

      <div class="om-panel vehicle-trend-panel" v-loading="vehicleTrendLoading">
        <div class="vehicle-trend-head">
          <div class="panel-title">单车磨耗曲线</div>
          <div class="vehicle-trend-toolbar">
            <span class="om-toolbar-label">车号</span>
            <el-select
              v-model="selectedVehicle"
              filterable
              placeholder="选择车辆"
              style="width: 140px"
              @change="loadVehicleTrend"
            >
              <el-option
                v-for="v in vehicleOptions"
                :key="v.vehicle_no"
                :label="v.vehicle_no"
                :value="v.vehicle_no"
              />
            </el-select>
            <el-button
              v-if="selectedVehicle"
              link
              type="primary"
              @click="goPredictVehicle(selectedVehicle)"
            >
              去可用预估
            </el-button>
            <span class="vehicle-trend-meta" v-if="vehicleTrend && !vehicleTrend.empty">
              当前周期 {{ vehicleTrend.date_from }} ~ {{ vehicleTrend.date_to }}
              <template v-if="vehicleTrend.cumulative_km != null"> · 累计 {{ vehicleTrend.cumulative_km }} km</template>
              <template v-if="vehicleTrend.uneven"> · {{ vehicleTrend.uneven_level || '偏磨' }}</template>
            </span>
          </div>
        </div>
        <template v-if="vehicleTrend && !vehicleTrend.empty">
          <div class="charts vehicle-trend-charts">
            <div class="chart-panel-inner">
              <div class="sub-title">厚度变化（四板 + 平均）</div>
              <v-chart class="chart-canvas chart-tall" :option="vehicleThicknessOption" autoresize />
            </div>
            <div class="chart-panel-inner">
              <div class="sub-title">万公里磨耗速率</div>
              <v-chart class="chart-canvas chart-tall" :option="vehicleWearRateOption" autoresize />
            </div>
          </div>
        </template>
        <p v-else-if="!vehicleTrendLoading" class="hint-line vehicle-trend-empty">
          {{ vehicleTrend?.message || '请选择车辆查看磨耗曲线。' }}
        </p>
      </div>

      <p v-if="unevenHint" class="hint-line">{{ unevenHint }}</p>
      <p v-if="shortKmHint" class="hint-line">{{ shortKmHint }}</p>
    </template>

    <div v-else-if="!loading" class="om-panel empty-card">
      <p v-if="!lines.length">暂无线路配置，请确认后端已启动。</p>
      <p v-else>该线路暂无磨耗数据，请先在「数据导入」页导入 Excel。</p>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, inject } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent, LegendComponent } from 'echarts/components'
import { fetchStripWearLines, postStripWearDashboard, fetchStripWearVehicleTrend } from '../api/client'
import { loadStripPrefs, saveStripPrefs, defaultStripDateRange, clampMinThickness } from '../utils/stripPrefs'
import { coerceLineCode, formatLineName } from '../utils/lineDisplay'

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, MarkLineComponent, LegendComponent])

function fmt(v, digits = 1) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toFixed(digits)
}

export default {
  name: 'StripWearDashboardPage',
  components: { VChart },
  emits: ['navigate'],
  setup(_, { emit }) {
    const navigateTo = inject('navigateTo', null)
    const loading = ref(false)
    const lines = ref([])
    const prefs = loadStripPrefs()
    const lineCode = ref(prefs.lineCode || '')
    const dateRange = ref(prefs.dateRange || defaultStripDateRange())
    const minThickness = ref(clampMinThickness(prefs.minThickness))
    const data = ref(null)
    const selectedVehicle = ref('')
    const vehicleTrend = ref(null)
    const vehicleTrendLoading = ref(false)

    function onFilterChange() {
      saveStripPrefs({
        lineCode: lineCode.value,
        dateRange: dateRange.value,
      })
      load()
    }

    const statusTone = computed(() => {
      const high = data.value?.kpi?.high_wear_vehicle_count || 0
      const uneven = data.value?.kpi?.uneven_vehicle_count || 0
      return high > 0 || uneven > 0 ? 'tone-warn' : 'tone-ok'
    })

    const statusText = computed(() => {
      if (!data.value || data.value.empty) return ''
      const k = data.value.kpi
      const rate = fmt(k.fleet_wear_rate_per_10k, 4)
      const parts = [`全线磨耗率 ${rate} mm/万公里`]
      if (k.high_wear_vehicle_count > 0) parts.push(`${k.high_wear_vehicle_count} 辆高磨耗`)
      if ((k.uneven_vehicle_count || 0) > 0) parts.push(`${k.uneven_vehicle_count} 辆偏磨`)
      if (parts.length === 1) parts.push('暂无高磨耗/偏磨')
      return parts.join(' · ')
    })

    const dashboardLineTitle = computed(() =>
      formatLineName(data.value?.line_name, lineCode.value),
    )

    const shortKmHint = computed(() => {
      const short = (data.value?.vehicles || []).filter((v) => (v.cumulative_km || 0) > 0 && (v.cumulative_km || 0) < 5000)
      if (!short.length) return ''
      return `短里程未入图：${short.map((v) => v.vehicle_no).join('、')}（累计公里不足 5000）`
    })

    const unevenHint = computed(() => {
      const list = data.value?.uneven_vehicles || []
      if (!list.length) return ''
      return `偏磨优先：${list.slice(0, 6).map((v) => `${v.vehicle_no}（${v.uneven_level}/${v.uneven_target || '—'}）`).join('；')}`
    })

    const chartVehicles = computed(() =>
      [...(data.value?.chart_vehicles || data.value?.vehicles || [])]
        .filter((v) => (v.cumulative_km || 0) >= 5000)
        .sort((a, b) => String(a.vehicle_no).localeCompare(String(b.vehicle_no), 'zh'))
    )

    const vehicleOptions = computed(() =>
      [...(data.value?.vehicles || [])].sort((a, b) =>
        String(a.vehicle_no).localeCompare(String(b.vehicle_no), 'zh')
      )
    )

    const vehicleThicknessOption = computed(() => {
      const series = vehicleTrend.value?.thickness_series || []
      if (!series.length) return {}
      const dates = series.map((s) => s.date)
      return {
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v) => (v == null ? '—' : `${Number(v).toFixed(1)} mm`),
        },
        legend: {
          data: ['平均厚度', '2车弓板1', '2车弓板2', '5车弓板1', '5车弓板2'],
          top: 0,
          textStyle: { fontSize: 11 },
        },
        grid: { left: 48, right: 12, top: 36, bottom: 40 },
        xAxis: {
          type: 'category',
          data: dates,
          axisLabel: { rotate: 30, fontSize: 10 },
        },
        yAxis: { type: 'value', name: 'mm', min: 0, scale: true },
        series: [
          {
            name: '平均厚度',
            type: 'line',
            data: series.map((s) => s.avg_height),
            symbolSize: 6,
            lineStyle: { width: 2.5, color: '#1f2d3d' },
            itemStyle: { color: '#1f2d3d' },
            markLine: {
              symbol: 'none',
              data: [{ yAxis: minThickness.value }],
              lineStyle: { color: '#e85d6a', type: 'dashed' },
              label: { formatter: `限厚线 ${minThickness.value}`, fontSize: 10 },
            },
          },
          {
            name: '2车弓板1',
            type: 'line',
            data: series.map((s) => s.thick_car2),
            symbolSize: 4,
            lineStyle: { width: 1.5, color: '#3488d9' },
            itemStyle: { color: '#3488d9' },
          },
          {
            name: '2车弓板2',
            type: 'line',
            data: series.map((s) => s.thick_col1),
            symbolSize: 4,
            lineStyle: { width: 1.5, color: '#5a9ee3' },
            itemStyle: { color: '#5a9ee3' },
          },
          {
            name: '5车弓板1',
            type: 'line',
            data: series.map((s) => s.thick_car5),
            symbolSize: 4,
            lineStyle: { width: 1.5, color: '#3dbfad' },
            itemStyle: { color: '#3dbfad' },
          },
          {
            name: '5车弓板2',
            type: 'line',
            data: series.map((s) => s.thick_col2),
            symbolSize: 4,
            lineStyle: { width: 1.5, color: '#e8a84a' },
            itemStyle: { color: '#e8a84a' },
          },
        ],
      }
    })

    const vehicleWearRateOption = computed(() => {
      const series = vehicleTrend.value?.wear_rate_series || []
      if (!series.length) return {}
      return {
        tooltip: {
          trigger: 'axis',
          formatter: (items) => {
            const p = items?.[0]
            if (!p) return ''
            const row = series[p.dataIndex]
            const short = row?.short_trip ? '（短间隔，仅供参考）' : ''
            return `${p.axisValue}<br/>${p.marker}${p.seriesName}: ${Number(p.value).toFixed(2)} mm/万公里${short}`
          },
        },
        grid: { left: 48, right: 12, top: 16, bottom: 40 },
        xAxis: {
          type: 'category',
          data: series.map((s) => s.date),
          axisLabel: { rotate: 30, fontSize: 10 },
        },
        yAxis: { type: 'value', name: 'mm/万公里', min: 0, scale: true },
        series: [{
          name: '万公里磨耗',
          type: 'line',
          data: series.map((s) => ({
            value: s.rate_per_10k,
            itemStyle: { color: s.short_trip ? '#c0c4cc' : '#e85d6a' },
          })),
          symbolSize: 6,
          lineStyle: { width: 2, color: '#e85d6a' },
          markLine: {
            symbol: 'none',
            data: [{ yAxis: 2.0 }],
            lineStyle: { color: '#e8a84a', type: 'dashed' },
            label: { formatter: '高磨耗 2.0', fontSize: 10 },
          },
        }],
      }
    })

    const trendOption = computed(() => {
      const trend = data.value?.daily_trend || []
      return {
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v) => (v == null ? '—' : Number(v).toFixed(2)),
        },
        legend: { data: ['平均值', '最大值'], top: 0, textStyle: { fontSize: 11 } },
        grid: { left: 48, right: 16, top: 28, bottom: 36 },
        xAxis: {
          type: 'category',
          data: trend.map((d) => d.date),
          axisLabel: { rotate: 30, fontSize: 10 },
        },
        yAxis: { type: 'value', name: 'mm/万公里', nameTextStyle: { fontSize: 11 } },
        series: [
          {
            name: '平均值',
            type: 'line',
            data: trend.map((d) => d.avg_wear_per_10k),
            symbolSize: 4,
            lineStyle: { width: 2, color: '#3488d9' },
            itemStyle: { color: '#3488d9' },
          },
          {
            name: '最大值',
            type: 'line',
            data: trend.map((d) => d.max_wear_per_10k),
            symbolSize: 4,
            lineStyle: { width: 2, color: '#e85d6a' },
            itemStyle: { color: '#e85d6a' },
          },
        ],
      }
    })

    const vehicleRateOption = computed(() => {
      const list = chartVehicles.value.filter((v) => v.wear_rate_per_10k != null)
      return {
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v) => (v == null ? '—' : Number(v).toFixed(2)),
        },
        grid: { left: 48, right: 12, top: 12, bottom: 40 },
        xAxis: {
          type: 'category',
          data: list.map((v) => v.vehicle_no),
          axisLabel: { rotate: 40, fontSize: 10 },
        },
        yAxis: {
          type: 'value',
          name: 'mm/万公里',
          min: 0,
          max: (value) => Math.max(0.6, Number((value.max * 1.15).toFixed(2))),
        },
        series: [{
          type: 'bar',
          barMaxWidth: 28,
          data: list.map((v) => ({
            value: v.wear_rate_per_10k,
            vehicle_no: v.vehicle_no,
            itemStyle: { color: '#e8a84a' },
          })),
        }],
      }
    })

    const heightOption = computed(() => {
      const list = chartVehicles.value.filter((v) => v.latest_avg_height != null)
      return {
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v) => (v == null ? '—' : `${Number(v).toFixed(2)} mm`),
        },
        grid: { left: 48, right: 12, top: 16, bottom: 40 },
        xAxis: {
          type: 'category',
          data: list.map((v) => v.vehicle_no),
          axisLabel: { rotate: 40, fontSize: 10 },
        },
        yAxis: { type: 'value', name: 'mm', min: 0, scale: true },
        series: [{
          type: 'bar',
          barMaxWidth: 28,
          data: list.map((v) => ({
            value: v.latest_avg_height,
            vehicle_no: v.vehicle_no,
            itemStyle: {
              color: v.latest_avg_height <= minThickness.value ? '#e85d6a' : '#3488d9',
            },
          })),
          markLine: {
            symbol: 'none',
            data: [{ yAxis: minThickness.value }],
            lineStyle: { color: '#e85d6a', type: 'dashed' },
            label: { formatter: `限厚线 ${minThickness.value}`, fontSize: 10 },
          },
        }],
      }
    })

    const bowCompareOption = computed(() => {
      const list = chartVehicles.value.filter((v) => v.bow2_avg != null || v.bow5_avg != null)
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['2车弓', '5车弓'], top: 0, textStyle: { fontSize: 11 } },
        grid: { left: 48, right: 12, top: 28, bottom: 40 },
        xAxis: {
          type: 'category',
          data: list.map((v) => v.vehicle_no),
          axisLabel: { rotate: 40, fontSize: 10 },
        },
        yAxis: { type: 'value', name: 'mm', min: 0, scale: true },
        series: [
          {
            name: '2车弓',
            type: 'bar',
            barMaxWidth: 16,
            data: list.map((v) => ({
              value: v.bow2_avg,
              vehicle_no: v.vehicle_no,
              itemStyle: { color: v.uneven ? '#e85d6a' : '#3488d9' },
            })),
          },
          {
            name: '5车弓',
            type: 'bar',
            barMaxWidth: 16,
            data: list.map((v) => ({
              value: v.bow5_avg,
              vehicle_no: v.vehicle_no,
              itemStyle: { color: v.uneven ? '#e8a84a' : '#3dbfad' },
            })),
          },
        ],
      }
    })

    async function loadLines() {
      lines.value = await fetchStripWearLines()
      lineCode.value = coerceLineCode(lineCode.value, lines.value)
      if (!lineCode.value && lines.value.length) {
        const withData = lines.value.find((l) => (l.measurement_count || 0) > 0)
        lineCode.value = (withData || lines.value[0]).line_code
        saveStripPrefs({ lineCode: lineCode.value, dateRange: dateRange.value })
      }
      if (!dateRange.value) {
        dateRange.value = defaultStripDateRange()
        saveStripPrefs({ lineCode: lineCode.value, dateRange: dateRange.value })
      }
    }

    async function load() {
      if (!lineCode.value) return
      loading.value = true
      try {
        data.value = await postStripWearDashboard({
          line_code: lineCode.value,
          date_from: dateRange.value?.[0] || '',
          date_to: dateRange.value?.[1] || '',
        })
        if (data.value?.empty) {
          selectedVehicle.value = ''
          vehicleTrend.value = null
          return
        }
        const options = vehicleOptions.value
        const keep = options.some((v) => v.vehicle_no === selectedVehicle.value)
        if (!keep) {
          const prefer = chartVehicles.value[0]?.vehicle_no || options[0]?.vehicle_no || ''
          selectedVehicle.value = prefer
        }
        if (selectedVehicle.value) await loadVehicleTrend()
        else vehicleTrend.value = null
      } catch (e) {
        data.value = { empty: true, message: e?.response?.data?.detail || e.message }
        vehicleTrend.value = null
      } finally {
        loading.value = false
      }
    }

    async function loadVehicleTrend() {
      if (!lineCode.value || !selectedVehicle.value) {
        vehicleTrend.value = null
        return
      }
      vehicleTrendLoading.value = true
      try {
        vehicleTrend.value = await fetchStripWearVehicleTrend({
          line_code: lineCode.value,
          vehicle_no: selectedVehicle.value,
          date_from: dateRange.value?.[0] || '',
          date_to: dateRange.value?.[1] || '',
        })
      } catch (e) {
        vehicleTrend.value = {
          empty: true,
          message: e?.response?.data?.detail || e.message || '加载单车曲线失败',
        }
      } finally {
        vehicleTrendLoading.value = false
      }
    }

    function goPredict() {
      const nav = { center: 'strip-wear', page: 'strip-predict', context: { lineCode: lineCode.value } }
      if (navigateTo) navigateTo(nav)
      else emit('navigate', nav)
    }

    function goPredictVehicle(vehicleNo) {
      if (!vehicleNo) return
      const nav = {
        center: 'strip-wear',
        page: 'strip-predict',
        context: { lineCode: lineCode.value, vehicleNos: [vehicleNo] },
      }
      if (navigateTo) navigateTo(nav)
      else emit('navigate', nav)
    }

    function onChartClick(params) {
      const vehicleNo = params?.data?.vehicle_no || params?.name
      if (!vehicleNo) return
      selectedVehicle.value = vehicleNo
      loadVehicleTrend()
    }

    onMounted(async () => {
      await loadLines()
      await load()
    })

    return {
      loading, lines, lineCode, dateRange, data,
      selectedVehicle, vehicleTrend, vehicleTrendLoading, vehicleOptions,
      statusTone, statusText, dashboardLineTitle, shortKmHint, unevenHint,
      trendOption, vehicleRateOption, heightOption, bowCompareOption,
      vehicleThicknessOption, vehicleWearRateOption,
      fmt, load, loadVehicleTrend, onFilterChange, goPredict, goPredictVehicle, onChartClick,
      formatLineName,
    }
  },
}
</script>

<style scoped>
.wear-dash {
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
.page-head { /* margin-bottom handled globally */ }
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
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.kpi {
  background: var(--om-panel);
  border: 1px solid var(--om-panel-border);
  border-radius: 8px;
  padding: 12px 14px;
  min-width: 0;
}
.kpi.alert { border-color: rgba(232, 93, 106, 0.45); }
.kpi-label { font-size: 12px; color: var(--om-text-muted); margin-bottom: 4px; }
.kpi-value { font-size: 22px; font-weight: 700; line-height: 1.2; color: var(--om-text); }
.kpi-value small { font-size: 12px; font-weight: 500; color: var(--om-text-muted); }
.kpi-sub { margin-top: 4px; font-size: 12px; color: var(--om-text-muted); }
.charts {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}
.detail-charts {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}
.chart-panel { padding: 12px 14px; min-width: 0; }
.panel-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; color: var(--om-text); }
.chart-canvas { width: 100%; height: 250px !important; }
.hint-line {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--om-text-dim);
}
.vehicle-trend-panel {
  padding: 12px 14px;
  margin-bottom: 12px;
}
.vehicle-trend-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-bottom: 8px;
}
.vehicle-trend-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.vehicle-trend-meta {
  font-size: 12px;
  color: var(--om-text-muted);
}
.vehicle-trend-charts {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  margin-bottom: 0;
}
.chart-panel-inner { min-width: 0; }
.sub-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--om-text-muted);
  margin-bottom: 6px;
}
.chart-tall { height: 280px !important; }
.vehicle-trend-empty { margin: 8px 0 0; }
.empty-card { padding: 32px; text-align: center; color: var(--om-text-muted); }
@media (max-width: 1000px) {
  .kpi-row, .charts, .vehicle-trend-charts { grid-template-columns: 1fr; }
}
</style>
