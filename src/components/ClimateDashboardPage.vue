<template>
  <div class="wear-dash" v-loading="loading">
    <div class="page-head">
      <div>
        <h2 class="page-title">隧道温湿度看板</h2>
        <p class="page-sub" v-if="data && !data.empty">
          {{ dashboardLineTitle }} · {{ data.date_from }} ~ {{ data.date_to }} · 仅陈述气候事实
        </p>
        <p class="page-sub" v-else>选择线路后查看日温湿度概况</p>
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
            <span>{{ l.line_name }}</span>
            <span class="om-option-extra">{{ l.filled_count || 0 }} 日</span>
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
      <div class="om-toolbar-actions">
        <el-button type="primary" @click="load">刷新</el-button>
      </div>
    </div>

    <el-alert
      v-if="data && data.note"
      :title="data.note"
      type="info"
      :closable="false"
      style="margin-bottom: 12px"
    />

    <template v-if="data && !data.empty">
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-label">有效天数</div>
          <div class="kpi-value">{{ data.kpi.filled_days }} <small>日</small></div>
        </div>
        <div class="kpi">
          <div class="kpi-label">平均温度</div>
          <div class="kpi-value">{{ fmt(data.kpi.mean_temp_c, 1) }} <small>℃</small></div>
          <div class="kpi-sub">{{ fmt(data.kpi.min_temp_c, 1) }} ~ {{ fmt(data.kpi.max_temp_c, 1) }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">平均相对湿度</div>
          <div class="kpi-value">{{ fmt(data.kpi.mean_rh_pct, 1) }} <small>%</small></div>
          <div class="kpi-sub">{{ fmt(data.kpi.min_rh_pct, 1) }} ~ {{ fmt(data.kpi.max_rh_pct, 1) }}</div>
        </div>
        <div class="kpi" :class="{ alert: data.kpi.high_rh_days > 0 }">
          <div class="kpi-label">高湿日 (≥{{ data.kpi.rh_high_threshold }}%)</div>
          <div class="kpi-value">{{ data.kpi.high_rh_days }} <small>日</small></div>
          <div class="kpi-sub">≥{{ data.kpi.rh_very_high_threshold }}%：{{ data.kpi.very_high_rh_days }} 日</div>
        </div>
      </div>

      <div class="charts">
        <div class="om-panel chart-panel">
          <div class="panel-title">日温度 / 相对湿度</div>
          <v-chart class="chart-canvas" :option="trendOption" autoresize />
        </div>
        <div class="om-panel chart-panel">
          <div class="panel-title">相对湿度分箱天数</div>
          <v-chart class="chart-canvas" :option="binOption" autoresize />
        </div>
      </div>
    </template>

    <el-empty v-else-if="!loading" :description="data?.message || '暂无数据'" />
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { fetchClimateLines, postClimateDashboard } from '../api/client'
import { loadClimatePrefs, saveClimatePrefs } from '../utils/climatePrefs'
import { coerceLineCode, formatLineName } from '../utils/lineDisplay'

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent])

export default {
  name: 'ClimateDashboardPage',
  components: { VChart },
  setup() {
    const loading = ref(false)
    const lines = ref([])
    const prefs = loadClimatePrefs()
    const lineCode = ref(prefs.lineCode || '')
    const dateRange = ref(prefs.dateRange || null)
    const data = ref(null)

    function fmt(v, dig = 2) {
      if (v == null || Number.isNaN(Number(v))) return '—'
      return Number(v).toFixed(dig)
    }

    function onFilterChange() {
      saveClimatePrefs({ lineCode: lineCode.value, dateRange: dateRange.value })
      load()
    }

    const dashboardLineTitle = computed(() =>
      formatLineName(data.value?.line_name, lineCode.value),
    )

    async function loadLines() {
      lines.value = await fetchClimateLines()
      lineCode.value = coerceLineCode(lineCode.value, lines.value)
      if (!lineCode.value && lines.value.length) {
        lineCode.value = lines.value[0].line_code
        saveClimatePrefs({ lineCode: lineCode.value })
      }
    }

    async function load() {
      if (!lineCode.value) return
      loading.value = true
      try {
        data.value = await postClimateDashboard({
          line_code: lineCode.value,
          date_from: dateRange.value?.[0] || '',
          date_to: dateRange.value?.[1] || '',
        })
      } finally {
        loading.value = false
      }
    }

    const trendOption = computed(() => {
      const series = data.value?.series || []
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['温度℃', '相对湿度%'], top: 0 },
        grid: { left: 48, right: 48, top: 28, bottom: 40 },
        xAxis: {
          type: 'category',
          data: series.map((s) => s.observe_date),
          axisLabel: { rotate: 40, fontSize: 10 },
        },
        yAxis: [
          { type: 'value', name: '℃', scale: true },
          { type: 'value', name: '%', min: 0, max: 100 },
        ],
        series: [
          {
            name: '温度℃',
            type: 'line',
            showSymbol: false,
            data: series.map((s) => s.temp_c),
            itemStyle: { color: '#e85d6a' },
          },
          {
            name: '相对湿度%',
            type: 'line',
            yAxisIndex: 1,
            showSymbol: false,
            data: series.map((s) => s.rh_pct),
            itemStyle: { color: '#3488d9' },
          },
        ],
      }
    })

    const binOption = computed(() => {
      const bins = data.value?.rh_bins || []
      return {
        tooltip: { trigger: 'axis' },
        grid: { left: 48, right: 12, top: 16, bottom: 40 },
        xAxis: { type: 'category', data: bins.map((b) => b.label) },
        yAxis: { type: 'value', name: '天' },
        series: [{
          type: 'bar',
          barMaxWidth: 36,
          data: bins.map((b) => b.count),
          itemStyle: { color: '#3dbfad' },
        }],
      }
    })

    onMounted(async () => {
      await loadLines()
      await load()
    })

    return {
      loading,
      lines,
      lineCode,
      dateRange,
      data,
      dashboardLineTitle,
      fmt,
      onFilterChange,
      load,
      trendOption,
      binOption,
      formatLineName,
    }
  },
}
</script>

<style scoped>
.wear-dash { padding: 4px 2px 24px; }
.page-title { margin: 0 0 4px; font-size: 1.25rem; }
.page-sub { margin: 0; color: var(--om-text-muted, #6b7280); font-size: 0.9rem; }
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}
.kpi {
  background: var(--om-panel);
  border: 1px solid var(--om-panel-border);
  border-radius: var(--om-radius-sm);
  padding: 12px 14px;
}
.kpi.alert { border-color: var(--om-warning); }
.kpi-label { font-size: 0.8rem; color: var(--om-text-muted); }
.kpi-value { font-size: 1.4rem; font-weight: 650; margin-top: 4px; }
.kpi-value small { font-size: 0.75rem; font-weight: 500; color: var(--om-text-muted); }
.kpi-sub { font-size: 0.75rem; color: var(--om-text-dim); margin-top: 2px; }
.charts {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 12px;
}
.chart-panel { min-height: 320px; }
.chart-canvas { height: 280px; width: 100%; }
.panel-title { font-weight: 600; margin-bottom: 8px; }
.om-option-extra { float: right; color: var(--om-text-dim); font-size: 12px; margin-left: 12px; }
@media (max-width: 960px) {
  .kpi-row, .charts { grid-template-columns: 1fr; }
}
</style>
