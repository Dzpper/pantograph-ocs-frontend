<template>
  <div class="page" v-loading="loading">
    <header class="page-head">
      <div>
        <h2 class="page-title">综合分析</h2>
        <p class="page-sub" v-if="lineId && selectedDates?.length">
          {{ lineName || lineId }} · {{ direction }} · 已选 <b>{{ selectedDates.length }}</b> 期
          <template v-if="result?.window?.resolved != null">
            · 本次分析 <b>{{ result.window.resolved }}</b> 期
          </template>
          <span class="dim">（线路 / 行别 / 日期与顶部筛选栏共用）</span>
        </p>
        <p class="page-sub warn" v-else>请先在顶部选择线路与检测日期（默认近 1 个月，避免一次加载过多）</p>
      </div>
      <el-button type="primary" :disabled="!lineId || !selectedDates?.length" @click="run">开始分析</el-button>
    </header>

    <template v-if="result?.owner">
      <section class="assess-banner" :class="gradeClass">
        <div class="grade-block">
          <div class="grade-mark">{{ result.owner.assessment?.grade || '—' }}</div>
          <div class="grade-label">{{ result.owner.assessment?.label || '关注提示' }}</div>
        </div>
      </section>

      <section class="viz-row" v-if="result.arc_kpi && !result.arc_kpi.empty">
        <div class="kpi-cards">
          <div class="kpi-card">
            <div class="kpi-name">燃弧总时长</div>
            <div class="kpi-val">{{ result.arc_kpi.kpi.arc_duration_sum }} <small>ms</small></div>
            <div class="kpi-sub">本期主看指标</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-name">燃弧次数</div>
            <div class="kpi-val">{{ result.arc_kpi.kpi.arc_count }}</div>
            <div class="kpi-sub">{{ result.arc_kpi.kpi.latest_date || '—' }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-name">较上期</div>
            <div class="kpi-val" :class="deltaClass">{{ deltaText }}</div>
            <div class="kpi-sub">总时长环比</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-name">反复杆位占比</div>
            <div class="kpi-val">{{ chronicDurPct }}</div>
            <div class="kpi-sub">占总时长</div>
          </div>
        </div>
        <div class="om-panel chart-box">
          <div class="panel-title">各期燃弧总时长</div>
          <p class="fig-cap">检测日汇总（arc_time≥5 ms）；横轴期数 = 本次所选窗口</p>
          <v-chart class="chart" :option="trendOption" autoresize />
        </div>
      </section>

      <section class="viz-split" v-if="result.arc_type_breakdown">
        <div class="om-panel chart-box">
          <div class="panel-title">燃弧时长构成</div>
          <p class="fig-cap">
            按可复核规则对单次事件分流（优先级：定点反复 → 偏高速 → 微燃弧聚集 → 其他）；用于区分关注点，非现场成因定性
          </p>
          <v-chart class="chart" :option="structureOption" autoresize />
          <ul class="type-legend">
            <li><b>定点复发型</b>：跨期同杆反复出现，多为线路固有点位，宜日常多加关注</li>
            <li><b>速度关联型</b>：与速度相关且偏高速段更易发，宜按工况看待，不宜直接立项为线路病害</li>
            <li><b>微燃弧聚集型</b>：幅值小、局部密度高，成因暂不明，列入观察</li>
          </ul>
        </div>
        <div class="om-panel chart-box" v-if="chronicBarOption">
          <div class="panel-title">反复杆位（多加关注）</div>
          <p class="fig-cap">
            基于所选 <b>{{ analysisWindowSize }}</b> 期统计；柱长=该杆出现期数，满刻度=所选窗口
          </p>
          <v-chart class="chart" :option="chronicBarOption" autoresize />
        </div>
      </section>

      <section class="om-panel chart-box scatter-panel" v-if="stabilityOption" style="margin-bottom: 14px">
        <div class="panel-title">燃弧复发散点图</div>
        <p class="fig-cap">
          前 {{ heatPoleCount }} 处关注杆位：左轴为燃弧时长，右轴为检测时间；同一杆号上点越密、越高，越值得多加留意
          <template v-if="analysisWindowSize"> · 当前窗口 {{ analysisWindowSize }} 期</template>
        </p>
        <v-chart class="chart scatter" :option="stabilityOption" autoresize />
      </section>

      <section class="om-panel section" v-if="result.owner.actions?.length">
        <h3 class="sec-title">参考关注点</h3>
        <div v-for="a in result.owner.actions" :key="a.action_id" class="action-row">
          <el-tag size="small" :type="actionTag(a.level)">{{ levelLabel(a.level) }}</el-tag>
          <div>
            <div class="action-title">{{ a.title }}</div>
            <div class="action-detail">{{ a.detail }}</div>
          </div>
        </div>
      </section>

      <section class="om-panel section" v-if="result.chronic_poles?.length">
        <h3 class="sec-title">建议多加关注的杆位</h3>
        <p class="hint">
          基于所选 <b>{{ analysisWindowSize }}</b> 期：共 {{ result.chronic_poles.length }} 处达标杆位
          （出现期数 / 所选期数 ≥ 50% 且至少 3 期）；表中前 15 处，柱图前 {{ chronicBarCount }} 处。
        </p>
        <el-table :data="result.chronic_poles.slice(0, 15)" size="small" max-height="320">
          <el-table-column type="index" label="#" width="48" />
          <el-table-column prop="pole_no" label="杆号" min-width="100" />
          <el-table-column prop="station_area_name" label="站区" min-width="140" />
          <el-table-column label="出现 / 所选" min-width="110">
            <template #default="{ row }">
              {{ row.appear_days }} / {{ row.total_days || analysisWindowSize }}
            </template>
          </el-table-column>
          <el-table-column label="复发率" min-width="90">
            <template #default="{ row }">{{ pct(row.appear_rate) }}</template>
          </el-table-column>
          <el-table-column label="累计时长" min-width="100">
            <template #default="{ row }">
              {{ row.total_arc_ms != null ? `${row.total_arc_ms} ms` : '—' }}
            </template>
          </el-table-column>
        </el-table>
        <div class="table-actions">
          <el-button link type="primary" @click="goModule({ center: 'analysis', page: 'arc', label: '燃弧分析' })">
            打开燃弧分析核对点位 →
          </el-button>
        </div>
      </section>

      <p class="footnote">{{ result.owner.note }}</p>
    </template>

    <el-empty v-else-if="!loading" description="在顶部选择线路与日期后开始综合分析" />
  </div>
</template>

<script>
import { ref, computed, watch, inject } from 'vue'
import { ElMessage } from 'element-plus'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components'
import { postCorrelationDiagnose } from '../api/client'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
])

