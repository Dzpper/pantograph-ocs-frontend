<template>
  <div class="filter-bar om-panel">
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

    <!-- 报警统计：按时间范围 -->
    <template v-if="dateFilterMode === 'range'">
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
          @change="onRangeChange"
        />
        <span class="range-hint" v-if="local.dates.length">
          含 {{ local.dates.length }} 个检测日
        </span>
      </div>
      <div class="filter-actions">
        <el-button text @click="setRangeMonths(1)">近1月</el-button>
        <el-button text @click="setRangeMonths(3)">近3月</el-button>
        <el-button text @click="setRangeMonths(6)">近半年</el-button>
        <el-button text @click="setRangeAll">全部</el-button>
        <el-button type="primary" @click="emitChange">查询</el-button>
      </div>
    </template>

    <!-- 数据分析 / 决策：按检测日多选（同日多组由后端自动合并） -->
    <template v-else>
      <div class="filter-item filter-dates">
        <label>检测日期</label>
        <el-select
          v-model="local.dates"
          multiple
          collapse-tags
          collapse-tags-tooltip
          :multiple-limit="simpleDates ? 2 : 0"
          style="min-width: 280px"
          :placeholder="simpleDates ? '默认最新两期' : '选择检测日期'"
          @change="onDatesSelect"
        >
          <el-option
            v-for="d in dates"
            :key="d"
            :label="dateOptionLabel(d)"
            :value="d"
          />
        </el-select>
        <span class="range-hint" v-if="mergeNote">{{ mergeNote }}</span>
      </div>
      <div class="filter-actions">
        <template v-if="simpleDates">
          <el-button text @click="selectRecent(2)">最新两期</el-button>
        </template>
        <template v-else>
          <el-button text @click="selectRecent(2)">最近2期</el-button>
          <el-button text @click="selectRecent(4)">最近4期</el-button>
          <el-button text @click="selectRecent(8)">最近8期</el-button>
        </template>
        <el-button type="primary" @click="emitChange">查询</el-button>
      </div>
    </template>
  </div>
</template>

