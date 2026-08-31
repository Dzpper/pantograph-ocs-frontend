<template>
  <div class="alarm-page" v-loading="loading">
    <div class="page-head">
      <h2 class="page-title">
        <span class="dot" />线路概况
      </h2>
      <span class="page-sub">{{ lineName || '未选线路' }} · {{ direction }} · {{ dateRangeText }}</span>
    </div>

    <DataSourceNote
      v-if="perfHint"
      type="warning"
      title="数据量提示"
      :message="perfHint"
    />

    <DataSourceNote
      type="info"
      title="定位与口径（二次分析 · 以杆号为准）"
      :message="scopeMessage"
    />

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :md="10">
        <ChartCard title="超限类型分布" description="按指标类型占比（阈值派生）">
          <v-chart class="chart-canvas" :option="typeChartOption" autoresize />
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
          <v-chart class="chart-canvas" :option="trendChartOption" autoresize />
        </ChartCard>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="table-row">
      <el-col :xs="24">
        <div class="om-panel pole-panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">超限杆号清单</div>
              <p class="panel-hint">
                <b>所选期次内</b>（当前 {{ selectedDateCount }} 个检测日）至少一期达阈值的杆号。
                点击行查看本杆详情。
                <template v-if="filteredPoles.length">展示 {{ filteredPoles.length }} 处。</template>
              </p>
            </div>
            <div class="panel-filters">
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
            class="pole-table"
            @row-click="onPoleClick"
          >
            <el-table-column prop="pole_no" label="杆号" min-width="78" />
            <el-table-column label="公里标" min-width="84" align="right">
              <template #default="{ row }">
                {{ row.kilometer_mark != null ? Number(row.kilometer_mark).toFixed(3) : '—' }}
              </template>
            </el-table-column>
            <el-table-column prop="station" label="站区" min-width="90" show-overflow-tooltip />
            <el-table-column label="类型" min-width="88" show-overflow-tooltip>
              <template #default="{ row }">
                {{ (row._types || row.types || []).join('、') || '—' }}
              </template>
            </el-table-column>
            <el-table-column prop="level1" label="一级" min-width="58" align="center" sortable>
              <template #default="{ row }">
                <span :class="{ danger: row.level1 > 0 }">{{ row.level1 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="level2" label="二级" min-width="58" align="center" sortable />
            <el-table-column prop="total" label="合计" min-width="58" align="center" sortable />
            <el-table-column prop="hit_dates" label="期数" min-width="58" align="center" sortable />
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
      size="560px"
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
          <p class="detail-note">{{ detail.criteria_note }}</p>

          <div class="detail-block">
            <div class="detail-block-title">
              本杆指标曲线（旧→新）
              <span v-if="typeFilter" class="detail-chart-tip">默认仅显示「{{ typeFilter }}」，可点图例打开其他量</span>
            </div>
            <v-chart
              :key="`pole-chart-${detail?.pole_no || ''}-${typeFilter || 'all'}`"
              class="detail-chart"
              :option="detailChartOption"
              autoresize
            />
          </div>

          <div class="detail-block">
            <div class="detail-block-title">
              超限事件明细
              <span v-if="typeFilter" class="detail-chart-tip">已按「{{ typeFilter }}」筛选</span>
            </div>
            <el-table :data="detailEventsView" size="small" stripe max-height="280">
              <el-table-column prop="date_label" label="检测日" min-width="100" />
              <el-table-column prop="type" label="类型" min-width="72" />
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
import { ref, watch, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components'
import { postAlarmOverview, postAlarmPoleDetail } from '../api/client'
import { formatInspectDate } from '../utils/dateRange'
import ChartCard from './common/ChartCard.vue'
import DataSourceNote from './common/DataSourceNote.vue'

use([CanvasRenderer, PieChart, LineChart, GridComponent, TooltipComponent, LegendComponent])

export default {
  name: 'AlarmStatsPage',
  components: { VChart, ChartCard, DataSourceNote },
  emits: ['navigate'],
  props: {
    lineId: String,
    lineName: String,
    direction: String,
    selectedDates: { type: Array, default: () => [] },
    dateRange: { type: Array, default: () => null },
    isDark: Boolean,
    level: { type: String, default: 'line' },
  },
  setup(props) {
    const loading = ref(false)
    const data = ref(null)
    const poleFilter = ref('')
    const typeFilter = ref('')
    const trendGranularity = ref('day')
    const detailVisible = ref(false)
    const detailLoading = ref(false)
    const detail = ref(null)
    const polePage = ref(1)
    const polePageSize = 50

    const typeDistribution = computed(() => data.value?.type_distribution || [])
    const poleCompare = computed(() => data.value?.pole_compare || [])
    const typeOptions = computed(() => {
      const fromApi = data.value?.alarm_types || data.value?.available_types || []
      if (fromApi.length) return fromApi
      return ['压力', '拉出值', '燃弧', '温度', '导高', '硬点']
    })
    const selectedDateCount = computed(
      () => data.value?.scope?.date_count || props.selectedDates?.length || 0,
    )

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
      const rows = []
      for (const p of poleCompare.value) {
        const proj = projectPole(p, type)
        if (!proj) continue
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

    const perfHint = computed(() => {
      const parts = []
      if (data.value?.scope?.date_truncated) {
        parts.push(`检测日过多，已按最近 ${data.value.scope.max_overview_dates || 60} 期统计`)
      }
      if (data.value?.pole_truncated) {
        parts.push(`超限杆号共 ${data.value.pole_total || 0} 处，列表仅展示前 ${data.value.max_pole_rows || 400} 处（按一级优先排序）`)
      }
      return parts.length ? `${parts.join('；')}。可缩小顶部时间范围以加快加载。` : ''
    })

    const scopeMessage = computed(() => {
      const line = props.lineName || '当前线路'
      const n = selectedDateCount.value
      return `${line} ${props.direction || ''} · 已选 ${n} 个检测日 · 清单为所选期内至少一期超限的杆号。`
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
      const buckets = []
      for (let i = 0; i < items.length; i += 7) {
        const slice = items.slice(i, i + 7)
        buckets.push({
          label: slice[slice.length - 1]?.label || '',
          level1: slice.reduce((s, t) => s + (t.level1 || 0), 0),
          level2: slice.reduce((s, t) => s + (t.level2 || 0), 0),
          total: slice.reduce((s, t) => s + (t.total || 0), 0),
        })
      }
      return buckets
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
      return {
        tooltip: { trigger: 'axis' },
        legend: { textStyle: { color: colors.muted }, top: 0, data: ['一级', '二级', '合计'] },
        grid: { left: 8, right: 16, top: 36, bottom: 40, containLabel: true },
        xAxis: {
          type: 'category',
          data: items.map((t) => t.label),
          axisLabel: { color: colors.muted, fontSize: 11 },
          axisLine: { lineStyle: { color: colors.line } },
          boundaryGap: false,
        },
        yAxis: {
          type: 'value',
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
            lineStyle: { color: colors.warning, width: 1.5, type: 'dashed' },
            itemStyle: { color: colors.warning },
            data: items.map((t) => t.total),
          },
        ],
      }
    })

    const detailChartOption = computed(() => {
      const seriesMap = detail.value?.metric_series || {}
      let names = Object.keys(seriesMap)
      if (!names.length) {
        return {
          title: { text: '暂无曲线', left: 'center', top: 'middle', textStyle: { color: colors.muted, fontSize: 13 } },
        }
      }
      const focus = typeFilter.value
      // 筛选类型置顶，便于默认展示
      if (focus && names.includes(focus)) {
        names = [focus, ...names.filter((n) => n !== focus)]
      }
      const xLabels = (seriesMap[names[0]] || []).map((p) => p.date_label)
      const palette = [colors.accent, colors.accent2, colors.warning, colors.danger, colors.success, '#9b8cff']
      const selected = {}
      names.forEach((n) => {
        // 有类型筛选时：仅打开该物理量，其余默认关闭，用户可点图例打开
        selected[n] = focus ? n === focus : true
      })
      // 筛选类型无数据时仍展示全部，避免空白图
      if (focus && !names.includes(focus)) {
        names.forEach((n) => {
          selected[n] = true
        })
      }
      return {
        tooltip: { trigger: 'axis' },
        legend: {
          textStyle: { color: colors.muted, fontSize: 11 },
          top: 0,
          type: 'scroll',
          selected,
          selector: focus
            ? [
                { type: 'all', title: '全开' },
                { type: 'inverse', title: '反选' },
              ]
            : undefined,
        },
        grid: { left: 8, right: 12, top: 44, bottom: 28, containLabel: true },
        xAxis: {
          type: 'category',
          data: xLabels,
          axisLabel: { color: colors.muted, fontSize: 10 },
          axisLine: { lineStyle: { color: colors.line } },
        },
        yAxis: {
          type: 'value',
          scale: true,
          axisLabel: { color: colors.muted, fontSize: 10 },
          splitLine: { lineStyle: { color: colors.line } },
        },
        series: names.map((name, i) => ({
          name,
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: name === focus ? 7 : 5,
          connectNulls: true,
          lineStyle: { width: name === focus ? 2.5 : 2, color: palette[i % palette.length] },
          itemStyle: { color: palette[i % palette.length] },
          data: (seriesMap[name] || []).map((p) => p.value),
        })),
      }
    })

    const detailEventsView = computed(() => {
      const events = detail.value?.events || []
      const focus = typeFilter.value
      if (!focus) return events
      return events.filter((e) => e.type === focus)
    })

    const onPoleClick = async (row) => {
      if (!props.lineId || !row?.pole_no) return
      detailVisible.value = true
      detailLoading.value = true
      detail.value = null
      try {
        detail.value = await postAlarmPoleDetail({
          line_id: props.lineId,
          direction: props.direction || '上行',
          pole_no: row.pole_no,
          date_from: props.dateRange?.[0] || '',
          date_to: props.dateRange?.[1] || '',
          dates: props.selectedDates || [],
        })
      } catch (e) {
        console.error(e)
        detail.value = { empty: true, hint: '加载本杆详情失败' }
      } finally {
        detailLoading.value = false
      }
    }

    const load = async () => {
      if (!props.lineId) {
        data.value = null
        return
      }
      loading.value = true
      try {
        data.value = await postAlarmOverview({
          line_id: props.lineId || '',
          direction: props.direction || '上行',
          date_from: props.dateRange?.[0] || '',
          date_to: props.dateRange?.[1] || '',
          dates: props.selectedDates || [],
        })
      } catch (e) {
        console.error(e)
        data.value = null
      } finally {
        loading.value = false
      }
    }

    watch(
      () => [props.lineId, props.direction, props.selectedDates, props.dateRange],
      () => {
        polePage.value = 1
        load()
      },
      { immediate: true, deep: true },
    )

    watch([poleFilter, typeFilter], () => {
      polePage.value = 1
    })

    return {
      loading,
      poleFilter,
      typeFilter,
      typeOptions,
      selectedDateCount,
      trendGranularity,
      dateRangeText,
      scopeMessage,
      perfHint,
      poleCompare,
      filteredPoles,
      pagedPoles,
      polePage,
      polePageSize,
      typeChartOption,
      trendChartOption,
      onPoleClick,
      detailVisible,
      detailLoading,
      detail,
      detailTitle,
      detailChartOption,
      detailEventsView,
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
.pole-panel,
.chronic-panel {
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
.panel-hint,
.chronic-head .panel-hint {
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
.chronic-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
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
.detail-chart {
  width: 100%;
  height: 240px;
}
</style>