const TYPE_ORDER = [
  ['pole_chronic', '定点复发型'],
  ['speed_related', '速度关联型'],
  ['dense_micro', '微燃弧聚集型'],
  ['unclassified', '其他未归类'],
]

const CHRONIC_BAR_TOP_N = 8
const HEAT_POLE_TOP_N = 10

export default {
  name: 'MatchingWorkbenchPage',
  components: { VChart },
  props: {
    lineId: String,
    lineName: String,
    direction: { type: String, default: '上行' },
    selectedDates: { type: Array, default: () => [] },
    isDark: Boolean,
  },
  setup(props) {
    const navigateTo = inject('navigateTo', null)
    const loading = ref(false)
    const result = ref(null)

    const heatPoleCount = computed(() => {
      const n = result.value?.stability_chart?.pole_keys?.length
        || result.value?.chronic_poles?.length
        || 0
      return Math.min(n, HEAT_POLE_TOP_N)
    })

    function formatDateLabel(d) {
      const s = String(d || '').replace(/-/g, '')
      if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
      return String(d)
    }
    function shortDate(d) {
      const s = formatDateLabel(d)
      return s.length >= 10 ? s.slice(5) : s
    }

    const deltaText = computed(() => {
      const d = result.value?.arc_kpi?.kpi?.delta_duration_pct
      if (d == null) return '—'
      return `${d > 0 ? '+' : ''}${d}%`
    })
    const deltaClass = computed(() => {
      const d = result.value?.arc_kpi?.kpi?.delta_duration_pct
      if (d == null) return ''
      if (d <= -10) return 'good'
      if (d >= 10) return 'bad'
      return ''
    })
    const chronicDurPct = computed(() => {
      const s = result.value?.arc_type_breakdown?.pole_chronic?.duration_share
      return s == null ? '—' : `${Math.round(s * 100)}%`
    })
    const gradeClass = computed(() => {
      const g = result.value?.owner?.assessment?.grade
      return ({
        平稳: 'grade-low',
        例行: 'grade-mid',
        可关注: 'grade-high',
        多留意: 'grade-watch',
        // 兼容旧数据
        较低: 'grade-low',
        一般: 'grade-mid',
        偏高: 'grade-high',
        较高: 'grade-watch',
      })[g] || 'grade-mid'
    })

    const trendOption = computed(() => {
      const daily = [...(result.value?.arc_kpi?.daily || [])].reverse()
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

    const structureOption = computed(() => {
      const br = result.value?.arc_type_breakdown || {}
      const labels = TYPE_ORDER.map(([, lab]) => lab)
      const vals = TYPE_ORDER.map(([k]) => Math.round(((br[k]?.duration_share) || 0) * 1000) / 10)
      return {
        color: ['#b91c1c', '#2563eb', '#ca8a04', '#6b7280'],
        tooltip: { trigger: 'axis', valueFormatter: (v) => `${v}%` },
        grid: { left: 100, right: 24, top: 16, bottom: 28 },
        xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
        yAxis: { type: 'category', data: labels },
        series: [{
          type: 'bar',
          data: vals,
          barMaxWidth: 22,
          label: { show: true, position: 'right', formatter: '{c}%', fontSize: 11 },
        }],
      }
    })

    const analysisWindowSize = computed(() => {
      const w = result.value?.window_size
        || result.value?.window?.resolved
        || result.value?.window_dates?.length
        || result.value?.chronic_poles?.[0]?.total_days
        || props.selectedDates?.length
        || 0
      return Number(w) || 0
    })

    const chronicBarCount = computed(() => {
      const n = result.value?.chronic_poles?.length || 0
      return Math.min(n, CHRONIC_BAR_TOP_N)
    })

    const chronicBarOption = computed(() => {
      const poles = (result.value?.chronic_poles || []).slice(0, CHRONIC_BAR_TOP_N)
      if (!poles.length) return null
      const windowN = analysisWindowSize.value || poles[0]?.total_days || 12
      const labels = poles.map((p) => p.pole_no || p.pole_key || '—').reverse()
      const days = poles.map((p) => p.appear_days || 0).reverse()
      return {
        color: ['#b91c1c'],
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            const i = poles.length - 1 - (params?.[0]?.dataIndex ?? 0)
            const p = poles[i]
            if (!p) return ''
            const total = p.total_days || windowN
            const ms = p.total_arc_ms != null ? `，累计 ${p.total_arc_ms} ms` : ''
            return `${p.pole_no || ''}（${p.station_area_name || '—'}）<br/>在所选 ${total} 期中出现 ${p.appear_days} 期${ms}`
          },
        },
        grid: { left: 72, right: 48, top: 12, bottom: 36 },
        xAxis: {
          type: 'value',
          name: `出现期数（满刻度=${windowN}）`,
          min: 0,
          max: windowN,
          minInterval: 1,
          nameLocation: 'middle',
          nameGap: 22,
        },
        yAxis: { type: 'category', data: labels, axisLabel: { fontSize: 11 } },
        series: [{
          type: 'bar',
          data: days,
          barMaxWidth: 18,
          label: {
            show: true,
            position: 'right',
            fontSize: 11,
            formatter: (p) => `${p.value}/${windowN}`,
          },
        }],
      }
    })

    const stabilityOption = computed(() => {
      const chart = result.value?.stability_chart
      if (!chart?.dates?.length || !chart?.pole_keys?.length) return null

      const poles = (chart.pole_labels || chart.pole_keys).slice(0, HEAT_POLE_TOP_N)
      const keys = chart.pole_keys.slice(0, HEAT_POLE_TOP_N)
      const dates = [...(chart.dates || [])]
      const dateLabels = dates.map((d) => shortDate(d))

      const durationPoints = []
      const timePoints = []
      keys.forEach((pk, poleIdx) => {
        dates.forEach((d, dateIdx) => {
          const src = (chart.matrix || [])[dateIdx]
          const v = src?.poles?.[pk]
          if (v == null || Number(v) <= 0) return
          const duration = Number(v)
          const pole = poles[poleIdx]
          const dateFull = formatDateLabel(d)
          durationPoints.push({
            value: [pole, duration],
            pole,
            date: dateFull,
            dateIdx,
            duration,
          })
          timePoints.push({
            value: [pole, dateLabels[dateIdx]],
            pole,
            date: dateFull,
            dateIdx,
            duration,
          })
        })
      })
      if (!durationPoints.length) return null

      const maxDur = Math.max(...durationPoints.map((p) => p.duration), 1)

      return {
        legend: {
          type: 'scroll',
          data: ['燃弧时长', '检测时间'],
          bottom: 4,
          textStyle: { fontSize: 11, color: '#64748b' },
        },
        tooltip: {
          trigger: 'item',
          formatter: (p) => {
            const d = p.data || {}
            if (p.seriesName === '检测时间') {
              return `${d.pole || ''}<br/>检测日 ${d.date || '—'}<br/>燃弧时长 ${d.duration} ms`
            }
            return `${d.pole || ''}<br/>检测日 ${d.date || '—'}<br/>燃弧时长 <b>${d.duration}</b> ms`
          },
        },
        grid: {
          left: 64,
          right: 72,
          top: 28,
          bottom: 56,
        },
        xAxis: {
          type: 'category',
          data: poles,
          name: '杆号',
          nameLocation: 'middle',
          nameGap: 28,
          axisLabel: { fontSize: 11, color: '#334155', rotate: poles.length > 8 ? 35 : 0 },
          axisTick: { alignWithLabel: true },
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          splitLine: { show: true, lineStyle: { color: '#f1f5f9' } },
        },
        yAxis: [
          {
            type: 'value',
            name: '燃弧时长 (ms)',
            position: 'left',
            min: 0,
            max: Math.ceil(maxDur * 1.15),
            nameTextStyle: { color: '#b91c1c', fontSize: 11 },
            axisLabel: { color: '#b91c1c', fontSize: 10 },
            axisLine: { show: true, lineStyle: { color: '#b91c1c' } },
            splitLine: { lineStyle: { color: '#f1f5f9' } },
          },
          {
            type: 'category',
            name: '检测时间',
            position: 'right',
            data: dateLabels,
            nameTextStyle: { color: '#1d4ed8', fontSize: 11 },
            axisLabel: { color: '#1d4ed8', fontSize: 10 },
            axisLine: { show: true, lineStyle: { color: '#1d4ed8' } },
            axisTick: { show: false },
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: '燃弧时长',
            type: 'scatter',
            yAxisIndex: 0,
            data: durationPoints,
            symbolSize: (val, params) => {
              const dur = params?.data?.duration || val?.[1] || 0
              return Math.max(10, Math.min(28, 8 + (dur / maxDur) * 18))
            },
            itemStyle: {
              color: 'rgba(185, 28, 28, 0.72)',
              borderColor: '#fff',
              borderWidth: 1,
            },
            emphasis: {
              scale: 1.2,
              itemStyle: { color: '#991b1b' },
            },
          },
          {
            name: '检测时间',
            type: 'scatter',
            yAxisIndex: 1,
            data: timePoints,
            symbolSize: (val, params) => {
              const dur = params?.data?.duration || 0
              return Math.max(8, Math.min(22, 6 + (dur / maxDur) * 14))
            },
            itemStyle: {
              color: 'rgba(37, 99, 235, 0.55)',
              borderColor: '#fff',
              borderWidth: 1,
            },
            emphasis: {
              scale: 1.15,
              itemStyle: { color: '#1d4ed8' },
            },
          },
        ],
      }
    })

    function pct(v) {
      if (v == null || Number.isNaN(Number(v))) return '—'
      return `${Math.round(Number(v) * 100)}%`
    }
    function levelLabel(l) {
      return ({ P0: '紧急', P1: '优先', P2: '关注', observe: '观察', info: '说明' })[l] || l
    }
    function actionTag(l) {
      return ({ P0: 'danger', P1: 'warning', P2: 'warning', observe: 'info', info: '' })[l] || 'info'
    }

    function goModule(m) {
      if (!m?.page) return
      if (navigateTo) {
        navigateTo({
          center: m.center,
          page: m.page,
          lineId: props.lineId,
          direction: props.direction,
        })
      }
    }

    async function run() {
      if (!props.lineId) {
        ElMessage.warning('请先在顶部选择线路')
        return
      }
      if (!props.selectedDates?.length) {
        ElMessage.warning('请先在顶部选择检测日期（默认近 1 个月）')
        return
      }
      const dates = props.selectedDates.slice(0, 12)
      if (props.selectedDates.length > 12) {
        ElMessage.info(`已选 ${props.selectedDates.length} 期，本次仅分析最近 12 期以保证速度`)
      }
      loading.value = true
      try {
        result.value = await postCorrelationDiagnose({
          line_code: props.lineId,
          direction: props.direction,
          dates: dates.map((d) => String(d).replace(/-/g, '').slice(0, 8)),
        })
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || e.message || '分析失败')
      } finally {
        loading.value = false
      }
    }

    watch(
      [() => props.lineId, () => props.direction, () => props.selectedDates],
      () => {
        if (props.lineId && props.selectedDates?.length) run()
        else result.value = null
      },
      { immediate: true, deep: true },
    )

    return {
      loading,
      result,
      deltaText,
      deltaClass,
      chronicDurPct,
      gradeClass,
      trendOption,
      structureOption,
      chronicBarCount,
      chronicBarOption,
      analysisWindowSize,
      heatPoleCount,
      stabilityOption,
      run,
      goModule,
      pct,
      levelLabel,
      actionTag,
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

.assess-banner {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 16px 18px;
  border-radius: 10px;
  border: 1px solid var(--om-panel-border);
  margin-bottom: 14px;
  background: var(--om-bg-3);
}
.assess-banner.grade-low { background: var(--om-accent-soft-2); border-color: rgba(61, 191, 173, 0.45); }
.assess-banner.grade-mid { background: var(--om-bg-3); border-color: #e2e8f0; }
.assess-banner.grade-high { background: rgba(232, 168, 74, 0.10); border-color: rgba(232, 168, 74, 0.45); }
.assess-banner.grade-watch { background: rgba(232, 168, 74, 0.10); border-color: rgba(232, 168, 74, 0.55); }
.assess-banner.grade-urgent { background: rgba(232, 168, 74, 0.10); border-color: rgba(232, 168, 74, 0.55); }
.grade-block { text-align: center; }
.grade-mark {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.15;
  color: var(--om-text);
}
.grade-label { margin-top: 6px; font-size: 0.78rem; color: var(--om-text-muted); font-weight: 600; }

.viz-row { display: grid; grid-template-columns: 1fr 1.35fr; gap: 12px; margin-bottom: 14px; }
.kpi-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.kpi-card {
  border: 1px solid var(--om-panel-border);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--om-panel);
}
.kpi-name { font-size: 0.75rem; color: var(--om-text-muted); }
.kpi-val { margin-top: 4px; font-size: 1.3rem; font-weight: 700; color: var(--om-text); }
.kpi-val small { font-size: 0.75rem; font-weight: 500; color: var(--om-text-dim); }
.kpi-val.good { color: var(--om-success); }
.kpi-val.bad { color: var(--om-danger); }
.kpi-sub { margin-top: 2px; font-size: 0.72rem; color: var(--om-text-dim); }

.viz-split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
/* 网格子项允许收缩，防止内容撑破列宽 */
.viz-split > .om-panel,
.viz-row > .om-panel { min-width: 0; }
/* 只有一张卡时（如"反复杆位"无数据隐藏），占满整行 */
.viz-split > .om-panel:only-child,
.viz-row > .om-panel:only-child {
  grid-column: 1 / -1;
}
.chart-box { padding: 12px 14px; }
.chart { height: 240px; width: 100%; }
.chart.tall { height: 300px; }
.chart.scatter { height: 380px; width: 100%; }
.scatter-panel { overflow: hidden; }
.panel-title, .sec-title {
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
.type-legend {
  margin: 8px 0 0;
  padding-left: 1.1rem;
  font-size: 0.78rem;
  color: var(--om-text-muted);
  line-height: 1.55;
}
.type-legend b { color: var(--om-text); font-weight: 600; }
.share-tag { color: var(--om-text-dim); font-weight: 500; margin-left: 2px; }
.type-rules {
  margin-top: 8px;
  font-size: 0.78rem;
  color: var(--om-text-muted);
}
.type-rules summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--om-text-muted);
  margin-bottom: 4px;
}
.corr-hint {
  margin: 8px 0 0;
  padding: 8px 10px;
  background: var(--om-bg-3);
  border-radius: 6px;
  border: 1px solid var(--om-panel-border);
  line-height: 1.5;
  font-size: 0.76rem;
  color: var(--om-text-muted);
}

.section { margin-bottom: 14px; padding: 14px 16px; }
.hint { margin: 0 0 10px; font-size: 0.82rem; color: var(--om-text-muted); line-height: 1.5; }
.action-row {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--om-divider);
  align-items: flex-start;
}
.action-row:last-child { border-bottom: 0; }
.action-title { font-weight: 650; margin-bottom: 4px; color: var(--om-text); }
.action-detail { font-size: 0.86rem; color: var(--om-text-muted); line-height: 1.55; }
.table-actions { margin-top: 8px; }
.footnote {
  margin: 8px 0 0;
  font-size: 0.75rem;
  color: var(--om-text-dim);
  line-height: 1.55;
}

@media (max-width: 900px) {
  .assess-banner, .viz-row, .viz-split { grid-template-columns: 1fr; }
  .kpi-cards { grid-template-columns: 1fr 1fr; }
}
</style>