<script>
import { reactive, watch, computed } from 'vue'
import {
  parseInspectDate,
  formatInspectDate,
  filterDatesByRange,
  defaultRangeForDates,
  toPickerDate,
} from '../../utils/dateRange'
import { formatLineName } from '../../utils/lineDisplay'

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
    /** range 模式默认跨度（月），线路概况等重页建议 1 */
    defaultRangeMonths: { type: Number, default: 1 },
  },
  emits: ['update:lineId', 'update:direction', 'update:selectedDates', 'change'],
  setup(props, { emit }) {
    const local = reactive({
      lineId: props.lineId,
      direction: props.direction,
      dates: [...props.selectedDates],
      dateRange: null,
    })

    const formatDate = formatInspectDate

    const dateOptionLabel = (d) => formatDate(d)

    const syncRangeFromDates = () => {
      if (props.dateFilterMode !== 'range' || !props.dates.length) return
      // 优先沿用当前已选日期覆盖的范围，避免切页/刷新把范围打回「近3月」
      const selected = (props.selectedDates || []).filter((d) => (props.dates || []).includes(d))
      if (selected.length) {
        const sorted = [...selected].sort((a, b) => String(a).localeCompare(String(b)))
        const oldest = parseInspectDate(sorted[0])
        const newest = parseInspectDate(sorted[sorted.length - 1])
        if (oldest && newest) {
          local.dateRange = [toPickerDate(oldest), toPickerDate(newest)]
          applyRange()
          return
        }
      }
      if (Array.isArray(local.dateRange) && local.dateRange.length === 2) {
        applyRange()
        return
      }
      const def = defaultRangeForDates(props.dates, props.defaultRangeMonths)
      if (!def) return
      local.dateRange = [toPickerDate(def[0]), toPickerDate(def[1])]
      applyRange()
    }

    const applyRange = () => {
      if (!local.dateRange || local.dateRange.length !== 2) {
        local.dates = []
        return
      }
      const start = parseInspectDate(local.dateRange[0])
      const end = parseInspectDate(local.dateRange[1])
      local.dates = filterDatesByRange(props.dates, start, end)
    }

    const disabledDate = (date) => {
      if (!props.dates.length) return true
      const oldest = parseInspectDate(props.dates[props.dates.length - 1])
      const newest = parseInspectDate(props.dates[0])
      if (!oldest || !newest) return false
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      return d < oldest || d > newest
    }

    const setRangeMonths = (months) => {
      const def = defaultRangeForDates(props.dates, months)
      if (!def) return
      local.dateRange = [toPickerDate(def[0]), toPickerDate(def[1])]
      applyRange()
      emitChange()
    }

    const setRangeAll = () => {
      if (!props.dates.length) return
      const oldest = parseInspectDate(props.dates[props.dates.length - 1])
      const newest = parseInspectDate(props.dates[0])
      if (!oldest || !newest) return
      local.dateRange = [toPickerDate(oldest), toPickerDate(newest)]
      applyRange()
      emitChange()
    }

    const onRangeChange = () => {
      applyRange()
    }

    const emitChange = () => {
      emit('update:lineId', local.lineId)
      emit('update:direction', local.direction)
      emit('update:selectedDates', local.dates)
      emit('change', {
        lineId: local.lineId,
        direction: local.direction,
        dates: local.dates,
        dateRange: local.dateRange,
      })
    }

    const onLineChange = () => emitChange()
    const onDirectionChange = () => emitChange()

    const onDatesSelect = () => {
      if (props.simpleDates && local.dates.length > 2) {
        const order = props.dates || []
        local.dates = order.filter((d) => local.dates.includes(d)).slice(0, 2)
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
          emitChange()
        }
      }
    }

    watch(() => props.lineId, (v) => {
      local.lineId = v || ''
      syncLineId()
    })
    watch(() => props.direction, (v) => { local.direction = v })
    watch(
      () => props.selectedDates,
      (v) => {
        const next = [...(v || [])]
        if (props.dateFilterMode === 'range') {
          // range 模式也同步选中集合，供日历范围回填
          local.dates = next
          return
        }
        local.dates = next
      },
    )
    watch(
      () => [props.dates, props.dateFilterMode],
      ([dates, mode], prev) => {
        const oldMode = prev?.[1]
        const list = dates || []
        if (!list.length) return

        if (mode === 'range') {
          // 仅在进入 range，或可选日期池变化且当前选择失效时重算
          const stillOk = (local.dates || []).some((d) => list.includes(d))
            || (props.selectedDates || []).some((d) => list.includes(d))
          if (oldMode !== 'range' || !stillOk || !local.dateRange) {
            syncRangeFromDates()
            const before = JSON.stringify(props.selectedDates || [])
            const after = JSON.stringify(local.dates || [])
            if (before !== after) emitChange()
          } else {
            applyRange()
          }
          return
        }

        // periods：保留仍有效的选择；仅在从 range 切来且选择为空时给默认
        const kept = (props.selectedDates?.length ? props.selectedDates : local.dates)
          .filter((d) => list.includes(d))
        if (kept.length) {
          local.dates = kept
          if (oldMode === 'range') emitChange()
          return
        }
        if (oldMode === 'range' || !(local.dates || []).length) {
          local.dates = list.slice(0, Math.min(props.simpleDates ? 2 : 2, list.length))
          emitChange()
        }
      },
      { immediate: true },
    )

    watch(() => props.lines, () => syncLineId(), { deep: true })

    return {
      local,
      lineLabel,
      orphanLineOption,
      formatDate,
      dateOptionLabel,
      emitChange,
      selectRecent,
      onLineChange,
      onDirectionChange,
      onDatesSelect,
      onRangeChange,
      setRangeMonths,
      setRangeAll,
      disabledDate,
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
.filter-dates,
.filter-range {
  flex: 1;
  min-width: 280px;
}
.range-hint {
  font-size: 12px;
  color: var(--om-text-dim);
  white-space: nowrap;
}
.filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 12px;
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
