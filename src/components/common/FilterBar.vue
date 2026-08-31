<template>
  <div class="filter-bar om-panel" :class="{ 'filter-bar-range': dateFilterMode === 'range' }">
    <!-- range 模式：主操作一行，检测日细节默认收起 -->
    <template v-if="dateFilterMode === 'range'">
      <div class="filter-section filter-section-primary">
    <div class="filter-item">
      <label>线路</label>
      <el-select
        v-model="local.lineId"
        filterable
        class="om-select-line"
        placeholder="请选择线路"
        @change="onLineChange"
      >
        <el-option
          v-for="line in lines"
          :key="line.code"
          :label="lineLabel(line)"
          :value="line.code"
        />
            <el-option
              v-if="orphanLineOption"
              :key="orphanLineOption.value"
              :label="orphanLineOption.label"
              :value="orphanLineOption.value"
            />
      </el-select>
    </div>

    <div class="filter-item" v-if="!hideDirection">
      <label>行别</label>
      <el-radio-group v-model="local.direction" @change="onDirectionChange">
        <el-radio-button label="上行">上行</el-radio-button>
        <el-radio-button label="下行">下行</el-radio-button>
      </el-radio-group>
    </div>

      <div class="filter-item filter-range">
        <label>时间范围</label>
        <el-date-picker
          v-model="local.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          class="om-date-range"
          :disabled-date="disabledDate"
            :cell-class-name="inspectCellClass"
          @change="onRangeChange"
        />
      </div>

        <span class="range-hint range-hint-inline" v-if="rangePoolDates.length">
          <template v-if="local.dates.length < rangePoolDates.length">
            {{ rangePoolDates.length }} 个检测日，分析 {{ local.dates.length }} 期
          </template>
          <template v-else>
            分析 {{ local.dates.length }} 期
          </template>
        </span>

        <div class="filter-actions filter-actions-inline">
        <el-button text @click="setRangeMonths(1)">近1月</el-button>
        <el-button text @click="setRangeMonths(3)">近3月</el-button>
        <el-button text @click="setRangeMonths(6)">近半年</el-button>
        <el-button text @click="setRangeAll">全部</el-button>
          <el-button v-if="defaultSelectCount >= 12" text @click="selectRecentInRange(12)">最近12期</el-button>
          <el-button text @click="selectRecentInRange(2)">最近2期</el-button>
        <el-button type="primary" @click="onQuery">查询</el-button>
        </div>
      </div>

      <div v-if="showInspectTimeline || (enableBatchPicker && (local.dates || []).length)" class="filter-section filter-section-extra">
        <button type="button" class="extra-toggle" @click="toggleExtraOpen">
          <span class="toggle-chevron" :class="{ open: extraOpen }" aria-hidden="true">▸</span>
          检测日与同日多组
          <span class="extra-meta">{{ extraSummary }}</span>
        </button>
        <div v-show="extraOpen" class="extra-body">
          <div v-if="showInspectTimeline" class="filter-section-dates">
            <div class="inspect-timeline-wrap">
              <span class="inspect-timeline-label">{{ timelineLabel }}</span>
              <div v-if="timelineDates.length" class="inspect-timeline">
                <span
                  v-for="d in timelineDates"
                  :key="d"
                  class="inspect-chip-wrap"
                  :class="{ active: true, multi: isMultiBatchDate(d) }"
                >
                  <button
                    type="button"
                    class="inspect-chip"
                    :class="{ 'has-remove': showChipRemove(d) }"
                    :title="inspectChipTitle(d)"
                    @click="onInspectChipClick(d)"
                  >
                    {{ formatDate(d) }}<small v-if="groupCountLabel(d)">{{ groupCountLabel(d) }}</small>
                  </button>
                  <button
                    v-if="showChipRemove(d)"
                    type="button"
                    class="inspect-chip-remove"
                    aria-label="取消选择该检测日"
                    title="取消选择"
                    @click.stop="removeInspectDate(d)"
                  >
                    ×
                  </button>
                </span>
              </div>
              <span v-else class="inspect-timeline-empty">{{ timelineEmptyHint }}</span>
            </div>
          </div>

          <div
            v-if="enableBatchPicker && (local.dates || []).length"
            class="filter-batch-row"
          >
            <span class="inspect-timeline-label">同日检测组</span>
            <el-button type="primary" plain size="small" @click.stop="openBatchDialog">
              {{ batchButtonLabel }}
            </el-button>
            <span v-if="multiBatchHint" class="range-hint">{{ multiBatchHint }}</span>
            <p v-if="mergeNote" class="filter-merge-note">{{ mergeNote }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- periods 模式：原布局 -->
    <template v-else>
    <div class="filter-item">
      <label>线路</label>
      <el-select
        v-model="local.lineId"
        filterable
        class="om-select-line"
        placeholder="请选择线路"
        @change="onLineChange"
      >
        <el-option
          v-for="line in lines"
          :key="line.code"
          :label="lineLabel(line)"
          :value="line.code"
        />
        <!-- 当前值暂不在列表中时补一条可读 option，避免关闭态露出内部编码 -->
        <el-option
          v-if="orphanLineOption"
          :key="orphanLineOption.value"
          :label="orphanLineOption.label"
          :value="orphanLineOption.value"
        />
      </el-select>
    </div>

    <div class="filter-item" v-if="!hideDirection">
      <label>行别</label>
      <el-radio-group v-model="local.direction" @change="onDirectionChange">
        <el-radio-button label="上行">上行</el-radio-button>
        <el-radio-button label="下行">下行</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 数据分析 / 决策：按检测日多选（同日多组由后端自动合并） -->
      <div class="filter-item filter-dates">
        <label>检测日期</label>
        <el-select
          v-model="local.dates"
          multiple
          collapse-tags
          collapse-tags-tooltip
          :multiple-limit="selectMultipleLimit"
          style="min-width: 280px"
          :placeholder="selectDatesPlaceholder"
          @change="onDatesSelect"
        >
          <el-option
            v-for="d in dates"
            :key="d"
            :label="dateOptionLabel(d)"
            :value="d"
          />
        </el-select>
      </div>
      <div
        v-if="enableBatchPicker && (local.dates || []).length"
        class="filter-item filter-batch"
      >
        <label>检测组</label>
        <el-button type="primary" plain size="small" @click.stop="openBatchDialog">
          {{ batchButtonLabel }}
        </el-button>
        <span v-if="multiBatchHint" class="range-hint">{{ multiBatchHint }}</span>
      </div>
      <p v-if="mergeNote && enableBatchPicker" class="filter-merge-note">{{ mergeNote }}</p>
      <div class="filter-actions">
        <template v-if="simpleDates">
          <el-button text @click="selectRecent(2)">最新两期</el-button>
        </template>
        <template v-else>
          <el-button v-if="maxSelectDates >= 12" text @click="selectRecent(12)">最近12期</el-button>
          <el-button text @click="selectRecent(2)">最近2期</el-button>
          <el-button text @click="selectRecent(4)">最近4期</el-button>
          <el-button text @click="selectRecent(8)">最近8期</el-button>
        </template>
        <el-button type="primary" @click="onQuery">查询</el-button>
      </div>
    </template>

    <el-dialog
      v-model="local.batchDialogVisible"
      title="检测组"
      width="520px"
      append-to-body
      align-center
      class="batch-dialog"
      @closed="onBatchDialogClosed"
    >
      <div v-loading="local.batchDialogLoading" class="batch-dialog-body">
      <p class="batch-dialog-tip">
        <template v-if="enableMultiBatchCompare">
          默认各检测日使用<strong>燃弧总时长最大</strong>的检测组做跨日对比。若某日有多组检测，可勾选多个组做<strong>同日对比</strong>（趋势图会拆成多个期次）。
        </template>
        <template v-else>
          默认使用各检测日<strong>燃弧总时长最大</strong>的检测组。仅当某日有多组检测数据时，才需要在此调整。
        </template>
      </p>

      <template v-if="!local.batchDialogLoading">
      <el-empty
        v-if="!dialogPickerDates.length"
        :description="enableMultiBatchCompare ? '请先在顶部选择检测日范围' : '当前所选日期均为单组检测，无需选择'"
        :image-size="64"
      />
      <template v-else>
        <div class="batch-dialog-nav">
          <el-button
            text
            :disabled="dialogDateIndex <= 0"
            @click="dialogDateIndex -= 1"
          >
            上一日
          </el-button>
          <span class="batch-dialog-nav-label">
            {{ dateOptionLabel(dialogCurrentDate) }}
            <span class="batch-dialog-nav-sub">
              （{{ dialogDateIndex + 1 }} / {{ dialogPickerDates.length }}）
            </span>
          </span>
          <el-button
            text
            :disabled="dialogDateIndex >= dialogPickerDates.length - 1"
            @click="dialogDateIndex += 1"
          >
            下一日
          </el-button>
        </div>
        <div v-if="dialogCurrentDate" class="batch-dialog-pick">
          <label>{{ enableMultiBatchCompare ? '对比检测组（可多选）' : '选用检测组' }}</label>
          <el-checkbox-group
            v-if="enableMultiBatchCompare"
            v-model="currentBatchPickMulti"
            class="batch-checkbox-group"
          >
            <el-checkbox
              v-for="b in currentBatchOptions"
              :key="b.batch_id"
              :label="b.batch_id"
            >
              {{ b.label }}
            </el-checkbox>
          </el-checkbox-group>
          <el-select
            v-else
            v-model="currentBatchPick"
            placeholder="选择检测组"
            style="width: 100%"
            :loading="local.batchDialogLoading"
          >
            <el-option
              v-for="b in currentBatchOptions"
              :key="b.batch_id"
              :label="b.label"
              :value="b.batch_id"
            />
          </el-select>
          <p v-if="!currentBatchOptions.length && !local.batchDialogLoading" class="batch-dialog-empty">
            未能加载该日的检测组列表，请切换线路后重试或联系管理员
          </p>
        </div>
        <div v-if="batchDialogSummaryText" class="batch-dialog-summary">
          {{ batchDialogSummaryText }}
        </div>
      </template>
      </template>
      </div>

      <template #footer>
        <el-button text :disabled="!canRestoreBatchDefault" @click="resetBatchDraft">
          恢复默认
        </el-button>
        <el-button @click="local.batchDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="local.batchDialogLoading" @click="confirmBatchDialog">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { reactive, watch, computed, ref, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  parseInspectDate,
  formatInspectDate,
  filterDatesByRange,
  datesInPickerRange,
  defaultRangeForDates,
  recentInspectWindow,
  toPickerDate,
} from '../../utils/dateRange'
import { formatLineName } from '../../utils/lineDisplay'
import { fetchDayBatches } from '../../api/client'

