<template>
  <div class="alarm-page" v-loading="loading">
    <div class="page-head">
      <h2 class="page-title">
        <span class="dot" />超限统计
      </h2>
      <span class="page-sub">{{ lineName || '未选线路' }} · {{ direction }} · {{ dateRangeText }}</span>
    </div>

    <section class="threshold-panel om-panel">
      <div class="threshold-head">
        <button type="button" class="threshold-toggle" @click="thresholdsOpen = !thresholdsOpen">
          <span>筛选阈值</span>
          <el-tag v-if="thresholdsCustom" size="small" type="warning" effect="plain">已按本线路调整</el-tag>
          <el-tag v-if="thresholdsDirty" size="small" type="info" effect="plain">未应用</el-tag>
          <span class="threshold-caret">{{ thresholdsOpen ? '▴' : '▾' }}</span>
        </button>
        <div class="threshold-actions">
          <el-button size="small" @click="resetThresholds">恢复默认</el-button>
          <el-button size="small" type="primary" :disabled="!thresholdsDirty" @click="applyThresholds">应用</el-button>
        </div>
      </div>
      <p class="threshold-hint">
        系统按默认门限筛选超限；个别线路包络不同时可改本线路阈值后重新统计（如拉出值 -400～200 mm，燃弧预警 25 ms / 严重 50 ms）。杆号评估浅色基准带使用同一套阈值。
      </p>
      <div v-show="thresholdsOpen" class="threshold-grid">
        <div v-for="rule in ruleDraft" :key="rule.type" class="threshold-card">
          <div class="threshold-type">
            {{ rule.type }}
            <span class="threshold-unit">{{ rule.unit }}</span>
          </div>
          <div v-if="rule.kind === 'band'" class="threshold-fields">
            <label>二级下限<input v-model.number="rule.warn_lower" type="number" step="any" /></label>
            <label>二级上限<input v-model.number="rule.warn_upper" type="number" step="any" /></label>
            <label>一级下限<input v-model.number="rule.lower" type="number" step="any" /></label>
            <label>一级上限<input v-model.number="rule.upper" type="number" step="any" /></label>
          </div>
          <div v-else class="threshold-fields">
            <label>{{ rule.kind === 'abs_upper' ? '二级 |值|' : '二级' }}
              <input v-model.number="rule.warn_upper" type="number" step="any" />
            </label>
            <label>{{ rule.kind === 'abs_upper' ? '一级 |值|' : '一级' }}
              <input v-model.number="rule.upper" type="number" step="any" />
            </label>
            <label v-if="rule.min_alarm != null">起计
              <input v-model.number="rule.min_alarm" type="number" step="any" />
            </label>
          </div>
        </div>
      </div>
    </section>

    <section class="kpi-strip" v-if="summaryKpi">
      <div class="kpi-card">
        <div class="kpi-name">超限合计</div>
        <div class="kpi-val">{{ summaryKpi.total }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-name">一级</div>
        <div class="kpi-val danger">{{ summaryKpi.level1 }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-name">二级</div>
        <div class="kpi-val">{{ summaryKpi.level2 }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-name">超限杆号</div>
        <div class="kpi-val">{{ poleTotal }}</div>
      </div>
      <div class="kpi-card" v-if="windowStory">
        <div class="kpi-name">多期命中杆</div>
        <div class="kpi-val">{{ windowStory.recurrent_pole_count ?? '—' }}</div>
        <div class="kpi-sub">≥{{ windowStory.min_hit_dates || 2 }} 期</div>
      </div>
      <div class="kpi-card" v-if="windowStory?.dominant_type">
        <div class="kpi-name">主导类型</div>
        <div class="kpi-val type-val">{{ windowStory.dominant_type }}</div>
        <div class="kpi-sub">{{ windowStory.dominant_percent }}%</div>
      </div>
    </section>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :md="10">
        <ChartCard title="超限类型分布" description="按指标类型占比（阈值派生）">
          <v-chart
            :key="`alarm-type-${chartScopeKey}`"
            class="chart-canvas"
            :option="typeChartOption"
            :update-options="{ notMerge: true }"
            autoresize
          />
        </ChartCard>
      </el-col>
      <el-col :xs="24" :md="14">
        <ChartCard title="超限数量趋势" description="横轴从左到右：旧日期 → 新日期">
          <template #tools>
            <el-radio-group v-model="trendGranularity" size="small">
              <el-radio-button label="day">按日</el-radio-button>
              <el-radio-button label="week">按周</el-radio-button>
            </el-radio-group>
          </template>
          <v-chart
            :key="`alarm-trend-${chartScopeKey}-${trendGranularity}`"
            class="chart-canvas"
            :option="trendChartOption"
            :update-options="{ notMerge: true }"
            autoresize
          />
        </ChartCard>
      </el-col>
    </el-row>

    <section class="om-panel station-panel" v-if="stationRanks.length">
      <div class="station-head">
        <div>
          <div class="panel-title">站区超限次数</div>
          <p class="panel-hint">按站区合计，一级/二级堆叠；条长表示相对次数。</p>
        </div>
        <div class="station-legend">
          <span class="lg l1">一级</span>
          <span class="lg l2">二级</span>
        </div>
      </div>
      <div class="station-rank-list">
        <div
          v-for="(row, i) in stationRanks"
          :key="row.station"
          class="station-rank-row"
        >
          <span class="rank-idx">{{ i + 1 }}</span>
          <div class="rank-main">
            <div class="rank-top">
              <span class="rank-name" :title="row.station">{{ row.station }}</span>
              <span class="rank-total">{{ row.total }}</span>
            </div>
            <div class="rank-bar">
              <span class="bar-l1" :style="{ width: stationBarPct(row.level1) }" />
              <span class="bar-l2" :style="{ width: stationBarPct(row.level2) }" />
            </div>
            <div class="rank-sub">一级 {{ row.level1 }} · 二级 {{ row.level2 }}</div>
          </div>
        </div>
      </div>
    </section>

    <el-row :gutter="16" class="table-row">
      <el-col :xs="24">
        <div class="om-panel pole-panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">超限次数较多的杆号</div>
              <p class="panel-hint">
                <b>所选期次内</b>（当前 {{ selectedDateCount }} 个检测日）至少一期达阈值的杆号，按次数排序。
                点击行查看该杆号在所选期内的超限曲线与事件清单。
                <template v-if="filteredPoles.length">展示 {{ filteredPoles.length }} 处。</template>
              </p>
            </div>
            <div class="panel-filters">
              <el-checkbox v-model="recurrentOnly" size="small">仅多期命中</el-checkbox>
              <el-select
                v-model="typeFilter"
                clearable
                size="small"
                placeholder="全部类型"
                style="width: 120px"
              >
                <el-option
                  v-for="t in typeOptions"
                  :key="t"
                  :label="t"
                  :value="t"
                />
              </el-select>
              <el-input
                v-model="poleFilter"
                clearable
                size="small"
                placeholder="杆号/站区"
                style="width: 140px"
              />
            </div>
          </div>
            <el-table
            v-if="filteredPoles.length"
            :data="pagedPoles"
            size="small"
            stripe
            max-height="380"
            table-layout="fixed"
            class="pole-table"
            @row-click="onPoleClick"
          >
            <el-table-column prop="pole_no" label="杆号" min-width="88" show-overflow-tooltip />
            <el-table-column label="公里标" min-width="88" align="right">
              <template #default="{ row }">
                {{ row.kilometer_mark != null ? Number(row.kilometer_mark).toFixed(3) : '—' }}
              </template>
            </el-table-column>
            <el-table-column prop="station" label="站区" min-width="120" show-overflow-tooltip />
            <el-table-column label="类型" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">
                {{ (row._types || row.types || []).join('、') || '—' }}
              </template>
            </el-table-column>
            <el-table-column prop="level1" label="一级" min-width="64" align="center" sortable>
              <template #default="{ row }">
                <span :class="{ danger: row.level1 > 0 }">{{ row.level1 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="level2" label="二级" min-width="64" align="center" sortable />
            <el-table-column prop="total" label="合计" min-width="64" align="center" sortable />
            <el-table-column prop="hit_dates" label="期数" min-width="64" align="center" sortable />
          </el-table>
          <div v-if="filteredPoles.length" class="table-pager">
            <el-pagination
              v-model:current-page="polePage"
              :page-size="polePageSize"
              :total="filteredPoles.length"
              layout="total, prev, pager, next"
              small
              background
            />
          </div>
          <p v-else class="empty-tip">当前筛选无结果。</p>
        </div>
      </el-col>
    </el-row>

    <el-drawer
      v-model="detailVisible"
      size="720px"
      destroy-on-close
      :title="detailTitle"
    >
      <div v-loading="detailLoading" class="pole-detail">
        <template v-if="detail && !detail.empty">
          <div class="detail-meta">
            <span>公里标 {{ detail.kilometer_mark != null ? Number(detail.kilometer_mark).toFixed(3) : '—' }}</span>
            <span>{{ detail.station || '—' }}</span>
            <span>{{ detail.direction }}</span>
          </div>
          <div class="detail-kpis">
            <div class="dk"><b>{{ detail.summary?.event_count ?? 0 }}</b><span>超限事件</span></div>
            <div class="dk danger"><b>{{ detail.summary?.level1 ?? 0 }}</b><span>一级</span></div>
            <div class="dk"><b>{{ detail.summary?.level2 ?? 0 }}</b><span>二级</span></div>
            <div class="dk"><b>{{ detail.summary?.hit_dates ?? 0 }}</b><span>命中期数</span></div>
          </div>

          <div class="detail-block" v-if="detailMetricOptions.length">
            <div class="detail-block-title">
              超限物理量曲线
              <span class="detail-chart-tip">所选期内该杆号测值，圆点标出超限</span>
            </div>
            <el-radio-group v-model="detailMetric" size="small" class="detail-metric-switch">
              <el-radio-button
                v-for="m in detailMetricOptions"
                :key="m"
                :label="m"
              >{{ m }}</el-radio-button>
            </el-radio-group>
            <v-chart
              v-if="detailChartOption"
              :key="`pole-metric-${detail.pole_no}-${detailMetric}`"
              class="detail-chart"
              :option="detailChartOption"
              :update-options="{ notMerge: true }"
              autoresize
            />
          </div>

          <div class="detail-block">
            <div class="detail-block-title">
              超限事件明细
              <span v-if="typeFilter" class="detail-chart-tip">已按「{{ typeFilter }}」筛选</span>
            </div>
            <el-table :data="detailEventsView" size="small" stripe max-height="280" table-layout="fixed">
              <el-table-column prop="date_label" label="检测日" min-width="100" show-overflow-tooltip />
              <el-table-column prop="type" label="类型" min-width="72" show-overflow-tooltip />
              <el-table-column prop="level_name" label="等级" min-width="64">
                <template #default="{ row }">
                  <span :class="{ danger: row.level === 2 }">{{ row.level_name }}</span>
                </template>
              </el-table-column>
              <el-table-column label="数值" min-width="90">
                <template #default="{ row }">
                  {{ row.value == null ? '—' : Number(row.value).toFixed(2) }}
                </template>
              </el-table-column>
            </el-table>
            <p v-if="!detailEventsView.length" class="empty-tip">本杆在所选期次无超限事件。</p>
          </div>
        </template>
        <p v-else-if="!detailLoading" class="empty-tip">{{ detail?.hint || '暂无详情' }}</p>
      </div>
    </el-drawer>
  </div>
</template>

<script>
import { ref, watch, computed, onUnmounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
} from 'echarts/components'
import { postAlarmOverview, postAlarmPoleDetail } from '../api/client'
import { formatInspectDate } from '../utils/dateRange'
import { useAnalysisQuery, analysisFingerprint, analysisPayload, cacheKey, getCached } from '../composables/useAnalysisQuery'
import {
  cloneAlarmRules,
  compactThresholds,
  defaultAlarmRules,
  isDefaultAlarmRules,
  loadAlarmRules,
  onAlarmRuleCatalog,
  ruleByType,
  saveAlarmRules,
} from '../utils/alarmRules'
import ChartCard from './common/ChartCard.vue'

use([CanvasRenderer, PieChart, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent])

function trendDateTag(item) {
  const raw = item?.date || item?.label || ''
  return String(raw).replace(/-/g, '').slice(0, 8)
}

/** 自然周（周一至周日）聚合键 */
function weekBucketKey(dateTag) {
  if (!dateTag || dateTag.length !== 8) return dateTag || ''
  const y = Number(dateTag.slice(0, 4))
  const m = Number(dateTag.slice(4, 6)) - 1
  const d = Number(dateTag.slice(6, 8))
  const dt = new Date(y, m, d)
  if (Number.isNaN(dt.getTime())) return dateTag
  const dow = dt.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(y, m, d + mondayOffset)
  const yy = monday.getFullYear()
  const mm = String(monday.getMonth() + 1).padStart(2, '0')
  const dd = String(monday.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

function shortTrendLabel(label) {
  const s = String(label || '')
  const m = s.match(/(\d{4})[-/]?(\d{2})[-/]?(\d{2})/)
  if (m) return `${m[2]}-${m[3]}`
  if (s.length > 8) return `${s.slice(0, 7)}…`
  return s
}

function pickDetailMetric(result, preferred) {
  const series = result?.metric_series || {}
  const keys = Object.keys(series)
  if (preferred && series[preferred]) return preferred
  for (const k of keys) {
    if ((series[k] || []).some((p) => (p.level || 0) > 0)) return k
  }
  return keys[0] || ''
}

function aggregateTrendByWeek(items) {
  const order = []
  const buckets = new Map()
  for (const t of items) {
    const tag = trendDateTag(t)
    const wk = weekBucketKey(tag)
    if (!buckets.has(wk)) {
      buckets.set(wk, { label: '', level1: 0, level2: 0, total: 0, _maxTag: '' })
      order.push(wk)
    }
    const slot = buckets.get(wk)
    slot.level1 += t.level1 || 0
    slot.level2 += t.level2 || 0
    slot.total += t.total || 0
    if (tag >= (slot._maxTag || '')) {
      slot._maxTag = tag
      slot.label = formatInspectDate(tag)
    }
  }
  return order.map((wk) => {
    const { label, level1, level2, total } = buckets.get(wk)
    return { label, level1, level2, total }
  })
}

export default {
  name: 'AlarmStatsPage',
  components: { VChart, ChartCard },
  emits: ['navigate'],
  props: {
    lineId: String,
    lineName: String,
    direction: String,
    selectedDates: { type: Array, default: () => [] },
    dateRange: { type: Array, default: () => null },
    manualBatch: { type: Boolean, default: false },
    batchByDate: { type: Object, default: () => ({}) },
    batchesByDate: { type: Object, default: () => ({}) },
    isDark: Boolean,
    level: { type: String, default: 'line' },
    navigateContext: { type: Object, default: () => ({}) },
  },
  setup(props) {
    const data = ref(null)
    const poleFilter = ref('')
    const typeFilter = ref('')
    const recurrentOnly = ref(false)
    const trendGranularity = ref('day')
    const detailVisible = ref(false)
    const detailLoading = ref(false)
    const detail = ref(null)
    const polePage = ref(1)
    const polePageSize = 50
    let detailLoadSeq = 0
    const thresholdsOpen = ref(false)
    const ruleDraft = ref(loadAlarmRules(props.lineId))
    const appliedRules = ref(cloneAlarmRules(ruleDraft.value))
    const detailMetric = ref('')

    const hydrateRules = (lineId) => {
      const saved = loadAlarmRules(lineId)
      ruleDraft.value = cloneAlarmRules(saved)
      appliedRules.value = cloneAlarmRules(saved)
    }

    const applyThresholds = () => {
      appliedRules.value = cloneAlarmRules(ruleDraft.value)
      saveAlarmRules(props.lineId, appliedRules.value)
    }

    const resetThresholds = () => {
      ruleDraft.value = defaultAlarmRules()
      applyThresholds()
    }

    const thresholdsDirty = computed(
      () => JSON.stringify(compactThresholds(ruleDraft.value)) !== JSON.stringify(compactThresholds(appliedRules.value)),
    )
    const thresholdsCustom = computed(() => !isDefaultAlarmRules(appliedRules.value))
    const thresholdPayload = computed(() => compactThresholds(appliedRules.value))

    const chartScopeKey = computed(() => {
      const dates = (props.selectedDates || []).join(',')
      const range = (props.dateRange || []).join(',')
      const batches = JSON.stringify(props.batchesByDate || {})
      const th = JSON.stringify(thresholdPayload.value)
      return `${props.lineId}|${props.direction}|${dates}|${range}|${batches}|${props.manualBatch ? 1 : 0}|${th}`
    })

    const typeDistribution = computed(() => data.value?.type_distribution || [])
    const poleCompare = computed(() => data.value?.pole_compare || [])
    const typeOptions = computed(() => {
      const fromApi = data.value?.alarm_types || data.value?.available_types || []
      if (fromApi.length) return fromApi
      return ['压力', '拉出值', '燃弧', '温度', '导高', '硬点']
    })
    const selectedDateCount = computed(
      () => data.value?.scope?.period_count || data.value?.scope?.date_count || props.selectedDates?.length || 0,
    )
    const summaryKpi = computed(() => data.value?.summary || null)
    const windowStory = computed(() => data.value?.window_story || null)
    const poleTotal = computed(() => data.value?.pole_total ?? (data.value?.pole_compare || []).length)

    /** 按类型投影杆号统计；无该类型则返回 null */
    const projectPole = (row, type) => {
      if (!type) {
        return {
          ...row,
          level1: row.level1 || 0,
          level2: row.level2 || 0,
          total: row.total || 0,
          hit_dates: row.hit_dates || 0,
          _types: row.types || Object.keys(row.by_type || {}),
        }
      }
      const t = row.by_type?.[type]
      if (!t || !(t.total > 0 || t.level1 > 0 || t.level2 > 0)) return null
      return {
        ...row,
        level1: t.level1 || 0,
        level2: t.level2 || 0,
        total: t.total ?? (t.level1 || 0) + (t.level2 || 0),
        hit_dates: t.hit_dates || 0,
        _types: [type],
      }
    }

    const filteredPoles = computed(() => {
      const q = poleFilter.value.trim().toLowerCase()
      const type = typeFilter.value
      const minHit = Number(windowStory.value?.min_hit_dates) || 2
      const rows = []
      for (const p of poleCompare.value) {
        const proj = projectPole(p, type)
        if (!proj) continue
        if (recurrentOnly.value && Number(proj.hit_dates || 0) < minHit) continue
        if (q) {
          const km = proj.kilometer_mark != null ? String(proj.kilometer_mark) : ''
          const hit =
            String(proj.pole_no || '').toLowerCase().includes(q) ||
            String(proj.station || '').toLowerCase().includes(q) ||
            km.includes(q)
          if (!hit) continue
        }
        rows.push(proj)
      }
      return rows
    })

    const pagedPoles = computed(() => {
      const start = (polePage.value - 1) * polePageSize
      return filteredPoles.value.slice(start, start + polePageSize)
    })

    const detailTitle = computed(() => {
      const p = detail.value?.pole_no || '—'
      return `杆号 ${p} · 超限详情`
    })

    const dateRangeText = computed(() => {
      if (props.dateRange?.length === 2) {
        return `${formatInspectDate(props.dateRange[0])} 至 ${formatInspectDate(props.dateRange[1])}（${props.selectedDates?.length || 0} 个检测日）`
      }
      const d = props.selectedDates || []
      if (!d.length) return '未选择日期'
      if (d.length === 1) return formatInspectDate(d[0])
      return `${formatInspectDate(d[d.length - 1])} ~ ${formatInspectDate(d[0])}`
    })

    const trend = computed(() => {
      const items = data.value?.trend || []
      if (trendGranularity.value !== 'week' || items.length < 2) return items
      return aggregateTrendByWeek(items)
    })

    const colors = {
      text: props.isDark ? '#e6f0ff' : '#1f2d3d',
      muted: props.isDark ? '#8aa0c8' : '#5c6b7f',
      line: props.isDark ? 'rgba(77,166,255,0.25)' : '#d0d7e5',
      accent: '#3488d9',
      accent2: '#3dbfad',
      danger: '#ff5c5c',
      warning: '#ffb24d',
      success: '#38d977',
    }

    const typeChartOption = computed(() => {
      const items = typeDistribution.value
      const palette = [colors.accent, colors.accent2, colors.warning, colors.success, colors.danger, '#9b8cff']
      return {
        animation: false,
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { textStyle: { color: colors.muted }, bottom: 0, type: 'scroll' },
        series: [
          {
            type: 'pie',
            radius: ['45%', '72%'],
            center: ['50%', '46%'],
            avoidLabelOverlap: true,
            itemStyle: { borderColor: props.isDark ? '#0b1020' : '#fff', borderWidth: 2 },
            label: { color: colors.text, formatter: '{b}\n{d}%' },
            labelLine: { lineStyle: { color: colors.muted } },
            data: items.map((it, i) => ({
              name: it.type,
              value: it.count,
              itemStyle: { color: palette[i % palette.length] },
            })),
          },
        ],
      }
    })

    const trendChartOption = computed(() => {
      const items = trend.value
      const rotate = items.length > 6
      return {
        animation: false,
        tooltip: { trigger: 'axis' },
        legend: { textStyle: { color: colors.muted }, top: 0, data: ['一级', '二级', '合计'] },
        grid: {
          left: 8,
          right: 16,
          top: 36,
          bottom: rotate ? 48 : 28,
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: items.map((t) => t.label),
          axisLabel: {
            color: colors.muted,
            fontSize: items.length > 12 ? 10 : 11,
            rotate: rotate ? 40 : 0,
            interval: items.length > 16 ? 'auto' : 0,
            hideOverlap: true,
            margin: 10,
            formatter: shortTrendLabel,
          },
          axisLine: { lineStyle: { color: colors.line } },
          boundaryGap: false,
        },
        yAxis: {
          type: 'value',
          minInterval: 1,
          axisLabel: { color: colors.muted },
          splitLine: { lineStyle: { color: colors.line } },
        },
        series: [
          {
            name: '一级',
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            clip: true,
            lineStyle: { color: colors.danger, width: 2 },
            itemStyle: { color: colors.danger },
            areaStyle: { color: 'rgba(255,92,92,0.12)' },
            data: items.map((t) => t.level1),
          },
          {
            name: '二级',
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            clip: true,
            lineStyle: { color: colors.accent, width: 2 },
            itemStyle: { color: colors.accent },
            areaStyle: { color: 'rgba(77,166,255,0.12)' },
            data: items.map((t) => t.level2),
          },
          {
            name: '合计',
            type: 'line',
            smooth: true,
            symbol: 'none',
            clip: true,
            lineStyle: { color: colors.warning, width: 1.5, type: 'dashed' },
            itemStyle: { color: colors.warning },
            data: items.map((t) => t.total),
          },
        ],
      }
    })

    const stationRanks = computed(() => {
      return [...(data.value?.station_compare || [])]
        .sort((a, b) => (b.total || 0) - (a.total || 0))
        .slice(0, 15)
        .map((r) => ({
          station: r.station || '—',
          level1: r.level1 || 0,
          level2: r.level2 || 0,
          total: r.total || (r.level1 || 0) + (r.level2 || 0),
        }))
    })
    const stationMaxTotal = computed(() => Math.max(1, ...stationRanks.value.map((r) => r.total || 0)))
    const stationBarPct = (n) => `${Math.max(0, (Number(n) || 0) / stationMaxTotal.value * 100)}%`

    const detailEventsView = computed(() => {
      const events = detail.value?.events || []
      const focus = typeFilter.value
      if (!focus) return events
      return events.filter((e) => e.type === focus)
    })

    const detailMetricOptions = computed(() => Object.keys(detail.value?.metric_series || {}))

    const detailChartOption = computed(() => {
      const metric = detailMetric.value
      const points = detail.value?.metric_series?.[metric] || []
      if (!metric || !points.length) return null
      const rule = ruleByType(appliedRules.value, metric) || {}
      const unit = rule.unit || ''
      const labels = points.map((p) => p.date_label || p.date || '')
      const values = points.map((p) => (p.value == null ? null : Number(p.value)))
      const levels = points.map((p) => Number(p.level) || 0)
      const rotate = labels.length > 6
      const markLine = []
      const pushMark = (y, name, color) => {
        if (y == null || !Number.isFinite(Number(y))) return
        markLine.push({
          yAxis: Number(y),
          name,
          label: {
            show: true,
            formatter: name,
            fontSize: 10,
            color,
          },
          lineStyle: { type: 'dashed', color, width: 1 },
        })
        if (rule.abs_value && Number(y) !== 0) {
          markLine.push({
            yAxis: -Number(y),
            name,
            label: { show: false },
            lineStyle: { type: 'dashed', color, width: 1 },
          })
        }
      }
      pushMark(rule.warn_lower, '二级下限', colors.warning)
      pushMark(rule.warn_upper, rule.lower != null ? '二级上限' : '二级', colors.warning)
      pushMark(rule.lower, '一级下限', colors.danger)
      pushMark(rule.upper, rule.lower != null ? '一级上限' : '一级', colors.danger)
      const hitData = values.map((v, i) => {
        if (v == null || levels[i] < 1) return null
        return {
          value: v,
          itemStyle: {
            color: levels[i] >= 2 ? colors.danger : colors.warning,
            borderColor: '#fff',
            borderWidth: 1.5,
          },
        }
      })
      const nums = values.filter((v) => v != null && Number.isFinite(v))
      const markYs = markLine.map((m) => m.yAxis).filter((y) => Number.isFinite(y))
      let yMin = nums.length ? Math.min(...nums, ...markYs) : (markYs.length ? Math.min(...markYs) : 0)
      let yMax = nums.length ? Math.max(...nums, ...markYs) : (markYs.length ? Math.max(...markYs) : 1)
      const pad = (yMax - yMin) * 0.08 || 1
      yMin -= pad
      yMax += pad
      return {
        animation: false,
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            const p = Array.isArray(params) ? params[0] : params
            const idx = p?.dataIndex ?? 0
            const v = values[idx]
            const lv = levels[idx]
            const tag = lv >= 2 ? '<br/>一级超限' : lv >= 1 ? '<br/>二级超限' : ''
            const shown = v == null ? '—' : `${Number(v).toFixed(2)}${unit ? ` ${unit}` : ''}`
            return `${labels[idx] || ''}<br/>${metric} ${shown}${tag}`
          },
        },
        grid: {
          left: 8,
          right: 16,
          top: 16,
          bottom: rotate ? 36 : 20,
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: labels,
          axisLabel: {
            color: colors.muted,
            fontSize: 10,
            rotate: rotate ? 40 : 0,
            interval: labels.length > 16 ? 'auto' : 0,
            hideOverlap: true,
            margin: 10,
            formatter: shortTrendLabel,
          },
          axisLine: { lineStyle: { color: colors.line } },
        },
        yAxis: {
          type: 'value',
          min: yMin,
          max: yMax,
          name: unit,
          nameTextStyle: { color: colors.muted, fontSize: 10 },
          axisLabel: { color: colors.muted, fontSize: 10 },
          splitLine: { lineStyle: { color: colors.line } },
        },
        series: [
          {
            name: metric,
            type: 'line',
            smooth: false,
            showSymbol: true,
            symbol: 'circle',
            symbolSize: 6,
            clip: true,
            connectNulls: false,
            data: values,
            lineStyle: { width: 1.8, color: colors.accent },
            itemStyle: { color: colors.accent },
            markLine: markLine.length
              ? { silent: true, symbol: 'none', animation: false, data: markLine }
              : undefined,
            z: 2,
          },
          {
            name: '超限',
            type: 'scatter',
            data: hitData,
            symbol: 'circle',
            clip: true,
            symbolSize: 12,
            z: 4,
          },
        ],
      }
    })

    const withThresholds = (base) => analysisPayload({
      ...base,
      thresholds: thresholdPayload.value,
    }, props)

    const onPoleClick = async (row) => {
      if (!props.lineId || !row?.pole_no) return
      const seq = ++detailLoadSeq
      detailVisible.value = true
      detailLoading.value = true
      detail.value = null
      detailMetric.value = ''
      try {
        const preferred = typeFilter.value || (row._types || row.types || [])[0] || ''
        const result = await postAlarmPoleDetail(withThresholds({
          line_id: props.lineId,
          direction: props.direction || '上行',
          pole_no: row.pole_no,
          date_from: props.dateRange?.[0] || '',
          date_to: props.dateRange?.[1] || '',
          dates: props.selectedDates || [],
        }))
        if (seq !== detailLoadSeq) return
        detail.value = result
        detailMetric.value = pickDetailMetric(result, preferred)
      } catch (e) {
        console.error(e)
        if (seq === detailLoadSeq) detail.value = { empty: true, hint: '加载本杆详情失败' }
      } finally {
        if (seq === detailLoadSeq) detailLoading.value = false
      }
    }

    const { loading } = useAnalysisQuery({
      fingerprint: () => analysisFingerprint(props, [props.dateRange, JSON.stringify(thresholdPayload.value)]),
      load: async ({ nextSeq, isStale, start, finish }) => {
        if (!props.lineId) {
          data.value = null
          return
        }
        const hasDates = (props.selectedDates || []).length > 0
        const hasRange = props.dateRange?.length === 2 && props.dateRange[0] && props.dateRange[1]
        if (!hasDates && !hasRange) {
          data.value = null
          return
        }
        const payload = withThresholds({
          line_id: props.lineId || '',
          direction: props.direction || '上行',
          date_from: props.dateRange?.[0] || '',
          date_to: props.dateRange?.[1] || '',
          dates: props.selectedDates || [],
        })
        const cached = getCached(cacheKey('/alarm/overview', payload))
        if (cached) {
          data.value = cached
          polePage.value = 1
          return
        }
        const seq = nextSeq()
        start(seq)
        polePage.value = 1
        detailVisible.value = false
        detail.value = null
        try {
          const result = await postAlarmOverview(payload)
          if (isStale(seq)) return
          data.value = result
        } catch (e) {
          console.error(e)
          if (!isStale(seq)) data.value = null
        } finally {
          finish(seq)
        }
      },
    })

    watch([poleFilter, typeFilter], () => {
      polePage.value = 1
    })

    watch(
      () => props.lineId,
      (id) => hydrateRules(id),
    )

    const stopCatalog = onAlarmRuleCatalog(() => hydrateRules(props.lineId))
    onUnmounted(stopCatalog)

    watch(
      () => props.navigateContext,
      (ctx) => {
        if (ctx?.pole_no) poleFilter.value = String(ctx.pole_no)
      },
      { immediate: true, deep: true },
    )

    return {
      loading,
      poleFilter,
      typeFilter,
      typeOptions,
      selectedDateCount,
      trendGranularity,
      chartScopeKey,
      dateRangeText,
      summaryKpi,
      windowStory,
      recurrentOnly,
      poleTotal,
      poleCompare,
      filteredPoles,
      pagedPoles,
      polePage,
      polePageSize,
      typeChartOption,
      trendChartOption,
      stationRanks,
      stationBarPct,
      thresholdsOpen,
      ruleDraft,
      thresholdsDirty,
      thresholdsCustom,
      applyThresholds,
      resetThresholds,
      onPoleClick,
      detailVisible,
      detailLoading,
      detail,
      detailTitle,
      detailEventsView,
      detailMetric,
      detailMetricOptions,
      detailChartOption,
    }
  },
}
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 4px;
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
  font-size: 13px;
  color: var(--om-text-dim);
}
.threshold-panel {
  padding: 10px 14px 12px;
  margin: 8px 0 12px;
}
.threshold-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.threshold-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--om-text);
}
.threshold-caret {
  color: var(--om-text-dim);
  font-size: 12px;
}
.threshold-actions {
  display: flex;
  gap: 8px;
}
.threshold-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--om-text-dim);
  line-height: 1.5;
}
.threshold-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.threshold-card {
  border: 1px solid var(--om-border, #e2e8f0);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--om-bg, #f8fafc);
}
.threshold-type {
  font-size: 13px;
  font-weight: 600;
  color: var(--om-text);
  margin-bottom: 6px;
}
.threshold-unit {
  margin-left: 4px;
  font-size: 11px;
  font-weight: 400;
  color: var(--om-text-dim);
}
.threshold-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 8px;
}
.threshold-fields label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
  color: var(--om-text-dim);
}
.threshold-fields input {
  width: 84px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--om-border, #d0d7e5);
  border-radius: 4px;
  background: var(--om-panel, #fff);
  color: var(--om-text);
  font-size: 12px;
}
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  margin: 0 0 14px;
}
.kpi-card {
  border: 1px solid var(--om-border, #e2e8f0);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--om-panel, #fff);
}
.kpi-name { font-size: 0.75rem; color: var(--om-text-dim, #64748b); }
.kpi-val { margin-top: 2px; font-size: 1.25rem; font-weight: 700; color: var(--om-text, #0f172a); }
.kpi-val.danger { color: var(--om-danger); }
.kpi-val.type-val { font-size: 1.05rem; }
.kpi-sub { margin-top: 2px; font-size: 0.7rem; color: var(--om-text-dim, #94a3b8); }
.station-panel {
  margin-top: 14px;
  padding: 14px 16px;
}
.station-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}
.station-legend {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--om-text-dim);
  flex-shrink: 0;
}
.station-legend .lg::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 4px;
  vertical-align: -1px;
}
.station-legend .l1::before { background: #ff5c5c; }
.station-legend .l2::before { background: #3488d9; }
.station-rank-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow: auto;
}
.station-rank-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.rank-idx {
  width: 22px;
  flex-shrink: 0;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--om-text-dim);
  line-height: 20px;
}
.rank-main {
  flex: 1;
  min-width: 0;
}
.rank-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.rank-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--om-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rank-total {
  font-size: 14px;
  font-weight: 700;
  color: var(--om-text);
  flex-shrink: 0;
}
.rank-bar {
  display: flex;
  height: 8px;
  margin-top: 4px;
  border-radius: 99px;
  overflow: hidden;
  background: var(--om-border, #e8edf5);
}
.bar-l1 { height: 100%; background: #ff5c5c; }
.bar-l2 { height: 100%; background: #3488d9; }
.rank-sub {
  margin-top: 3px;
  font-size: 11px;
  color: var(--om-text-dim);
}
.table-actions { margin-top: 10px; }
@media (max-width: 900px) {
  .kpi-strip { grid-template-columns: 1fr 1fr; }
}
.pole-panel {
  margin-top: 0;
  padding: 14px 16px;
  height: 100%;
  box-sizing: border-box;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.panel-filters {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--om-text);
  margin-bottom: 4px;
}
.panel-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--om-text-dim);
  max-width: 560px;
}
.panel-hint b,
.panel-hint strong {
  color: var(--om-text);
  font-weight: 600;
}
.chart-row,
.table-row {
  margin: 0 !important;
  margin-top: 14px !important;
}
.chart-canvas {
  width: 100%;
  height: 300px;
}
.pole-table {
  width: 100%;
}
:deep(.pole-table .el-table__cell .cell) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.danger {
  color: var(--om-danger);
  font-weight: 600;
}
.empty-tip {
  margin: 12px 0 4px;
  font-size: 13px;
  color: var(--om-text-muted);
  text-align: center;
  padding: 20px 0;
}
.table-pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
:deep(.el-table__row) {
  cursor: pointer;
}
.pole-detail {
  min-height: 200px;
}
.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: var(--om-text-dim);
  margin-bottom: 12px;
}
.detail-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}
.dk {
  background: var(--om-panel, rgba(0,0,0,0.03));
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
}
.dk b {
  display: block;
  font-size: 18px;
  color: var(--om-text);
}
.dk span {
  font-size: 11px;
  color: var(--om-text-dim);
}
.dk.danger b { color: var(--om-danger); }
.detail-note {
  margin: 0 0 14px;
  font-size: 12px;
  color: var(--om-text-muted);
  line-height: 1.5;
}
.detail-block {
  margin-bottom: 16px;
}
.detail-block-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--om-text);
  margin-bottom: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}
.detail-chart-tip {
  font-size: 11px;
  font-weight: 400;
  color: var(--om-text-dim);
}
.detail-metric-switch {
  margin-bottom: 8px;
}
.detail-chart {
  width: 100%;
  height: 240px;
}
</style>
