<template>
  <div class="rpt-page" v-loading="loading">
    <div class="page-head no-print">
      <h2 class="page-title"><span class="dot" />汇报</h2>
      <el-select v-model="reportType" style="width: 220px" @change="load">
        <el-option v-for="t in reportTypes" :key="t.value" :label="t.label" :value="t.value" />
      </el-select>
      <template v-if="reportType === 'strip_wear' || reportType === 'comprehensive'">
        <span class="om-toolbar-label no-print">限厚线</span>
        <el-input-number
          v-model="minThickness"
          class="no-print"
          :min="0.1"
          :step="0.5"
          :precision="1"
          style="width: 110px"
          @change="onMinThicknessChange"
        />
        <span class="page-sub no-print">mm（修改后自动重算）</span>
      </template>
      <span class="page-sub line-badge">当前线路：{{ lineName || '未选择' }}</span>
      <el-button type="primary" plain size="small" @click="onPrint" style="margin-left: auto">打印 / 导出 PDF</el-button>
    </div>

    <p class="page-hint no-print">{{ currentHint }} · 报告严格按上方所选线路生成；无对应数据则不出具</p>

    <template v-if="data && !data.empty">
      <div class="report-paper" id="a4-report-paper">
        <header class="rpt-header">
          <div class="rpt-brand">
            <div class="rpt-brand-mark">国创弓网数据及碳滑板磨耗分析</div>
            <div class="rpt-title">{{ data.report_title || '检测分析报告' }}</div>
            <div class="rpt-sub">
              {{ reportLineTitle }}
              <template v-if="data.direction && data.direction !== '—'"> · {{ data.direction }}</template>
              <template v-if="dateText"> · {{ dateText }}</template>
            </div>
          </div>
          <div class="rpt-meta">
            <div>生成时间：{{ data.generated_at }}</div>
            <div v-if="data.threshold_a2s != null">阈值：{{ Number(data.threshold_a2s).toFixed(0) }} A²·s</div>
            <div v-if="data.kpi?.min_thickness_mm != null">限厚线：{{ Number(data.kpi.min_thickness_mm) }} mm</div>
            <div v-if="data.strip_wear?.kpi?.min_thickness_mm != null">限厚线：{{ Number(data.strip_wear.kpi.min_thickness_mm) }} mm</div>
            <div v-if="data.sample_count != null">采样点：{{ data.sample_count }}</div>
          </div>
        </header>

        <section class="rpt-section" v-if="data.report_type === 'comprehensive' && data.data_coverage">
          <h3>一、数据覆盖</h3>
          <table class="rpt-table">
            <tbody>
              <tr>
                <td>融合状态</td>
                <td><b>{{ data.data_coverage.fusion_label }}</b></td>
                <td>弓网检测</td>
                <td>{{ data.data_coverage.monitor?.period_count ?? 0 }} 期 · 最近 {{ data.data_coverage.monitor?.latest_date || '—' }}</td>
              </tr>
              <tr>
                <td>碳滑板</td>
                <td>{{ data.data_coverage.strip_wear?.vehicle_count ?? 0 }} 辆 · {{ coverageStripName }}</td>
                <td>温湿度</td>
                <td>{{ data.data_coverage.climate?.day_count ?? 0 }} 天 · {{ coverageClimateName }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="data.data_coverage.missing?.length" class="rpt-caption">
            缺口：{{ data.data_coverage.missing.join('；') }}
          </p>
          <p class="rpt-caption">{{ data.data_coverage.monitor_note }}</p>
        </section>

        <section class="rpt-section">
          <h3>{{ data.report_type === 'comprehensive' && data.data_coverage ? '二、决策摘要' : '一、决策摘要' }}</h3>
          <div class="rpt-summary-box">
            <ul class="rpt-conclusions">
              <li v-for="(c, i) in data.conclusions || []" :key="i">{{ c }}</li>
            </ul>
          </div>
        </section>

        <!-- 燃弧锚段分析：上下行分列 -->
        <template v-if="data.report_type === 'arc_anchor'">
          <section class="rpt-section">
            <h3>二、重点关注杆号（按行别分列）</h3>
            <template v-if="(data.units_up || []).length || (data.units_down || []).length || data.priority_units?.length">
              <h4 class="rpt-h4">2.1 上行</h4>
              <table class="rpt-table" v-if="(data.units_up || arcUnitsByDir('上行')).length">
                <thead>
                  <tr>
                    <th>杆号</th>
                    <th>公里标</th>
                    <th>站区</th>
                    <th>超限次数</th>
                    <th>超限检测日数</th>
                    <th>最大强度 (A²·s)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in (data.units_up || arcUnitsByDir('上行'))" :key="'up-' + u.pole_no">
                    <td><b>{{ u.pole_no }}</b></td>
                    <td>{{ u.km != null ? Number(u.km).toFixed(3) : '—' }}</td>
                    <td>{{ u.station || '—' }}</td>
                    <td>{{ u.exceed_count }}</td>
                    <td>{{ u.hit_dates ?? '—' }}</td>
                    <td><b>{{ fmtIntensity(u.max_intensity) }}</b></td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="rpt-empty">上行暂无达到关注分级的杆号。</p>

              <h4 class="rpt-h4" style="margin-top: 16px">2.2 下行</h4>
              <table class="rpt-table" v-if="(data.units_down || arcUnitsByDir('下行')).length">
                <thead>
                  <tr>
                    <th>杆号</th>
                    <th>公里标</th>
                    <th>站区</th>
                    <th>超限次数</th>
                    <th>超限检测日数</th>
                    <th>最大强度 (A²·s)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in (data.units_down || arcUnitsByDir('下行'))" :key="'dn-' + u.pole_no">
                    <td><b>{{ u.pole_no }}</b></td>
                    <td>{{ u.km != null ? Number(u.km).toFixed(3) : '—' }}</td>
                    <td>{{ u.station || '—' }}</td>
                    <td>{{ u.exceed_count }}</td>
                    <td>{{ u.hit_dates ?? '—' }}</td>
                    <td><b>{{ fmtIntensity(u.max_intensity) }}</b></td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="rpt-empty">下行暂无达到关注分级的杆号。</p>
            </template>
            <p v-else class="rpt-empty">本期未见达到关注分级的杆号。</p>
            <p class="rpt-caption">「超限检测日数」：所选期内该杆号出现燃弧超限的检测日个数。</p>
          </section>

          <section class="rpt-section">
            <h3>三、两日燃弧强度对比</h3>
            <p class="rpt-caption">散点为阈值以上超限点；蓝/红为两个检测日。阈值 {{ Number(data.threshold_a2s || thresholdA2s).toLocaleString('zh-CN') }} A²·s。纵轴单位：A²·s。</p>
            <div class="rpt-chart-grid rpt-chart-grid-2">
              <div class="rpt-chart-block">
                <h4 class="rpt-h4">3.1 上行</h4>
                <div class="rpt-chart-wrap" v-if="arcUpOption">
                  <v-chart class="rpt-chart" :option="arcUpOption" autoresize />
                </div>
                <p v-else class="rpt-empty">上行暂无超限散点。</p>
              </div>
              <div class="rpt-chart-block">
                <h4 class="rpt-h4">3.2 下行</h4>
                <div class="rpt-chart-wrap" v-if="arcDownOption">
                  <v-chart class="rpt-chart" :option="arcDownOption" autoresize />
                </div>
                <p v-else class="rpt-empty">下行暂无超限散点。</p>
              </div>
            </div>
          </section>

          <section class="rpt-section">
            <h3>四、两日速度-燃弧对比（上下行 · 逐区间）</h3>
            <p class="rpt-caption no-print" v-if="chartsLoading">正在加载区间附图（{{ speedBlocks.length }} 已就绪）…</p>
            <p class="rpt-caption" v-else-if="!speedBlocks.length">暂无速度-燃弧区间图。</p>
            <div v-else class="rpt-chart-grid rpt-chart-grid-speed">
              <div
                v-for="(block, idx) in speedBlocks"
                :key="block.key"
                class="rpt-chart-block"
              >
                <h4 class="rpt-h4">{{ sectionLabel(idx) }} {{ block.direction }} · {{ block.name }}</h4>
                <div class="rpt-chart-wrap rpt-chart-speed">
                  <v-chart class="rpt-chart" :option="block.option" autoresize />
                </div>
              </div>
            </div>
          </section>
        </template>

        <!-- 综合检测：汇总燃弧综合分析 / 碳滑板磨耗 / 隧道温湿度 -->
        <template v-else-if="data.report_type === 'comprehensive'">
          <!-- 燃弧综合分析 -->
          <section class="rpt-section rpt-section-break" v-if="data.correlation">
            <h3>{{ data.data_coverage ? '三' : '二' }}、综合分析（燃弧相关）</h3>
            <div class="rpt-chart-wrap" v-if="corrTrendOption">
              <v-chart class="rpt-chart" :option="corrTrendOption" autoresize />
            </div>
            <h4 class="rpt-h4" style="margin-top: 12px">反复出现的关注杆位</h4>
            <table class="rpt-table" v-if="data.correlation.chronic_poles?.length">
              <thead>
                <tr><th>杆号</th><th>站区</th><th>出现/窗口</th><th>复发率</th><th>累计时长</th></tr>
              </thead>
              <tbody>
                <tr v-for="p in data.correlation.chronic_poles" :key="p.pole_no">
                  <td><b>{{ p.pole_no }}</b></td>
                  <td>{{ p.station_area_name || '—' }}</td>
                  <td>{{ p.appear_days }} / {{ p.total_days || data.correlation.window_size }}</td>
                  <td>{{ p.appear_rate != null ? (p.appear_rate * 100).toFixed(0) + '%' : '—' }}</td>
                  <td>{{ p.total_arc_ms != null ? p.total_arc_ms + ' ms' : '—' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="rpt-empty">窗口内暂无反复出现的关注杆位。</p>
          </section>

          <!-- 碳滑板磨耗 -->
          <section class="rpt-section" v-if="data.strip_wear">
            <h3>{{ comprehensiveSectionNo(1) }}、碳滑板磨耗</h3>
            <table class="rpt-table">
              <tbody>
                <tr>
                  <td>在测车辆</td><td>{{ data.strip_wear.kpi?.vehicle_count ?? 0 }}</td>
                  <td>偏磨车辆</td><td><b :class="{ danger: (data.strip_wear.kpi?.uneven_vehicle_count || 0) > 0 }">{{ data.strip_wear.kpi?.uneven_vehicle_count ?? 0 }}</b></td>
                </tr>
                <tr>
                  <td>全线磨耗率</td><td>{{ data.strip_wear.kpi?.fleet_wear_rate_per_10k ?? '—' }} mm/万公里</td>
                  <td>限厚线</td><td>{{ data.strip_wear.kpi?.min_thickness_mm }} mm</td>
                </tr>
              </tbody>
            </table>
            <h4 class="rpt-h4" style="margin-top: 12px">关注车辆（偏磨 / 厚度偏低 / 磨耗异常）</h4>
            <table class="rpt-table" v-if="data.strip_wear.watch_vehicles?.length">
              <thead>
                <tr><th>车号</th><th>情况</th><th>最薄板</th><th>厚度</th></tr>
              </thead>
              <tbody>
                <tr v-for="v in data.strip_wear.watch_vehicles" :key="v.vehicle_no">
                  <td>{{ v.vehicle_no }}</td>
                  <td>{{ v.situation }}</td>
                  <td>{{ v.governing_strip || '—' }}</td>
                  <td>{{ v.current_min_height != null ? Number(v.current_min_height).toFixed(1) : '—' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="rpt-empty">本周期无明显偏磨或厚度偏低车辆。</p>
          </section>

          <!-- 隧道温湿度 -->
          <section class="rpt-section rpt-section-break" v-if="data.climate">
            <h3>{{ comprehensiveSectionNo(2) }}、隧道温湿度（近 {{ data.climate.kpi?.days ?? 0 }} 日）</h3>
            <table class="rpt-table">
              <tbody>
                <tr>
                  <td>均温</td><td>{{ data.climate.kpi?.mean_temp_c ?? '—' }} ℃</td>
                  <td>均湿</td><td>{{ data.climate.kpi?.mean_rh_pct ?? '—' }} %</td>
                  <td>高湿日 (≥80%)</td><td>{{ data.climate.kpi?.high_rh_days ?? 0 }}</td>
                </tr>
              </tbody>
            </table>
            <div class="rpt-chart-wrap" v-if="climateTrendOption" style="margin-top: 10px">
              <v-chart class="rpt-chart" :option="climateTrendOption" autoresize />
            </div>
            <p v-else class="rpt-empty">近期温湿度数据不足，暂无法绘制曲线。</p>
          </section>

          <section class="rpt-section rpt-section-break" v-if="data.watch_list?.length">
            <h3>附录、参考关注点</h3>
            <table class="rpt-table">
              <thead>
                <tr><th>类型</th><th>对象</th><th>摘要</th><th>说明</th></tr>
              </thead>
              <tbody>
                <tr v-for="w in data.watch_list" :key="w.item_id">
                  <td>{{ w.type_label }}</td>
                  <td><b>{{ w.title }}</b></td>
                  <td>{{ w.summary }}</td>
                  <td>{{ w.detail }}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </template>

        <!-- 双期对比已停用 -->

        <!-- 碳滑板 -->
        <template v-else-if="data.report_type === 'strip_wear'">
          <section class="rpt-section">
            <h3>二、车队概览</h3>
            <table class="rpt-table">
              <tbody>
                <tr>
                  <td>在测车辆</td><td>{{ data.kpi?.vehicle_count ?? 0 }}</td>
                  <td>偏磨车辆</td><td>{{ data.kpi?.uneven_vehicle_count ?? 0 }}</td>
                </tr>
                <tr>
                  <td>纳入评估</td><td>{{ data.kpi?.predict_count ?? 0 }}</td>
                  <td>厚度偏低</td><td><b>{{ data.kpi?.thin_count ?? 0 }}</b>（限厚 {{ data.kpi?.min_thickness_mm ?? '—' }} mm）</td>
                </tr>
                <tr>
                  <td>列入关注</td><td colspan="3"><b>{{ data.kpi?.urgent_count ?? 0 }}</b></td>
                </tr>
              </tbody>
            </table>
          </section>
          <section class="rpt-section rpt-section-break">
            <h3>三、关注车辆清单（分析结果）</h3>
            <table class="rpt-table" v-if="data.vehicles?.length">
              <thead>
                <tr>
                  <th>车号</th><th>情况</th><th>最薄板</th><th>厚度</th>
                  <th>估算可用</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="v in data.vehicles" :key="v.vehicle_no">
                  <td>{{ v.vehicle_no }}</td>
                  <td>{{ v.status }}</td>
                  <td>{{ v.governing_strip || '—' }}</td>
                  <td>{{ v.current_min_height != null ? Number(v.current_min_height).toFixed(1) : '—' }}</td>
                  <td>{{ v.rul_days != null ? v.rul_days + ' 天' : '—' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="rpt-empty">本周期无明显偏磨或厚度偏低车辆。</p>
          </section>
        </template>

        <footer class="rpt-footer">
          <p>{{ data.data_note }}</p>
          <p>国创弓网数据及碳滑板磨耗分析 · 监测数据二次分析 · 供决策参考</p>
        </footer>
      </div>
    </template>

    <div v-else-if="!loading" class="om-panel empty-card no-print">
      <p v-if="data?.empty">{{ data.hint || '暂无足够数据生成该报告。' }}</p>
      <p v-else-if="!lineId">请先在顶部选择线路。</p>
      <p v-else>暂无报告数据。</p>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onActivated } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { ScatterChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import { postInspectionReport, postArcAnalysis, fetchSpeedArcMeta, fetchSpeedArcSegment } from '../api/client'
import { formatSci, formatIntensityA2s, formatAxisIntensity } from '../utils/chartOptions'
import { printReportElement } from '../utils/printReport'
import { loadStripPrefs, saveStripPrefs, clampMinThickness } from '../utils/stripPrefs'
import { formatLineName } from '../utils/lineDisplay'

use([CanvasRenderer, ScatterChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent])

const REPORT_TYPES = [
  {
    value: 'strip_wear',
    label: '碳滑板磨耗分析简报',
    hint: '按可用预估中的限厚线列出偏磨/厚度偏低等关注车辆；无碳滑板数据则不出具。',
  },
  {
    value: 'arc_anchor',
    label: '燃弧超限锚段分析报告',
    hint: '按行别分列关注杆号与超限明细；无弓网检测数据则不出具。',
  },
  {
    value: 'comprehensive',
    label: '综合检测分析报告',
    hint: '汇总燃弧综合分析、碳滑板磨耗（含偏磨）与隧道温湿度近7日情况；缺哪类数据则该段落不出具。',
  },
]

const SERIES_COLORS = ['#2471A3', '#C0392B', '#1ABC9C', '#8E44AD']

/** 报告内坐标轴用千分位整数，避免「20万 / 5k」 */
function axisIntensityLabel(v) {
  return formatAxisIntensity(v)
}

function shortDateLabel(label) {
  const raw = String(label || '')
  const s = raw.replace(/-/g, '')
  if (s.length >= 8 && /^\d{8}/.test(s)) return `${s.slice(4, 6)}-${s.slice(6, 8)}`
  return raw.length > 10 ? raw.slice(5, 10) : raw
}

function clipStation(name, max = 5) {
  const t = String(name || '').trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function buildArcCompareOption(arcPayload, threshold) {
  const seriesList = arcPayload?.series || []
  if (!seriesList.length) return null
  const thr = threshold ?? arcPayload?.threshold_a2s ?? 200000
  let yMax = thr
  const echartsSeries = seriesList.map((s, i) => {
    const pts = s.points || []
    pts.forEach((p) => {
      const v = p.intensity ?? p.i2t
      if (v != null) yMax = Math.max(yMax, v)
    })
    return {
      name: shortDateLabel(s.label),
      type: 'scatter',
      symbolSize: 6,
      itemStyle: { color: s.color || SERIES_COLORS[i % SERIES_COLORS.length], opacity: 0.85 },
      data: pts.map((p) => ({
        value: [p.km, p.intensity ?? p.i2t],
        ...p,
      })),
    }
  })
  if (!echartsSeries.some((s) => s.data.length)) return null
  return {
    backgroundColor: '#fff',
    animation: false,
    textStyle: { color: '#1f2d3d', fontSize: 10 },
    legend: {
      top: 2,
      left: 'center',
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 16,
      textStyle: { color: '#1f2d3d', fontSize: 10 },
    },
    grid: { left: 18, right: 22, top: 36, bottom: 28, containLabel: true },
    tooltip: { trigger: 'item', confine: true },
    xAxis: {
      type: 'value',
      scale: true,
      name: 'km',
      nameLocation: 'end',
      nameGap: 8,
      nameTextStyle: { fontSize: 9, color: '#5c6b7f' },
      axisLabel: {
        formatter: (v) => Number(v).toFixed(1),
        color: '#5c6b7f',
        fontSize: 10,
        hideOverlap: true,
        margin: 8,
      },
      splitLine: { lineStyle: { color: '#eee' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'A²·s',
      nameLocation: 'end',
      nameGap: 8,
      nameTextStyle: { fontSize: 10, color: '#5c6b7f' },
      min: 0,
      max: yMax * 1.18,
      scale: false,
      axisLabel: {
        formatter: axisIntensityLabel,
        color: '#5c6b7f',
        fontSize: 10,
        margin: 8,
      },
      splitLine: { lineStyle: { color: '#eee' } },
      axisTick: { show: false },
    },
    series: echartsSeries.map((s, idx) =>
      idx === 0
        ? {
            ...s,
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { type: 'dashed', color: '#e85d6a', width: 1 },
              label: { show: false },
              data: [{ yAxis: thr }],
            },
          }
        : s
    ),
  }
}

function buildSpeedCompareOption(segment) {
  if (!segment) return null
  const xAxisData = segment.x_axis || {}
  const poles = xAxisData.poles || []
  const stations = xAxisData.stations || []
  const n = poles.length
  if (!n) return null
  const startName = clipStation(xAxisData.tick_labels?.[0] || stations[0] || '起点')
  const endName = clipStation(
    xAxisData.tick_labels?.[xAxisData.tick_labels.length - 1] || stations[n - 1] || '终点',
  )
  const xCategories = Array.from({ length: n }, (_, i) => {
    if (i === 0) return startName
    if (i === n - 1) return endName
    return ''
  })
  let speedMax = 0
  ;(segment.series || []).forEach((s) => {
    ;(s.speed || []).forEach((v) => {
      if (v != null) speedMax = Math.max(speedMax, v)
    })
  })
  const echartsSeries = []
  ;(segment.series || []).forEach((s, i) => {
    const color = s.color || SERIES_COLORS[i % SERIES_COLORS.length]
    const day = shortDateLabel(s.label)
    echartsSeries.push({
      name: `${day}速度`,
      type: 'line',
      yAxisIndex: 0,
      showSymbol: false,
      data: s.speed,
      lineStyle: { width: 1.5, color },
      itemStyle: { color },
    })
    echartsSeries.push({
      name: `${day}燃弧`,
      type: 'scatter',
      yAxisIndex: 1,
      symbolSize: 5,
      itemStyle: { color, opacity: 0.85 },
      data: (s.i2t_points || []).map((p) => [p.x_index, p.i2t]),
    })
  })
  return {
    backgroundColor: '#fff',
    animation: false,
    textStyle: { color: '#1f2d3d', fontSize: 10 },
    legend: {
      type: 'plain',
      top: 2,
      left: 'center',
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 10,
      textStyle: { color: '#1f2d3d', fontSize: 9 },
    },
    grid: { left: 18, right: 24, top: 36, bottom: 28, containLabel: true },
    tooltip: { trigger: 'item', confine: true },
    xAxis: {
      type: 'category',
      data: xCategories,
      boundaryGap: false,
      axisTick: { show: false },
      axisLabel: {
        interval: 0,
        hideOverlap: true,
        formatter: (v) => v || '',
        color: '#5c6b7f',
        fontSize: 10,
        margin: 10,
      },
    },
    yAxis: [
      {
        type: 'value',
        name: 'km/h',
        nameTextStyle: { fontSize: 9, color: '#5c6b7f' },
        min: 0,
        max: speedMax > 0 ? Math.ceil(speedMax * 1.2) : 100,
        splitNumber: 4,
        axisLabel: {
          formatter: (v) => Number(v).toFixed(0),
          color: '#5c6b7f',
          fontSize: 10,
          margin: 6,
        },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#eee' } },
      },
      {
        type: 'value',
        name: 'A²·s',
        nameTextStyle: { fontSize: 9, color: '#5c6b7f' },
        scale: true,
        splitNumber: 4,
        axisLabel: {
          formatter: axisIntensityLabel,
          color: '#5c6b7f',
          fontSize: 10,
          margin: 6,
        },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    series: echartsSeries,
  }
}

export default {
  name: 'InspectionReportPage',
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
    const data = ref(null)
    const reportType = ref('strip_wear')
    const thresholdA2s = ref(200000)
    const stripPrefs0 = loadStripPrefs()
    const minThickness = ref(clampMinThickness(stripPrefs0.minThickness))
    const reportTypes = REPORT_TYPES
    const arcUpOption = ref(null)
    const arcDownOption = ref(null)
    const speedBlocks = ref([])
    const chartsLoading = ref(false)
    let chartsSeq = 0

    const currentHint = computed(() => REPORT_TYPES.find((t) => t.value === reportType.value)?.hint || '')

    const reportLineTitle = computed(() =>
      formatLineName(data.value?.line_name, props.lineId) || props.lineName || '—',
    )

    const coverageStripName = computed(() =>
      formatLineName(
        data.value?.data_coverage?.strip_wear?.line_name,
        data.value?.data_coverage?.strip_wear?.line_code,
      ) || '—',
    )

    const coverageClimateName = computed(() =>
      formatLineName(
        data.value?.data_coverage?.climate?.line_name,
        data.value?.data_coverage?.climate?.line_code,
      ) || '—',
    )

    const formatDate = (d) => {
      if (!d) return '—'
      const s = String(d).replace(/-/g, '')
      if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
      return d
    }
    const dateText = computed(() => {
      if (!data.value) return ''
      if (data.value.dates?.length) return data.value.dates.map(formatDate).join(' / ')
      return formatDate(data.value.date)
    })
    const fmtSci = (v) => formatSci(v, 2)
    const fmtIntensity = (v) => formatIntensityA2s(v)
    const formatDelta = (d) => {
      if (d == null || Number.isNaN(Number(d))) return '—'
      const n = Number(d)
      if (n > 0) return `+${n}`
      return String(n)
    }
    const gradeClass = (g) => ({
      'g-excellent': g === '优',
      'g-good': g === '良',
      'g-mid': g === '中',
      'g-bad': g === '差',
    })
    const sectionLabel = (idx) => `4.${idx + 1}`
    const arcUnitsByDir = (dir) =>
      (data.value?.priority_units || []).filter((u) => u.direction === dir)

    function comprehensiveSectionNo(offset) {
      const base = data.value?.data_coverage ? 3 : 2
      const n = base + offset
      return ['', '一', '二', '三', '四', '五', '六'][n] || String(n)
    }

    const corrTrendOption = computed(() => {
      const daily = data.value?.correlation?.arc_kpi?.daily || []
      if (!daily.length) return null
      return {
        backgroundColor: '#fff',
        animation: false,
        textStyle: { color: '#1f2d3d', fontSize: 10 },
        grid: { left: 44, right: 20, top: 20, bottom: 44 },
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: daily.map((d) => shortDateLabel(d.inspect_date)),
          axisLabel: { fontSize: 9, color: '#5c6b7f', rotate: 30 },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          name: 'ms',
          nameTextStyle: { fontSize: 9, color: '#5c6b7f' },
          axisLabel: { fontSize: 9, color: '#5c6b7f' },
          splitLine: { lineStyle: { color: '#eee' } },
        },
        series: [
          {
            name: '燃弧总时长',
            type: 'line',
            showSymbol: false,
            smooth: true,
            itemStyle: { color: '#C0392B' },
            areaStyle: { color: 'rgba(192,57,43,0.08)' },
            data: daily.map((d) => d.arc_duration_sum ?? 0),
          },
        ],
      }
    })

    const climateTrendOption = computed(() => {
      const series = data.value?.climate?.series || []
      if (!series.length) return null
      return {
        backgroundColor: '#fff',
        animation: false,
        textStyle: { color: '#1f2d3d', fontSize: 10 },
        legend: { data: ['温度℃', '相对湿度%'], top: 0, textStyle: { fontSize: 10 } },
        grid: { left: 40, right: 40, top: 28, bottom: 40 },
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: series.map((s) => shortDateLabel(s.observe_date)),
          axisLabel: { fontSize: 9, color: '#5c6b7f' },
          axisTick: { show: false },
        },
        yAxis: [
          { type: 'value', name: '℃', scale: true, axisLabel: { fontSize: 9, color: '#5c6b7f' } },
          { type: 'value', name: '%', min: 0, max: 100, axisLabel: { fontSize: 9, color: '#5c6b7f' } },
        ],
        series: [
          {
            name: '温度℃',
            type: 'line',
            showSymbol: true,
            symbolSize: 5,
            itemStyle: { color: '#e85d6a' },
            data: series.map((s) => s.temp_c),
          },
          {
            name: '相对湿度%',
            type: 'line',
            yAxisIndex: 1,
            showSymbol: true,
            symbolSize: 5,
            itemStyle: { color: '#3488d9' },
            data: series.map((s) => s.rh_pct),
          },
        ],
      }
    })

    const clearCharts = () => {
      arcUpOption.value = null
      arcDownOption.value = null
      speedBlocks.value = []
      chartsLoading.value = false
    }

    const loadSpeedDirection = async (direction, dates, seq) => {
      const meta = await fetchSpeedArcMeta({
        line_id: props.lineId,
        direction,
        dates,
      })
      if (seq !== chartsSeq) return []
      const list = meta.segment_list || []
      const blocks = []
      for (let i = 0; i < list.length; i++) {
        if (seq !== chartsSeq) return blocks
        try {
          const segRes = await fetchSpeedArcSegment(
            { line_id: props.lineId, direction, dates },
            i,
          )
          if (seq !== chartsSeq) return blocks
          const opt = buildSpeedCompareOption(segRes.segment)
          if (!opt) continue
          const name =
            segRes.segment?.display_name ||
            list[i]?.display_name ||
            list[i]?.name ||
            `区间 ${i + 1}`
          blocks.push({
            key: `${direction}-${i}`,
            direction,
            name,
            option: opt,
          })
          // 逐段推入，便于页面边加载边显示
          speedBlocks.value = [...speedBlocks.value, blocks[blocks.length - 1]]
        } catch (e) {
          console.warn(`速度-燃弧区间加载失败 [${direction} #${i}]:`, e)
        }
      }
      return blocks
    }

    const loadCharts = async (dates, threshold) => {
      const seq = ++chartsSeq
      clearCharts()
      if (!props.lineId || !dates?.length) return
      chartsLoading.value = true
      try {
        const [up, down] = await Promise.all([
          postArcAnalysis({
            line_id: props.lineId,
            direction: '上行',
            dates,
            threshold_a2s: threshold,
          }),
          postArcAnalysis({
            line_id: props.lineId,
            direction: '下行',
            dates,
            threshold_a2s: threshold,
          }),
        ])
        if (seq !== chartsSeq) return
        arcUpOption.value = buildArcCompareOption(up, threshold)
        arcDownOption.value = buildArcCompareOption(down, threshold)

        // 先上后下，逐区间
        await loadSpeedDirection('上行', dates, seq)
        if (seq !== chartsSeq) return
        await loadSpeedDirection('下行', dates, seq)
      } catch (e) {
        console.error('加载报告附图失败:', e)
      } finally {
        if (seq === chartsSeq) chartsLoading.value = false
      }
    }

    const load = async () => {
      if (!props.lineId) return
      loading.value = true
      chartsSeq += 1
      clearCharts()
      try {
        minThickness.value = clampMinThickness(minThickness.value)
        data.value = await postInspectionReport({
          line_id: props.lineId,
          direction: props.direction || '上行',
          date: props.selectedDates?.[0] || '',
          dates: props.selectedDates || [],
          report_type: reportType.value,
          threshold_a2s: reportType.value === 'arc_anchor' ? thresholdA2s.value : undefined,
          min_thickness_mm: (reportType.value === 'strip_wear' || reportType.value === 'comprehensive')
            ? minThickness.value
            : undefined,
        })
        loading.value = false
        if (data.value?.report_type === 'arc_anchor' && !data.value.empty) {
          // 正文先出，附图后台按区间加载
          loadCharts(data.value.dates || [], data.value.threshold_a2s ?? thresholdA2s.value)
        }
      } catch (e) {
        console.error(e)
        data.value = null
        loading.value = false
      }
    }

    function onMinThicknessChange(val) {
      minThickness.value = clampMinThickness(val)
      saveStripPrefs({ minThickness: minThickness.value })
      load()
    }

    const onPrint = async () => {
      if (chartsLoading.value) {
        window.alert('区间附图仍在加载，请稍候再打印。')
        return
      }
      const paper = document.getElementById('a4-report-paper')
      if (!paper) return
      try {
        await printReportElement(paper)
      } catch (e) {
        console.error('打印失败:', e)
        window.alert('打印失败，请稍后重试。')
      }
    }

    watch(
      () => [props.lineId, props.direction, props.selectedDates],
      load,
      { immediate: true, deep: true },
    )

    // keep-alive 回来时强制重拉，避免仍显示改前简报
    onActivated(() => {
      if (props.lineId) load()
    })

    return {
      loading, data, reportType, reportTypes, thresholdA2s, minThickness, currentHint,
      reportLineTitle, coverageStripName, coverageClimateName,
      formatDate, dateText, fmtSci, fmtIntensity, formatDelta, gradeClass, sectionLabel, arcUnitsByDir,
      onPrint, load, onMinThicknessChange,
      arcUpOption, arcDownOption, speedBlocks, chartsLoading,
      corrTrendOption, climateTrendOption, comprehensiveSectionNo,
    }
  },
}
</script>

<style scoped>
.rpt-page { display: flex; flex-direction: column; gap: 12px; }
.page-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.page-title {
  margin: 0; font-size: 18px; font-weight: 600; color: var(--om-text);
  display: flex; align-items: center; gap: 8px;
}
.page-title .dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--om-accent); box-shadow: 0 0 8px var(--om-accent);
}
.page-sub { font-size: 13px; color: var(--om-text-dim); }
.line-badge {
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(52, 136, 217, 0.1);
  color: var(--om-accent);
  font-weight: 500;
}
.page-hint { margin: 0 0 12px; font-size: 13px; color: var(--om-text-dim); }

.report-paper {
  background: #fff;
  color: #1f2d3d;
  border-radius: 8px;
  padding: 36px 40px 32px;
  box-shadow: 0 4px 22px rgba(15, 40, 80, 0.07);
  font-size: 13.5px;
  line-height: 1.65;
  width: 210mm;
  max-width: 100%;
  min-height: 0;
  margin: 0 auto;
  box-sizing: border-box;
  border: 1px solid #e8eef6;
}
.rpt-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  border-bottom: 2px solid #2f6fad; padding-bottom: 16px; margin-bottom: 22px;
  gap: 16px;
}
.rpt-brand-mark {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #2f6fad;
  font-weight: 600;
  margin-bottom: 6px;
}
.rpt-title { font-size: 20px; font-weight: 700; color: #152238; letter-spacing: 0.01em; }
.rpt-sub { font-size: 13px; color: #5c6b7f; margin-top: 8px; }
.rpt-meta { font-size: 11.5px; color: #7a8ba3; text-align: right; line-height: 1.65; flex-shrink: 0; }
.rpt-meta div { margin-bottom: 3px; }

.rpt-section { margin-bottom: 26px; }
.rpt-section-break { break-before: page; page-break-before: always; }
.rpt-section h3 {
  font-size: 14.5px; font-weight: 650; color: #1f4e79;
  margin: 0 0 12px; padding: 0 0 0 10px;
  border-left: 3px solid #2f6fad;
}
.rpt-summary-box {
  background: linear-gradient(180deg, #f5f9fd 0%, #fbfcfe 100%);
  border: 1px solid #d9e6f4;
  border-radius: 6px;
  padding: 12px 16px 8px;
}
.rpt-conclusions { margin: 0; padding-left: 18px; }
.rpt-conclusions li { margin-bottom: 8px; color: #1f2d3d; line-height: 1.6; }

.rpt-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.rpt-table th, .rpt-table td {
  border: 1px solid #e2e8f0; padding: 9px 10px; text-align: left; vertical-align: top;
}
.rpt-table th { background: #eef4fa; color: #334155; font-weight: 600; }
.rpt-table tbody tr:nth-child(even) td { background: #fafcfe; }
.rpt-table td.danger, .rpt-table .danger { color: #c0392b; font-weight: 600; }
.rpt-rec { color: #1e3a5f; font-weight: 500; line-height: 1.4; max-width: 220px; }
.rpt-ev { color: #64748b; font-size: 11.5px; line-height: 1.4; max-width: 180px; }
.tag-both {
  margin-left: 6px; font-size: 10px; color: #b45309;
  background: #fff7ed; border: 1px solid #fdba74; border-radius: 3px; padding: 0 4px;
}

.rpt-caption {
  margin: 0 0 12px;
  font-size: 12px;
  color: #5c6b7f;
  line-height: 1.55;
}
.rpt-h4 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #1f2d3d;
}
.rpt-chart-grid {
  display: grid;
  gap: 20px 16px;
  margin-bottom: 12px;
}
.rpt-chart-grid-2,
.rpt-chart-grid-speed {
  grid-template-columns: 1fr;
}
.rpt-chart-block {
  margin-bottom: 8px;
  min-width: 0;
  break-inside: avoid;
  page-break-inside: avoid;
}
.rpt-chart-wrap {
  width: 100%;
  height: 300px;
  border: 1px solid #e5eaf2;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
  box-sizing: border-box;
  position: relative;
}
.rpt-chart-speed { height: 280px; }
.rpt-chart { width: 100%; height: 100%; }


.g-excellent { color: #2c9e5b !important; }
.g-good { color: #3488d9 !important; }
.g-mid { color: #d98a18 !important; }
.g-bad { color: #d33 !important; }

.rpt-empty { color: #5c6b7f; font-size: 13px; padding: 8px 0; }
.rpt-footer {
  margin-top: 28px; padding-top: 16px;
  border-top: 1px dashed #d0d7e5;
  font-size: 11px; color: #8aa0c8; text-align: center; line-height: 1.6;
}
.rpt-footer p { margin: 4px 0; }
.empty-card p { color: var(--om-text-muted); text-align: center; padding: 40px 0; }
</style>