export default {
  name: 'FilterBar',
  props: {
    lines: { type: Array, default: () => [] },
    dates: { type: Array, default: () => [] },
    dateMeta: { type: Object, default: () => ({}) },
    mergeNote: { type: String, default: '' },
    lineId: { type: String, default: '' },
    direction: { type: String, default: '上行' },
    selectedDates: { type: Array, default: () => [] },
    /** periods=按日多选；range=日历范围 */
    dateFilterMode: { type: String, default: 'periods' },
    /** 汇报中心：隐藏行别（报告自含上下行） */
    hideDirection: { type: Boolean, default: false },
    /** 汇报中心：日期简化为最新两期 */
    simpleDates: { type: Boolean, default: false },
    /** range 快捷按钮「近 N 月」仍用此跨度；进入页面的默认期数看 defaultSelectCount */
    defaultRangeMonths: { type: Number, default: 1 },
    /** 进入页面默认参与分析的检测日数；0=按页类型推断（分析页 2 期） */
    defaultSelectCount: { type: Number, default: 0 },
    /** periods 模式最多可选检测日数；range 模式下 >0 时快捷按钮也受此上限约束 */
    maxSelectDates: { type: Number, default: 0 },
    /** 检测分析页：允许指定检测组 */
    enableBatchPicker: { type: Boolean, default: false },
    /** 线路概况：允许同日多组对比 */
    enableMultiBatchCompare: { type: Boolean, default: false },
    manualBatch: { type: Boolean, default: false },
    batchByDate: { type: Object, default: () => ({}) },
    batchesByDate: { type: Object, default: () => ({}) },
    /** App 正在拉取该线路日期池时为 true；切线后需等其变为 false 再算默认范围 */
    datesLoading: { type: Boolean, default: false },
  },
  emits: [
    'update:lineId',
    'update:direction',
    'update:selectedDates',
    'update:manualBatch',
    'update:batchByDate',
    'update:batchesByDate',
    'change',
    'query',
  ],
  setup(props, { emit }) {
    const local = reactive({
      lineId: props.lineId,
      direction: props.direction,
      dates: [...props.selectedDates],
      dateRange: null,
      manualBatch: props.manualBatch,
      batchByDate: { ...(props.batchByDate || {}) },
      batchesByDate: { ...(props.batchesByDate || {}) },
      batchDialogVisible: false,
      batchDialogLoading: false,
    })
    const batchOptionsByDate = ref({})
    const anchorByDate = ref({})
    const dialogDateIndex = ref(0)
    /** 切线/行别后等待新日期池再同步一次 range */
    const pendingPoolSync = ref(false)
    const extraOpen = ref(false)
    const skipRangeChange = ref(false)

    function markSkipRangeChange() {
      skipRangeChange.value = true
      nextTick(() => {
        skipRangeChange.value = false
      })
    }
    const batchDraft = reactive({
      manual: false,
      byDate: {},
      byDateMulti: {},
    })

    const normalizeDateTag = (d) => String(d || '').replace(/-/g, '').slice(0, 8)

    const inspectDateSet = computed(() => new Set((props.dates || []).map(normalizeDateTag)))

    const selectMultipleLimit = computed(() => {
      if (props.maxSelectDates > 0) return props.maxSelectDates
      if (props.simpleDates) return 2
      return 0
    })

    const rangePoolDates = computed(() => {
      if (props.dateFilterMode !== 'range') return []
      if (!local.dateRange || local.dateRange.length !== 2) return []
      const start = parseInspectDate(local.dateRange[0])
      const end = parseInspectDate(local.dateRange[1])
      if (!start || !end) return []
      return filterDatesByRange(props.dates, start, end)
    })

    const timelineLabel = computed(() => '参与分析的检测日')

    const timelineEmptyHint = computed(() => {
      if (!rangePoolDates.value.length) {
        return '先选时间范围；日历中带圆点为有数据日'
      }
      return '范围内暂无参与分析的检测日，可点「近1月」等快捷按钮或调整时间范围'
    })

    const selectDatesPlaceholder = computed(() => {
      if (props.simpleDates) return '默认最新两期'
      if (props.maxSelectDates > 0) return `选择检测日期（最多 ${props.maxSelectDates} 期）`
      return '选择检测日期（仅有数据的日期可选）'
    })

    const showInspectTimeline = computed(
      () => props.dateFilterMode === 'range' && (props.dates || []).length > 0,
    )

    /** 时间轴只展示参与分析的检测日（× 移除后不再显示） */
    const timelineDates = computed(() => {
      if (!showInspectTimeline.value) return []
      const pool = rangePoolDates.value
      const selected = (local.dates || []).filter((d) => pool.includes(d))
      const order = new Map(pool.map((d, i) => [d, i]))
      return [...selected].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    })

    function groupCountLabel(d) {
      const tag = normalizeDateTag(d)
      const meta = props.dateMeta?.[tag] || props.dateMeta?.[d]
      const gc = meta?.group_count
      if (gc && Number(gc) > 1) return `${gc}组`
      return ''
    }

    function isMultiBatchDate(d) {
      const tag = normalizeDateTag(d)
      const meta = props.dateMeta?.[tag] || props.dateMeta?.[d]
      return meta && Number(meta.group_count) > 1
    }

    function inspectChipTitle(d) {
      const tag = normalizeDateTag(d)
      const meta = props.dateMeta?.[tag] || props.dateMeta?.[d]
      const parts = []
      if ((local.dates || []).length > 1) {
        parts.push('点击右上角 × 从本次分析中移除')
      }
      if (props.enableBatchPicker && isMultiBatchDate(d)) {
        parts.push('点击选择检测组')
      }
      if (meta?.group_count > 1) parts.push(`${meta.group_count} 组检测`)
      if (meta?.raw_samples) parts.push(`约 ${meta.raw_samples} 条采样`)
      return parts.length ? parts.join(' · ') : formatDate(d)
    }

    function showChipRemove(d) {
      return (local.dates || []).length > 1
    }

    function removeInspectDate(d) {
      const cur = (local.dates || []).filter((x) => x !== d)
      if (!cur.length) return
      local.dates = cur
      emitChange()
    }

    function onInspectChipClick(d) {
      if (props.enableBatchPicker && isMultiBatchDate(d)) {
        openBatchDialog(d)
      }
    }

    const extraSummary = computed(() => {
      const n = (local.dates || []).length
      const pool = rangePoolDates.value.length
      const multi = (local.dates || []).filter((d) => isMultiBatchDate(d)).length
      const parts = []
      if (n) parts.push(`${n} 期`)
      if (pool && n < pool) parts.push(`范围内 ${pool} 个检测日`)
      if (multi) parts.push(`${multi} 日有多组`)
      return parts.join(' · ') || '展开后可微调检测日'
    })

    function toggleExtraOpen() {
      extraOpen.value = !extraOpen.value
    }

    function selectRecentInRange(n) {
      const pool = rangePoolDates.value
      if (!pool.length) return
      const cap = selectMultipleLimit.value || pool.length
      local.dates = pool.slice(0, Math.min(n, pool.length, cap))
      emitChange()
    }

    /** 默认取最近 N 期：研判 12、明细 2，受 maxSelectDates 上限约束 */
    function defaultSelectN(poolLen) {
      const configured = Number(props.defaultSelectCount) || 0
      let n = configured > 0
        ? configured
        : (props.simpleDates || props.dateFilterMode === 'range' ? 2 : 1)
      const cap = selectMultipleLimit.value > 0 ? selectMultipleLimit.value : poolLen
      return Math.max(1, Math.min(n, cap, poolLen))
    }

    function defaultDatesForPool(pool) {
      if (!pool.length) return []
      return pool.slice(0, defaultSelectN(pool.length))
    }

    /** 进入页面：取最近 N 期，日历范围刚好覆盖这些检测日 */
    function applyDefaultRecentPeriods() {
      const pool = props.dates || []
      if (!pool.length) {
        local.dates = []
        local.dateRange = null
        return
      }
      const win = recentInspectWindow(pool, defaultSelectN(pool.length))
      local.dates = win.dates
      if (win.start && win.end) {
        markSkipRangeChange()
        local.dateRange = [toPickerDate(win.start), toPickerDate(win.end)]
      }
    }

    function selectAllInRange() {
      const pool = rangePoolDates.value
      if (!pool.length) return
      local.dates = datesForPool(pool, { selectAll: true })
      emitChange()
    }

    function inspectCellClass(date) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const tag = `${y}${m}${day}`
      if (inspectDateSet.value.has(tag)) return 'om-has-inspect-data'
      return ''
    }

    const multiBatchDatesFromMeta = computed(() => {
      if (!props.enableBatchPicker) return []
      return (local.dates || []).filter((d) => {
        const meta = props.dateMeta?.[normalizeDateTag(d)] || props.dateMeta?.[d]
        return meta && Number(meta.group_count) > 1
      })
    })

    const dialogPickerDates = computed(() => {
      if (!props.enableBatchPicker) return []
      if (props.enableMultiBatchCompare) return [...(local.dates || [])]
      return (local.dates || []).filter((d) => {
        const tag = normalizeDateTag(d)
        const batches = batchOptionsByDate.value[tag] || batchOptionsByDate.value[d]
        if (batches?.length > 1) return true
        const meta = props.dateMeta?.[tag] || props.dateMeta?.[d]
        return meta && Number(meta.group_count) > 1
      })
    })

    const dialogMultiBatchDates = dialogPickerDates

    const dialogCurrentDate = computed(() => {
      const list = dialogPickerDates.value
      if (!list.length) return ''
      const idx = Math.min(Math.max(dialogDateIndex.value, 0), list.length - 1)
      return list[idx]
    })

    const dialogCurrentTag = computed(() => normalizeDateTag(dialogCurrentDate.value))

    const currentBatchPick = computed({
      get() {
        const tag = dialogCurrentTag.value
        if (!tag) return undefined
        return batchDraft.byDate[tag]
      },
      set(v) {
        const tag = dialogCurrentTag.value
        if (tag) batchDraft.byDate[tag] = v
      },
    })

    const currentBatchPickMulti = computed({
      get() {
        const tag = dialogCurrentTag.value
        if (!tag) return []
        return batchDraft.byDateMulti[tag] || []
      },
      set(v) {
        const tag = dialogCurrentTag.value
        if (!tag) return
        const ids = (v || []).map((x) => Number(x)).filter(Boolean)
        batchDraft.byDateMulti[tag] = ids
      },
    })

    const currentBatchOptions = computed(() => {
      const tag = dialogCurrentTag.value
      if (!tag) return []
      const loaded = batchOptionsByDate.value[tag] || batchOptionsByDate.value[dialogCurrentDate.value]
      if (loaded?.length) return loaded
      const meta = props.dateMeta?.[tag] || props.dateMeta?.[dialogCurrentDate.value]
      return meta?.batches || []
    })

    const multiBatchHint = computed(() => {
      const multiDays = Object.keys(local.batchesByDate || {}).filter(
        (k) => (local.batchesByDate[k] || []).length > 1,
      ).length
      if (multiDays) return `${multiDays} 个检测日启用同日多组对比`
      const n = multiBatchDatesFromMeta.value.length
      if (!n) return ''
      return `${n} 个检测日有多组可选`
    })

    const batchButtonLabel = computed(() => {
      const multiDays = Object.keys(local.batchesByDate || {}).filter(
        (k) => (local.batchesByDate[k] || []).length > 1,
      ).length
      if (multiDays) return `同日多组 · ${multiDays} 日`
      if (local.manualBatch) return '已自定义'
      return '默认（燃弧最大组）'
    })

    const batchDialogSummaryText = computed(() => {
      if (props.enableMultiBatchCompare) {
        const multiDays = dialogPickerDates.value.filter((d) => {
          const tag = normalizeDateTag(d)
          return (batchDraft.byDateMulti[tag] || []).length > 1
        }).length
        const singleCustom = dialogPickerDates.value.filter((d) => {
          const tag = normalizeDateTag(d)
          const anchor = resolveAnchor(tag)
          const picked = batchDraft.byDateMulti[tag] || []
          return picked.length === 1 && anchor != null && Number(picked[0]) !== Number(anchor)
        }).length
        if (!multiDays && !singleCustom) return ''
        const parts = []
        if (multiDays) parts.push(`${multiDays} 日多组对比`)
        if (singleCustom) parts.push(`${singleCustom} 日单组自定义`)
        return `已设置：${parts.join(' · ')}`
      }
      if (!batchDraft.manual) return ''
      let n = 0
      for (const d of dialogPickerDates.value) {
        const tag = normalizeDateTag(d)
        const anchor = resolveAnchor(tag)
        const picked = batchDraft.byDate[tag]
        if (anchor != null && picked != null && Number(picked) !== Number(anchor)) n += 1
      }
      return n ? `已自定义 ${n} 个检测日（相对默认燃弧最大组）` : ''
    })

    function applyBatchPayload(tag, payload) {
      if (!tag || !payload) return
      const batches = payload.batches || []
      if (batches.length) {
        batchOptionsByDate.value = {
          ...batchOptionsByDate.value,
          [tag]: batches,
        }
      }
      if (payload.anchor_batch_id != null) {
        anchorByDate.value = {
          ...anchorByDate.value,
          [tag]: payload.anchor_batch_id,
        }
      }
    }

    function hydrateBatchesFromDateMeta(dates) {
      for (const d of dates || []) {
        const tag = normalizeDateTag(d)
        const meta = props.dateMeta?.[tag] || props.dateMeta?.[d]
        if (!meta?.batches?.length) continue
        applyBatchPayload(tag, meta)
      }
    }

    async function loadBatchOptionsForDates(dates) {
      const lineId = local.lineId || props.lineId
      const direction = local.direction || props.direction
      if (!lineId || !direction || !dates?.length) return

      hydrateBatchesFromDateMeta(dates)

      // 单组检测日 dateMeta 已足够，不再逐日打 /day-batches
      const targets = (dates || []).filter((d) => {
        const tag = normalizeDateTag(d)
        const meta = props.dateMeta?.[tag] || props.dateMeta?.[d]
        return Number(meta?.group_count) > 1
          || (!meta && (batchOptionsByDate.value[tag]?.length > 1))
      })

      // 已有完整 batches 则跳过；全是 0 说明 /dates 只有空的 Sheet2，仍要拉 /day-batches 做测点回退
      const needFetch = targets.filter((d) => {
        const tag = normalizeDateTag(d)
        const batches = batchOptionsByDate.value[tag]
        if (!batches?.length) return true
        if (batches.length <= 1) return false
        return batches.every((b) => Number(b.arc_total_ms || 0) <= 0)
      })
      if (!needFetch.length) return

      const results = await Promise.allSettled(
        needFetch.map((d) => {
          const tag = normalizeDateTag(d)
          return fetchDayBatches(lineId, direction, tag).then((res) => ({ tag, res }))
        }),
      )
      for (const r of results) {
        if (r.status === 'fulfilled') {
          applyBatchPayload(r.value.tag, r.value.res)
        } else {
          const msg = String(r.reason?.message || r.reason || '')
          console.error('fetchDayBatches failed', msg)
        }
      }
      const failed = needFetch.filter((d) => {
        const tag = normalizeDateTag(d)
        return !(batchOptionsByDate.value[tag]?.length)
      })
      if (failed.length === 1) {
        ElMessage.warning(`检测日 ${formatInspectDate(normalizeDateTag(failed[0]))} 的检测组加载失败`)
      } else if (failed.length > 1) {
        ElMessage.warning(`${failed.length} 个检测日的检测组加载失败`)
      }
    }

    function syncBatchDraftFromLocal() {
      batchDraft.manual = !!local.manualBatch
      batchDraft.byDate = {}
      batchDraft.byDateMulti = {}
      const dates = dialogPickerDates.value.length
        ? dialogPickerDates.value
        : (local.dates || [])
      for (const d of dates) {
        const tag = normalizeDateTag(d)
        const anchor = resolveAnchor(tag)
        const multi = local.batchesByDate?.[tag] || local.batchesByDate?.[d]
        if (Array.isArray(multi) && multi.length) {
          batchDraft.byDateMulti[tag] = multi.map((x) => Number(x)).filter(Boolean)
        } else {
          const picked = local.batchByDate[tag] ?? local.batchByDate[d]
          const single = picked != null ? Number(picked) : anchor
          batchDraft.byDateMulti[tag] = single ? [single] : []
        }
        batchDraft.byDate[tag] = batchDraft.byDateMulti[tag]?.[0] ?? anchor
      }
    }

    function resolveAnchor(tag) {
      const fromMap = anchorByDate.value[tag]
      if (fromMap != null && Number.isFinite(Number(fromMap))) return Number(fromMap)
      const meta = props.dateMeta?.[tag]
      if (meta?.anchor_batch_id != null && Number.isFinite(Number(meta.anchor_batch_id))) {
        return Number(meta.anchor_batch_id)
      }
      const opts = batchOptionsByDate.value[tag] || meta?.batches || []
      const marked = opts.find((b) => b.is_anchor)
      if (marked?.batch_id != null) return Number(marked.batch_id)
      if (!opts.length) return null
      return opts.reduce((best, b) => {
        const arc = Number(b.arc_total_ms || 0)
        const bestArc = Number(best.arc_total_ms || 0)
        if (arc > bestArc) return b
        if (arc === bestArc && Number(b.batch_id) < Number(best.batch_id)) return b
        return best
      }).batch_id
    }

    function draftDiffersFromDefault() {
      const dates = dialogPickerDates.value.length
        ? dialogPickerDates.value
        : (local.dates || [])
      for (const d of dates) {
        const tag = normalizeDateTag(d)
        const anchor = resolveAnchor(tag)
        if (props.enableMultiBatchCompare) {
          const selected = (batchDraft.byDateMulti[tag] || []).map((x) => Number(x)).filter(Boolean)
          const uniq = [...new Set(selected)]
          if (uniq.length > 1) return true
          if (uniq.length === 1 && anchor != null && uniq[0] !== Number(anchor)) return true
        } else {
          const picked = batchDraft.byDate[tag]
          if (anchor != null && picked != null && Number(picked) !== Number(anchor)) return true
        }
      }
      return false
    }

    const canRestoreBatchDefault = computed(() => {
      if (local.manualBatch) return true
      if (Object.keys(local.batchesByDate || {}).some((k) => (local.batchesByDate[k] || []).length > 1)) {
        return true
      }
      if (Object.keys(local.batchByDate || {}).length) return true
      return draftDiffersFromDefault()
    })

    function inferManualFromDraft() {
      for (const d of dialogPickerDates.value) {
        const tag = normalizeDateTag(d)
        const anchor = resolveAnchor(tag)
        const picked = batchDraft.byDate[tag]
        if (anchor != null && picked != null && Number(picked) !== Number(anchor)) {
          return true
        }
      }
      return false
    }

    async function openBatchDialog(focusDate) {
      local.batchDialogVisible = true
      local.batchDialogLoading = true
      dialogDateIndex.value = 0
      await nextTick()
      try {
        const targets = multiBatchDatesFromMeta.value.length
          ? multiBatchDatesFromMeta.value
          : (local.dates || []).filter((d) => {
            const tag = normalizeDateTag(d)
            const meta = props.dateMeta?.[tag] || props.dateMeta?.[d]
            return Number(meta?.group_count) > 1
          })
        await loadBatchOptionsForDates(targets)
        syncBatchDraftFromLocal()
        if (focusDate) {
          const tag = normalizeDateTag(focusDate)
          const list = dialogPickerDates.value
          const idx = list.findIndex((d) => normalizeDateTag(d) === tag)
          if (idx >= 0) dialogDateIndex.value = idx
        }
      } catch (e) {
        console.error(e)
        ElMessage.error('加载检测组失败，请稍后重试')
      } finally {
        local.batchDialogLoading = false
      }
    }

    function onBatchDialogClosed() {
      local.batchDialogLoading = false
    }

    function resetBatchDraft() {
      batchDraft.manual = false
      batchDraft.byDate = {}
      batchDraft.byDateMulti = {}
      for (const d of dialogPickerDates.value) {
        const tag = normalizeDateTag(d)
        const anchor = resolveAnchor(tag)
        if (anchor != null) {
          batchDraft.byDate[tag] = anchor
          batchDraft.byDateMulti[tag] = [anchor]
        }
      }
      confirmBatchDialog()
    }

    function confirmBatchDialog() {
      if (props.enableMultiBatchCompare) {
        const nextMulti = {}
        const nextSingle = {}
        let hasCustom = false
        for (const d of dialogPickerDates.value) {
          const tag = normalizeDateTag(d)
          const anchor = resolveAnchor(tag)
          const selected = (batchDraft.byDateMulti[tag] || []).map((x) => Number(x)).filter(Boolean)
          const uniq = [...new Set(selected)]
          if (uniq.length > 1) {
            nextMulti[tag] = uniq
            hasCustom = true
          } else if (uniq.length === 1 && anchor != null && uniq[0] !== Number(anchor)) {
            nextSingle[tag] = uniq[0]
            hasCustom = true
          }
        }
        local.batchesByDate = nextMulti
        local.batchByDate = nextSingle
        local.manualBatch = hasCustom
      } else {
        const manual = inferManualFromDraft()
        local.manualBatch = manual
        const next = {}
        if (manual) {
          for (const d of dialogPickerDates.value) {
            const tag = normalizeDateTag(d)
            const anchor = resolveAnchor(tag)
            const picked = batchDraft.byDate[tag]
            if (picked != null && (anchor == null || Number(picked) !== Number(anchor))) {
              next[tag] = picked
            }
          }
        }
        local.batchByDate = next
        local.batchesByDate = {}
      }
      local.batchDialogVisible = false
      emitChange()
    }

    const formatDate = formatInspectDate

    const dateOptionLabel = (d) => {
      const base = formatDate(d)
      const tag = normalizeDateTag(d)
      const meta = props.dateMeta?.[tag] || props.dateMeta?.[d]
      const gc = meta?.group_count
      const samples = meta?.raw_samples
      if (gc && Number(gc) > 1) {
        return samples ? `${base}（${gc}组 · ${formatSampleCount(samples)}）` : `${base}（${gc}组）`
      }
      if (samples) return `${base}（${formatSampleCount(samples)}）`
      return base
    }

    function formatSampleCount(n) {
      const v = Number(n) || 0
      if (v >= 10000) return `${(v / 10000).toFixed(1)}万点`
      if (v >= 1000) return `${(v / 1000).toFixed(1)}k点`
      return `${v}点`
    }

    const syncRangeFromDates = ({ forceDefault = false } = {}) => {
      if (props.dateFilterMode !== 'range' || !props.dates.length) return
      const pool = props.dates || []
      const hasRange = Array.isArray(local.dateRange) && local.dateRange.length === 2
      if (!forceDefault && hasRange) {
        const inCurrentRange = datesInPickerRange(pool, local.dateRange)
        if (inCurrentRange.length) {
          // 切线路/行别后旧检测日对不上新池，按当前范围重选默认期次，不要留空
          applyRange({ resetSelection: true })
          return
        }
      }
      applyDefaultRecentPeriods()
    }

    const datesForPool = (pool, { selectAll = false } = {}) => {
      if (!pool.length) return []
      if (selectAll) {
        const cap = selectMultipleLimit.value > 0 ? selectMultipleLimit.value : pool.length
        return pool.slice(0, Math.min(cap, pool.length))
      }
      return defaultDatesForPool(pool)
    }

    const applyRange = ({ resetSelection = false, selectAll = false, allowEmpty = false } = {}) => {
      if (!local.dateRange || local.dateRange.length !== 2) {
        local.dates = []
        return
      }
      const start = parseInspectDate(local.dateRange[0])
      const end = parseInspectDate(local.dateRange[1])
      const pool = filterDatesByRange(props.dates, start, end)
      if (!pool.length) {
        local.dates = []
        return
      }
      if (resetSelection) {
        local.dates = datesForPool(pool, { selectAll })
        return
      }
      const kept = (local.dates || []).filter((d) => pool.includes(d))
      if (kept.length) {
        local.dates = kept
        return
      }
      if (allowEmpty) {
        local.dates = []
        return
      }
      local.dates = datesForPool(pool, { selectAll })
    }

    const disabledDate = (date) => {
      if (!props.dates.length) return true
      const oldest = parseInspectDate(props.dates[props.dates.length - 1])
      const newest = parseInspectDate(props.dates[0])
      if (!oldest || !newest) return false
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      return d < oldest || d > newest
    }

    /** 近1月 / 近3月 / 近半年 / 全部：分析该时间尺度内全部检测日 */
    const setRangeMonths = (months) => {
      const def = defaultRangeForDates(props.dates, months)
      if (!def) return
      markSkipRangeChange()
      local.dateRange = [toPickerDate(def[0]), toPickerDate(def[1])]
      applyRange({ resetSelection: true, selectAll: true })
      notifyRangeCap()
      emitChange()
    }

    const setRangeAll = () => {
      if (!props.dates.length) return
      const oldest = parseInspectDate(props.dates[props.dates.length - 1])
      const newest = parseInspectDate(props.dates[0])
      if (!oldest || !newest) return
      markSkipRangeChange()
      local.dateRange = [toPickerDate(oldest), toPickerDate(newest)]
      applyRange({ resetSelection: true, selectAll: true })
      notifyRangeCap()
      emitChange()
    }

    function notifyRangeCap() {
      const pool = rangePoolDates.value.length
      const cap = selectMultipleLimit.value
      if (cap > 0 && pool > cap) {
        ElMessage.info(`本页最多分析 ${cap} 期，已取最近 ${local.dates.length} 期`)
      }
    }

    /** 手动改日历范围：分析该范围内全部检测日（与快捷按钮一致） */
    const onRangeChange = () => {
      if (skipRangeChange.value) return
      applyRange({ resetSelection: true, selectAll: true })
      emitChange()
    }

    const onQuery = () => {
      if (props.dateFilterMode === 'range') {
        if (!local.dateRange || local.dateRange.length !== 2) {
          ElMessage.warning('请先选择时间范围')
          return
        }
        const start = parseInspectDate(local.dateRange[0])
        const end = parseInspectDate(local.dateRange[1])
        const pool = filterDatesByRange(props.dates, start, end)
        if (!pool.length) {
          ElMessage.warning('该时间范围内没有检测日，请调整范围或点「近1月」等快捷按钮')
          emitChange()
          return
        }
      }
      emitChange()
      emit('query')
    }

    const emitChange = () => {
      emit('update:lineId', local.lineId)
      emit('update:direction', local.direction)
      emit('update:selectedDates', local.dates)
      emit('update:manualBatch', local.manualBatch)
      emit('update:batchByDate', { ...local.batchByDate })
      emit('update:batchesByDate', { ...local.batchesByDate })
      emit('change', {
        lineId: local.lineId,
        direction: local.direction,
        dates: local.dates,
        dateRange: local.dateRange,
        manualBatch: local.manualBatch,
        batchByDate: { ...local.batchByDate },
        batchesByDate: { ...local.batchesByDate },
      })
    }

    const clearSelectionForScopeChange = () => {
      local.batchByDate = {}
      local.batchesByDate = {}
      local.manualBatch = false
      batchOptionsByDate.value = {}
      anchorByDate.value = {}
      pendingPoolSync.value = true
    }

    /** 切线/行别：保持时间范围，检测组按新线路重载 */
    const onLineChange = () => {
      clearSelectionForScopeChange()
      emitChange()
    }
    const onDirectionChange = () => {
      clearSelectionForScopeChange()
      emitChange()
    }

    const trySyncAfterPoolReady = () => {
      if (!pendingPoolSync.value) return
      if (props.datesLoading) return
      const pool = props.dates || []
      pendingPoolSync.value = false
      if (!pool.length) {
        local.dates = []
        restoreBatchesFromProps()
        emitChange()
        return
      }
      if (props.dateFilterMode === 'range') {
        syncRangeFromDates({ forceDefault: false })
        if (!local.dates.length) applyDefaultRecentPeriods()
      } else {
        local.dates = (local.dates || []).filter((d) => pool.includes(d))
        if (!local.dates.length) local.dates = defaultDatesForPool(pool)
      }
      restoreBatchesFromProps()
      emitChange()
    }

    const restoreBatchesFromProps = () => {
      local.manualBatch = !!props.manualBatch
      local.batchByDate = { ...(props.batchByDate || {}) }
      local.batchesByDate = { ...(props.batchesByDate || {}) }
    }

    const onDatesSelect = () => {
      if (props.simpleDates && local.dates.length > 2) {
        const order = props.dates || []
        local.dates = order.filter((d) => local.dates.includes(d)).slice(0, 2)
      }
      const cap = selectMultipleLimit.value
      if (cap > 0 && local.dates.length > cap) {
        const order = props.dates || []
        local.dates = order.filter((d) => local.dates.includes(d)).slice(0, cap)
      }
      emitChange()
    }

    const selectRecent = (n) => {
      local.dates = props.dates.slice(0, Math.min(n, props.dates.length))
      emitChange()
    }

    const lineLabel = (line) => formatLineName(line.label || line.name || line.line_name, line.code || line.line_code)

    /** 关闭态若 value 暂无匹配 option，用可读名覆盖展示（避免露出 ZZ_LINE_x） */
    const orphanLineOption = computed(() => {
      const code = local.lineId
      if (!code) return null
      const hit = (props.lines || []).some((l) => (l.code || l.line_code) === code)
      if (hit) return null
      return { value: code, label: formatLineName('', code) }
    })

    const syncLineId = () => {
      const list = props.lines || []
      if (!list.length) {
        local.lineId = ''
        return
      }
      const ok = list.some((l) => l.code === local.lineId)
      if (!ok) {
        const next = list[0].code
        if (local.lineId !== next) {
          local.lineId = next
          clearSelectionForScopeChange()
          emitChange()
        }
      }
    }

    watch(() => props.lineId, (v) => {
      if ((v || '') === (local.lineId || '')) {
        syncLineId()
        return
      }
      local.lineId = v || ''
      syncLineId()
      // 外部改线：清空本地筛选，等日期池就绪后再同步（勿用旧 props.dates）
      clearSelectionForScopeChange()
    })
    watch(() => props.direction, (v) => {
      if (v === local.direction) return
      local.direction = v
      clearSelectionForScopeChange()
    })
    watch(
      () => props.selectedDates,
      (v) => {
        if (pendingPoolSync.value) return
        const next = [...(v || [])]
        local.dates = next
      },
    )
    watch(
      () => [props.dates, props.dateFilterMode, props.datesLoading],
      ([dates, mode], prev) => {
        if (pendingPoolSync.value) {
          trySyncAfterPoolReady()
          return
        }
        const oldMode = prev?.[1]
        const list = dates || []
        if (!list.length || props.datesLoading) return

        if (mode === 'range') {
          if (local.dateRange && local.dateRange.length === 2) {
            applyRange({ allowEmpty: true })
            const before = JSON.stringify(props.selectedDates || [])
            const after = JSON.stringify(local.dates || [])
            if (before !== after) emitChange()
            return
          }
          syncRangeFromDates()
          const before = JSON.stringify(props.selectedDates || [])
          const after = JSON.stringify(local.dates || [])
          if (before !== after) emitChange()
          return
        }

        const kept = (props.selectedDates?.length ? props.selectedDates : local.dates)
          .filter((d) => list.includes(d))
        if (kept.length) {
          local.dates = kept
          if (oldMode === 'range') emitChange()
          return
        }
        if (oldMode === 'range' || !(local.dates || []).length) {
          local.dates = list.slice(0, Math.min(props.simpleDates ? 2 : defaultSelectN(list.length), list.length))
          emitChange()
        }
      },
      { immediate: true },
    )
    watch(() => props.datesLoading, () => trySyncAfterPoolReady())

    watch(() => props.manualBatch, (v) => { local.manualBatch = !!v })
    watch(
      () => props.batchByDate,
      (v) => { local.batchByDate = { ...(v || {}) } },
      { deep: true },
    )
    watch(
      () => props.batchesByDate,
      (v) => { local.batchesByDate = { ...(v || {}) } },
      { deep: true },
    )
    watch(() => props.lines, () => syncLineId(), { deep: true })
    watch(
      () => props.dateMeta,
      () => hydrateBatchesFromDateMeta(local.dates || []),
      { deep: true },
    )

    return {
      local,
      lineLabel,
      orphanLineOption,
      formatDate,
      dateOptionLabel,
      multiBatchHint,
      batchButtonLabel,
      dialogPickerDates,
      dialogMultiBatchDates,
      dialogCurrentDate,
      dialogCurrentTag,
      currentBatchPick,
      currentBatchPickMulti,
      currentBatchOptions,
      batchDialogSummaryText,
      canRestoreBatchDefault,
      dialogDateIndex,
      batchDraft,
      enableMultiBatchCompare: computed(() => props.enableMultiBatchCompare),
      batchOptionsByDate,
      openBatchDialog,
      onBatchDialogClosed,
      resetBatchDraft,
      confirmBatchDialog,
      emitChange,
      onQuery,
      selectRecent,
      onLineChange,
      onDirectionChange,
      onDatesSelect,
      onRangeChange,
      setRangeMonths,
      setRangeAll,
      disabledDate,
      inspectCellClass,
      showInspectTimeline,
      timelineDates,
      timelineLabel,
      timelineEmptyHint,
      extraOpen,
      extraSummary,
      toggleExtraOpen,
      rangePoolDates,
      isMultiBatchDate,
      groupCountLabel,
      inspectChipTitle,
      onInspectChipClick,
      showChipRemove,
      removeInspectDate,
      selectRecentInRange,
      selectAllInRange,
      selectMultipleLimit,
      selectDatesPlaceholder,
    }
  },
}
</script>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;
  padding: 12px 18px;
}
.filter-bar-range {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 14px 18px;
}
.filter-section {
  width: 100%;
  min-width: 0;
}
.filter-section-primary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}
.filter-actions-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.filter-section-extra {
  border-top: 1px solid var(--om-border, rgba(148, 163, 184, 0.18));
  padding-top: 8px;
}
.extra-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 2px 0;
  cursor: pointer;
  font-size: 12px;
  color: var(--om-text-dim);
  text-align: left;
}
.extra-toggle:hover { color: var(--om-text); }
.extra-meta {
  color: var(--om-text-muted, var(--om-text-dim));
  font-weight: 400;
}
.extra-body { padding-top: 8px; }
.filter-section-dates .inspect-timeline-wrap {
  margin-top: 0;
}
.filter-batch-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.range-hint-inline {
  flex: 1 1 auto;
  min-width: 120px;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-item label {
  font-size: 13px;
  color: var(--om-text-muted);
  white-space: nowrap;
}
.batch-dialog-tip {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--om-text-muted);
}
.batch-dialog-body {
  min-height: 120px;
}
.batch-dialog-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.batch-dialog-nav-label {
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  flex: 1;
}
.batch-dialog-nav-sub {
  font-size: 12px;
  font-weight: normal;
  color: var(--om-text-dim);
}
.batch-dialog-pick {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.batch-dialog-pick label {
  font-size: 13px;
  color: var(--om-text-muted);
}
.batch-checkbox-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
  padding: 4px 0;
}
.batch-dialog-empty {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--om-text-dim);
}
.batch-dialog-summary {
  margin-top: 12px;
  font-size: 12px;
  color: var(--om-primary, #409eff);
}
.filter-dates,
.filter-range {
  flex: 1;
  min-width: 280px;
}
.range-hint {
  font-size: 12px;
  color: var(--om-text-dim);
  line-height: 1.45;
}
.filter-merge-note {
  margin: 0;
  font-size: 12px;
  color: var(--om-text-dim);
  line-height: 1.4;
}
.inspect-timeline-wrap {
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  margin-top: 2px;
  padding: 0;
  border: none;
  background: none;
}
.toggle-chevron {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--om-text-dim);
  transition: transform 0.15s ease;
  transform: rotate(0deg);
}
.toggle-chevron.open {
  transform: rotate(90deg);
}
.inspect-timeline-label {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--om-text-dim);
  line-height: 28px;
}
.inspect-timeline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 0;
}
.inspect-chip-wrap {
  position: relative;
  display: inline-flex;
}
.inspect-chip-wrap.active .inspect-chip {
  border-color: var(--om-accent, #3488d9);
  background: rgba(52, 136, 217, 0.12);
  font-weight: 600;
}
.inspect-chip-wrap.multi:not(.active) .inspect-chip {
  border-style: dashed;
}
.inspect-chip.has-remove {
  padding-right: 18px;
}
.inspect-chip-remove {
  position: absolute;
  top: -5px;
  right: -5px;
  z-index: 1;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--om-border, rgba(148, 163, 184, 0.45));
  border-radius: 50%;
  background: var(--om-panel-elevated, var(--om-bg-2, #fff));
  color: var(--om-text-muted, #64748b);
  font-size: 13px;
  line-height: 14px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.inspect-chip-remove:hover {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.55);
  background: rgba(239, 68, 68, 0.08);
}
.inspect-chip {
  border: 1px solid var(--om-border, rgba(148, 163, 184, 0.35));
  background: var(--om-panel-bg, rgba(255, 255, 255, 0.04));
  color: var(--om-text, inherit);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.inspect-chip small {
  margin-left: 4px;
  opacity: 0.75;
  font-size: 11px;
}
.inspect-chip-wrap .inspect-chip:hover {
  border-color: var(--om-accent, #3488d9);
}
.inspect-timeline-empty {
  font-size: 12px;
  color: var(--om-text-dim);
  line-height: 1.5;
}
:deep(td.om-has-inspect-data .el-date-table-cell__text) {
  font-weight: 600;
  color: var(--om-accent, #3488d9);
}
:deep(td.om-has-inspect-data .el-date-table-cell__text::after) {
  content: '';
  display: block;
  width: 5px;
  height: 5px;
  margin: 1px auto 0;
  border-radius: 50%;
  background: var(--om-accent, #3488d9);
}
.filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .filter-bar,
  .filter-bar-range {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 12px;
  }
  .filter-section-primary {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .filter-item {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    width: 100%;
  }
  .filter-item label {
    font-size: 12px;
  }
  .filter-dates,
  .filter-range {
    min-width: 0;
    width: 100%;
  }
  .filter-dates :deep(.el-select) {
    width: 100% !important;
    min-width: 0 !important;
  }
  .filter-actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-start;
  }
  .filter-actions .el-button[type='primary'] {
    margin-left: auto;
  }
}
</style>
