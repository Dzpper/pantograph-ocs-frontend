<template>
  <div class="data-page" v-loading="loading">
    <div class="page-head">
      <h2 class="page-title">碳滑板磨耗数据导入</h2>
      <p class="page-sub">导入 Excel，或按条件查询后勾选测点统一编辑/删除（按线路拓扑：{{ topoSummary }}）</p>
      <p v-if="replaceHint" class="hint-line">{{ replaceHint }}</p>
    </div>

    <el-tabs v-model="activeTab" class="data-tabs">
      <!-- 数据维护 -->
      <el-tab-pane label="数据维护" name="crud">
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
                <span class="om-option-extra">{{ l.measurement_count || 0 }} 条</span>
              </el-option>
            </el-select>
          </div>
          <div class="om-toolbar-field">
            <span class="om-toolbar-label">车号</span>
            <el-select v-model="vehicleNo" clearable filterable placeholder="全部" style="width: 140px" @change="onFilterChange">
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
              @change="onFilterChange"
            />
          </div>
          <div class="om-toolbar-actions">
            <el-button type="primary" @click="loadRows">查询</el-button>
            <el-button @click="openCreate">新增测点</el-button>
            <el-dropdown trigger="click" @command="onMoreCommand">
              <el-button>
                更多
                <span class="more-caret">▾</span>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="clearLine" :disabled="!lineCode" divided>
                    <span class="danger-item">清空本线路全部数据…</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <div v-if="selectedIds.length" class="selection-bar">
          <span class="selection-info">
            已勾选 <b>{{ selectedIds.length }}</b> 条
            <el-button link type="primary" @click="clearSelection">取消勾选</el-button>
          </span>
          <div class="selection-actions">
            <el-button
              type="primary"
              plain
              :disabled="selectedIds.length !== 1"
              @click="editSelected"
            >
              编辑{{ selectedIds.length === 1 ? '' : '（需勾选1条）' }}
            </el-button>
            <el-button type="danger" plain @click="batchDelete">删除所选</el-button>
          </div>
        </div>
        <p v-else class="select-hint">勾选表格左侧复选框后，可统一编辑（单条）或删除（支持多条）。</p>

        <div class="om-panel">
          <el-table
            ref="tableRef"
            :data="rows"
            size="small"
            stripe
            height="520"
            row-key="measurement_id"
            @selection-change="onSelectionChange"
          >
            <el-table-column type="selection" width="42" reserve-selection />
            <el-table-column prop="vehicle_no" label="车号" width="90" fixed />
            <el-table-column prop="inspect_date" label="检查日期" width="120" />
            <el-table-column label="公里数" width="100">
              <template #default="{ row }">{{ fmt(row.odometer_km, 0) }}</template>
            </el-table-column>
            <el-table-column
              v-for="slot in currentSlots"
              :key="slot.key"
              :label="slot.label"
              width="92"
            >
              <template #default="{ row }">{{ fmt(slotVal(row, slot), 2) }}</template>
            </el-table-column>
            <el-table-column label="平均高度" width="90">
              <template #default="{ row }">{{ fmt(row.avg_height, 3) }}</template>
            </el-table-column>
            <el-table-column label="万公里磨耗(均)" width="120">
              <template #default="{ row }">{{ fmt(row.wear_per_10k_avg, 3) }}</template>
            </el-table-column>
            <el-table-column label="换板" width="70">
              <template #default="{ row }">{{ row.is_replaced ? '是' : '否' }}</template>
            </el-table-column>
            <el-table-column prop="replace_cycle" label="周期" width="70" />
          </el-table>

          <div class="pager">
            <span class="pager-info">共 {{ total }} 条</span>
            <el-pagination
              background
              layout="prev, pager, next, sizes"
              :total="total"
              v-model:current-page="page"
              v-model:page-size="pageSize"
              :page-sizes="[20, 50, 100]"
              @current-change="loadRows"
              @size-change="onPageSizeChange"
            />
          </div>
        </div>
      </el-tab-pane>

      <!-- Excel 导入 -->
      <el-tab-pane label="Excel 导入" name="import">
        <DataSourceNote
          type="info"
          title="导入说明"
          :message="`上传与「滑板磨耗原始数据表」同结构的 Excel。必填：车号、检查日期、公里数及厚度列（当前线路 ${topoSummary}）。「是否更换碳滑板」「当前更换周期」为选填。请先选线路再下载对应模板。`"
        />

        <div class="om-panel upload-panel">
          <div class="template-row">
            <el-button type="primary" plain :loading="downloadingTemplate" @click="downloadTemplate">
              下载填写模板
            </el-button>
            <span class="template-hint">
              含标准表头、示例行与「填写说明」工作表；选填列（含换板标记）可留空。
            </span>
          </div>

          <el-upload
            drag
            :auto-upload="false"
            :limit="1"
            accept=".xlsx,.xls"
            :on-change="onFileChange"
            :on-remove="onFileRemove"
            :file-list="fileList"
          >
            <div class="upload-inner">
              <div class="upload-icon">Excel</div>
              <div class="upload-text">将文件拖到此处，或 <em>点击选择</em></div>
              <div class="upload-hint">表头需含：车号、检查日期、公里数、2车、列1（2车弓板2）、5车、列2（5车弓板2）</div>
            </div>
          </el-upload>

          <div class="form-grid" v-if="file">
            <div class="field">
              <label>工作表</label>
              <el-select v-model="sheetName" clearable placeholder="自动识别原始数据表" style="width: 100%">
                <el-option
                  v-for="s in sheets"
                  :key="s.sheet_name"
                  :label="sheetLabel(s)"
                  :value="s.sheet_name"
                />
              </el-select>
            </div>
            <div class="field">
              <label>{{ isOwner ? '导入线路（必选）' : '线路（可选覆盖）' }}</label>
              <el-select
                v-model="importLineCode"
                :clearable="!isOwner"
                :placeholder="isOwner ? '请选择授权线路' : '按工作表名自动匹配'"
                style="width: 100%"
              >
                <el-option
                  v-for="l in importLineOptions"
                  :key="l.line_code"
                  :label="formatLineName(l.line_name, l.line_code)"
                  :value="l.line_code"
                />
              </el-select>
              <p v-if="isOwner && !importLineOptions.length" class="hint-line warn">
                尚未分配线路，请联系管理员在用户管理中开通后再导入。
              </p>
            </div>
            <div class="field field-check">
              <el-checkbox v-model="replaceLineData">覆盖该线路已有数据</el-checkbox>
            </div>
          </div>

          <div class="actions">
            <el-button type="primary" :disabled="!file" :loading="importing" @click="doImport">开始导入</el-button>
            <el-button :disabled="!file" @click="doPreview">预览工作表</el-button>
          </div>

          <el-alert
            v-if="resultMsg"
            :title="resultMsg"
            :type="resultOk ? 'success' : 'error'"
            show-icon
            :closable="false"
            style="margin-top: 16px"
          />

          <el-table v-if="importResults.length" :data="importResults" size="small" style="margin-top: 12px" stripe>
            <el-table-column prop="line_name" label="线路" min-width="140" />
            <el-table-column prop="sheet_name" label="工作表" min-width="180" />
            <el-table-column prop="raw_rows" label="原始行" width="90" />
            <el-table-column prop="stored_rows" label="入库行" width="90" />
            <el-table-column prop="vehicle_count" label="车辆数" width="90" />
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑测点' : '新增测点'"
      width="640px"
      destroy-on-close
    >
      <el-form :model="form" label-width="110px" class="edit-form">
        <el-form-item label="线路" required>
          <el-select v-model="form.line_code" style="width: 100%" :disabled="!!editingId">
            <el-option v-for="l in lines" :key="l.line_code" :label="formatLineName(l.line_name, l.line_code)" :value="l.line_code" />
          </el-select>
        </el-form-item>
        <el-form-item label="车号" required>
          <el-input v-model="form.vehicle_no" placeholder="如 0427 / 1208" />
        </el-form-item>
        <el-form-item label="检查日期" required>
          <el-date-picker v-model="form.inspect_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="公里数">
          <el-input-number v-model="form.odometer_km" :controls="false" style="width: 100%" />
        </el-form-item>
        <div class="thick-grid">
          <el-form-item v-for="slot in formSlots" :key="slot.key" :label="slot.label">
            <el-input-number
              v-model="form.strip_values[slot.key]"
              :precision="3"
              :step="0.01"
              :controls="false"
              style="width: 100%"
            />
          </el-form-item>
        </div>
        <el-form-item label="平均高度">
          <el-input-number v-model="form.avg_height" :precision="4" :step="0.01" :controls="false" style="width: 100%" placeholder="可留空自动计算" />
        </el-form-item>
        <el-form-item label="万公里磨耗(均)">
          <el-input-number v-model="form.wear_per_10k_avg" :precision="4" :step="0.01" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="万公里磨耗(最大)">
          <el-input-number v-model="form.wear_per_10k_max" :precision="4" :step="0.01" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="是否换板">
          <el-switch v-model="form.is_replaced" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="更换周期">
          <el-input-number v-model="form.replace_cycle" :min="1" :step="1" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, computed, onMounted, onActivated, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DataSourceNote from './common/DataSourceNote.vue'
import {
  fetchStripWearLines,
  fetchStripWearVehicles,
  fetchStripWearMeasurements,
  createStripWearMeasurement,
  updateStripWearMeasurement,
  deleteStripWearMeasurements,
  previewStripWearSheets,
  importStripWearExcel,
  downloadStripWearImportTemplate,
  fetchImportLineOptions,
  fetchMe,
} from '../api/client'
import { loadStripPrefs, saveStripPrefs, defaultStripDateRange } from '../utils/stripPrefs'
import { coerceLineCode, resolveLineName, formatLineName } from '../utils/lineDisplay'
import {
  resolveTopology,
  slotValue,
  emptyStripValues,
  stripValuesFromRow,
  payloadFromStripValues,
} from '../utils/stripTopology'

function emptyForm(lineCode = '', topo = null) {
  const t = topo || resolveTopology(null)
  return {
    line_code: lineCode,
    vehicle_no: '',
    inspect_date: '',
    odometer_km: null,
    strip_values: emptyStripValues(t),
    avg_height: null,
    wear_per_10k_avg: null,
    wear_per_10k_max: null,
    is_replaced: 0,
    replace_cycle: 1,
  }
}

function fmt(v, digits = 2) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toFixed(digits)
}

function apiErr(e, fallback = '请求失败') {
  const d = e?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join('；')
  if (e?.response?.status === 404) {
    return '接口不存在（404）。请重启后端以加载碳滑板增删改接口后重试。'
  }
  return e?.message || fallback
}

export default {
  name: 'StripWearImportPage',
  components: { DataSourceNote },
  props: {
    navigateContext: { type: Object, default: () => ({}) },
  },
  setup(props) {
    const activeTab = ref('crud')
    const loading = ref(false)
    const saving = ref(false)
    const importing = ref(false)
    const downloadingTemplate = ref(false)
    const replaceHint = ref('')

    const lines = ref([])
    const prefs0 = loadStripPrefs()
    const lineCode = ref(prefs0.lineCode || '')
    const vehicles = ref([])
    const vehicleNo = ref('')
    const dateRange = ref(prefs0.dateRange || defaultStripDateRange())
    const rows = ref([])
    const total = ref(0)
    const page = ref(1)
    const pageSize = ref(50)
    const selectedIds = ref([])
    const selectedRows = ref([])
    const tableRef = ref(null)

    const dialogVisible = ref(false)
    const editingId = ref(null)
    const form = ref(emptyForm())

    const file = ref(null)
    const fileList = ref([])
    const sheets = ref([])
    const sheetName = ref('')
    const importLineCode = ref('')
    const replaceLineData = ref(false)
    const importResults = ref([])
    const resultMsg = ref('')
    const resultOk = ref(false)
    const importLineOptions = ref([])
    const isOwner = ref(false)
    const pageTopology = ref(null)

    const currentTopo = computed(() => {
      const line = lines.value.find((l) => l.line_code === lineCode.value)
      return resolveTopology(pageTopology.value || line)
    })
    const currentSlots = computed(() => currentTopo.value.slots || [])
    const topoSummary = computed(() => currentTopo.value.summary || '双弓2板')
    const formTopo = computed(() => {
      const line = lines.value.find((l) => l.line_code === form.value.line_code)
      return resolveTopology(line || currentTopo.value)
    })
    const formSlots = computed(() => formTopo.value.slots || [])

    function slotVal(row, slot) {
      return slotValue(row, slot)
    }

    async function loadImportLineOptions() {
      try {
        const me = await fetchMe()
        isOwner.value = me?.role === 'owner'
        importLineOptions.value = await fetchImportLineOptions()
        if (isOwner.value && importLineOptions.value.length === 1) {
          importLineCode.value = importLineOptions.value[0].line_code
        }
      } catch {
        importLineOptions.value = []
      }
    }

    async function loadLines() {
      try {
        lines.value = await fetchStripWearLines()
        lineCode.value = coerceLineCode(lineCode.value, lines.value)
        if (!lineCode.value && lines.value.length) {
          const withData = lines.value.find((l) => (l.measurement_count || 0) > 0)
          lineCode.value = (withData || lines.value[0]).line_code
        }
        if (!dateRange.value) dateRange.value = defaultStripDateRange()
        saveStripPrefs({ lineCode: lineCode.value, dateRange: dateRange.value })
      } catch (e) {
        lines.value = []
        ElMessage.error(apiErr(e, '加载线路失败'))
      }
    }

    async function loadVehicles() {
      try {
        vehicles.value = lineCode.value ? await fetchStripWearVehicles(lineCode.value) : []
      } catch {
        vehicles.value = []
      }
    }

    async function loadRows() {
      if (!lineCode.value) {
        rows.value = []
        total.value = 0
        return
      }
      loading.value = true
      try {
        const data = await fetchStripWearMeasurements({
          line_code: lineCode.value,
          vehicle_no: vehicleNo.value || '',
          date_from: dateRange.value?.[0] || '',
          date_to: dateRange.value?.[1] || '',
          page: page.value,
          page_size: pageSize.value,
        })
        // 兼容旧后端误返回 {detail:"Not Found"}
        if (data?.detail && data.items == null) {
          throw Object.assign(new Error(String(data.detail)), {
            response: { status: 404, data: { detail: data.detail } },
          })
        }
        rows.value = data.items || []
        total.value = data.total || 0
        if (data.topology) pageTopology.value = data.topology
      } catch (e) {
        rows.value = []
        total.value = 0
        ElMessage.error(apiErr(e, '查询失败'))
      } finally {
        loading.value = false
      }
    }

    async function onFilterChange() {
      page.value = 1
      clearSelection()
      saveStripPrefs({ lineCode: lineCode.value, dateRange: dateRange.value })
      await loadVehicles()
      if (vehicleNo.value && !vehicles.value.includes(vehicleNo.value)) vehicleNo.value = ''
      await loadRows()
    }

    function onPageSizeChange() {
      page.value = 1
      clearSelection()
      loadRows()
    }

    function onSelectionChange(sel) {
      selectedRows.value = sel || []
      selectedIds.value = selectedRows.value.map((r) => r.measurement_id)
    }

    function clearSelection() {
      selectedRows.value = []
      selectedIds.value = []
      tableRef.value?.clearSelection?.()
    }

    function onMoreCommand(cmd) {
      if (cmd === 'clearLine') clearLine()
    }

    function editSelected() {
      if (selectedRows.value.length !== 1) {
        ElMessage.warning('请勾选恰好 1 条测点后再编辑')
        return
      }
      openEdit(selectedRows.value[0])
    }

    function openCreate(preset = {}) {
      editingId.value = null
      const code = preset.line_code || lineCode.value
      const line = lines.value.find((l) => l.line_code === code)
      form.value = {
        ...emptyForm(code, resolveTopology(line || currentTopo.value)),
        vehicle_no: preset.vehicle_no || '',
        is_replaced: preset.is_replaced != null ? preset.is_replaced : 0,
        replace_cycle: preset.replace_cycle || 1,
      }
      dialogVisible.value = true
    }

    function openReplaceFromPredict() {
      const nav = props.navigateContext || {}
      if (!nav.markReplace) return
      activeTab.value = 'crud'
      if (nav.lineCode) lineCode.value = nav.lineCode
      if (nav.vehicleNo) vehicleNo.value = nav.vehicleNo
      replaceHint.value = nav.unevenTarget
        ? `来自预测：重点关注 ${nav.unevenTarget}。请新增测点；若已更换可勾选「是否换板」。`
        : '来自预测：请新增测点；若已更换可勾选「是否换板」。'
      openCreate({
        line_code: nav.lineCode || lineCode.value,
        vehicle_no: nav.vehicleNo || '',
        is_replaced: 1,
      })
      ElMessage.info(replaceHint.value)
    }

    function openEdit(row) {
      editingId.value = row.measurement_id
      const topo = resolveTopology(pageTopology.value || currentTopo.value)
      form.value = {
        line_code: lineCode.value,
        vehicle_no: row.vehicle_no,
        inspect_date: String(row.inspect_date || '').slice(0, 10),
        odometer_km: row.odometer_km,
        strip_values: stripValuesFromRow(row, topo),
        avg_height: row.avg_height,
        wear_per_10k_avg: row.wear_per_10k_avg,
        wear_per_10k_max: row.wear_per_10k_max,
        is_replaced: row.is_replaced ? 1 : 0,
        replace_cycle: row.replace_cycle || 1,
      }
      dialogVisible.value = true
    }

    async function saveForm() {
      if (!form.value.line_code || !form.value.vehicle_no || !form.value.inspect_date) {
        ElMessage.warning('请填写线路、车号、检查日期')
        return
      }
      saving.value = true
      try {
        const topo = formTopo.value
        const thick = payloadFromStripValues(form.value.strip_values, topo)
        const payload = {
          line_code: form.value.line_code,
          vehicle_no: form.value.vehicle_no,
          inspect_date: form.value.inspect_date,
          odometer_km: form.value.odometer_km,
          avg_height: form.value.avg_height,
          wear_per_10k_avg: form.value.wear_per_10k_avg,
          wear_per_10k_max: form.value.wear_per_10k_max,
          is_replaced: form.value.is_replaced,
          replace_cycle: form.value.replace_cycle,
          ...thick,
        }
        if (editingId.value) {
          await updateStripWearMeasurement(editingId.value, payload)
          ElMessage.success('已更新')
        } else {
          await createStripWearMeasurement(payload)
          ElMessage.success('已新增')
        }
        dialogVisible.value = false
        await loadLines()
        await loadVehicles()
        await loadRows()
      } catch (e) {
        ElMessage.error(apiErr(e, '保存失败'))
      } finally {
        saving.value = false
      }
    }

    function rowBrief(row) {
      const d = String(row.inspect_date || '').slice(0, 10)
      return `${row.vehicle_no || '—'} / ${d || '—'}`
    }

    function buildDeletePreviewHtml(list) {
      const n = list.length
      const samples = list
        .slice(0, 8)
        .map((r) => `<li>${rowBrief(r)}</li>`)
        .join('')
      const more = n > 8 ? `<li>…另有 ${n - 8} 条</li>` : ''
      return (
        `<p>即将<strong>永久删除</strong> <b>${n}</b> 条测点，删除后不可恢复。</p>` +
        `<p style="margin:10px 0 4px;font-size:12px;color:var(--el-text-color-secondary)">勾选预览：</p>` +
        `<ul style="margin:0;padding-left:18px;font-size:12px;max-height:160px;overflow:auto">${samples}${more}</ul>` +
        `<p style="margin-top:12px">请确认已核对勾选内容后再继续。</p>`
      )
    }

    async function batchDelete() {
      const list = selectedRows.value
      const n = list.length
      if (!n) {
        ElMessage.warning('请先勾选要删除的测点')
        return
      }
      try {
        await ElMessageBox.confirm(buildDeletePreviewHtml(list), '删除确认', {
          type: 'warning',
          dangerouslyUseHTMLString: true,
          confirmButtonText: '下一步',
          cancelButtonText: '取消',
          distinguishCancelAndClose: true,
        })
        // 二次确认：输入删除条数，避免误触
        await ElMessageBox.prompt(
          `请输入要删除的条数「${n}」以确认操作`,
          '二次确认',
          {
            confirmButtonText: '确认删除',
            cancelButtonText: '取消',
            confirmButtonClass: 'el-button--danger',
            inputPlaceholder: String(n),
            inputPattern: new RegExp(`^${n}$`),
            inputErrorMessage: `请输入数字 ${n}`,
            distinguishCancelAndClose: true,
          },
        )
        await deleteStripWearMeasurements({ ids: selectedIds.value })
        ElMessage.success(`已删除 ${n} 条`)
        clearSelection()
        await loadLines()
        await loadRows()
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') ElMessage.error(apiErr(e, '删除失败'))
      }
    }

    async function clearLine() {
      if (!lineCode.value) return
      const lineName = resolveLineName(lineCode.value, lines.value, '当前线路')
      const count =
        lines.value.find((l) => l.line_code === lineCode.value)?.measurement_count ?? '全部'
      try {
        await ElMessageBox.confirm(
          `<p>将清空线路 <b>${lineName}</b> 的全部磨耗测点（约 ${count} 条）。</p>` +
            `<p style="margin-top:8px;color:var(--el-color-danger)">此操作不可恢复，且会影响看板与预测结果。</p>`,
          '清空线路',
          {
            type: 'error',
            dangerouslyUseHTMLString: true,
            confirmButtonText: '下一步',
            cancelButtonText: '取消',
            distinguishCancelAndClose: true,
          },
        )
        await ElMessageBox.prompt(
          `请输入完整线路名称以确认清空：\n「${lineName}」`,
          '二次确认',
          {
            confirmButtonText: '确认清空',
            cancelButtonText: '取消',
            confirmButtonClass: 'el-button--danger',
            inputPlaceholder: lineName,
            inputValidator: (v) => {
              if (String(v || '').trim() !== lineName) return `请输入：${lineName}`
              return true
            },
            distinguishCancelAndClose: true,
          },
        )
        const res = await deleteStripWearMeasurements({ line_code: lineCode.value, ids: [] })
        ElMessage.success(`已清空 ${res.deleted || 0} 条`)
        clearSelection()
        await loadLines()
        await loadVehicles()
        await loadRows()
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') ElMessage.error(apiErr(e, '清空失败'))
      }
    }

    function sheetLabel(s) {
      const tag = s.is_raw_candidate ? '原始表' : '其他'
      const line = s.suggested_line_name ? ` · ${s.suggested_line_name}` : ''
      return `${s.sheet_name}（${tag}${line}）`
    }

    async function onFileChange(uploadFile) {
      file.value = uploadFile.raw
      fileList.value = [uploadFile]
      resultMsg.value = ''
      importResults.value = []
      sheetName.value = ''
      await doPreview()
    }

    function onFileRemove() {
      file.value = null
      fileList.value = []
      sheets.value = []
      sheetName.value = ''
    }

    async function downloadTemplate() {
      if (isOwner.value && !importLineCode.value && importLineOptions.value.length > 1) {
        ElMessage.info('已下载通用模板；在下方选择「导入线路」后再次下载可带上线路名称')
      }
      downloadingTemplate.value = true
      try {
        const code = importLineCode.value || (isOwner.value ? '' : lineCode.value)
        await downloadStripWearImportTemplate(code || '')
        ElMessage.success('模板已开始下载')
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || e.message || '下载失败')
      } finally {
        downloadingTemplate.value = false
      }
    }

    async function doPreview() {
      if (!file.value) return
      loading.value = true
      try {
        const data = await previewStripWearSheets(file.value)
        sheets.value = data.sheets || []
        resultMsg.value = `已识别 ${sheets.value.filter((s) => s.is_raw_candidate).length} 个原始数据表`
        resultOk.value = true
      } catch (e) {
        resultMsg.value = e?.response?.data?.detail || e.message || '预览失败'
        resultOk.value = false
      } finally {
        loading.value = false
      }
    }

    async function doImport() {
      if (!file.value) return
      if (isOwner.value && !importLineCode.value) {
        ElMessage.warning('请选择要导入的线路')
        return
      }
      importing.value = true
      resultMsg.value = ''
      try {
        const data = await importStripWearExcel(file.value, {
          line_code: importLineCode.value,
          sheet_name: sheetName.value,
          replace_line_data: replaceLineData.value,
        })
        importResults.value = data.imports || []
        const n = importResults.value.reduce((s, r) => s + (r.stored_rows || 0), 0)
        resultMsg.value = `导入成功：共写入 ${n} 条`
        resultOk.value = true
        await loadLines()
        activeTab.value = 'crud'
        await onFilterChange()
      } catch (e) {
        resultMsg.value = e?.response?.data?.detail || e.message || '导入失败'
        resultOk.value = false
      } finally {
        importing.value = false
      }
    }

    async function refreshAll() {
      await loadImportLineOptions()
      await loadLines()
      await loadVehicles()
      await loadRows()
      openReplaceFromPredict()
    }

    watch(
      () => props.navigateContext,
      () => openReplaceFromPredict(),
    )

    onMounted(refreshAll)
    onActivated(refreshAll)

    return {
      activeTab, loading, saving, importing, downloadingTemplate, replaceHint,
      lines, lineCode, vehicles, vehicleNo, dateRange,
      rows, total, page, pageSize, selectedIds, tableRef,
      dialogVisible, editingId, form,
      file, fileList, sheets, sheetName, importLineCode, replaceLineData,
      importResults, resultMsg, resultOk, importLineOptions, isOwner,
      currentSlots, formSlots, topoSummary, slotVal,
      fmt, loadRows, onFilterChange, onPageSizeChange, onSelectionChange,
      clearSelection, editSelected, onMoreCommand,
      openCreate, openEdit, saveForm, batchDelete, clearLine,
      sheetLabel, onFileChange, onFileRemove, downloadTemplate, doPreview, doImport,
      formatLineName,
    }
  },
}
</script>

<style scoped>
.data-page {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}
.page-head { margin-bottom: 12px; }
.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--om-text);
}
.page-sub { color: var(--om-text-muted); font-size: 13px; margin: 4px 0 0; }
.hint-line { margin: 6px 0 0; font-size: 12px; color: var(--om-warning); }
.more-caret { margin-left: 4px; font-size: 10px; opacity: 0.7; }
.danger-item { color: var(--el-color-danger); }
.select-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--om-text-muted);
}
.selection-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--om-panel-border);
  background: var(--om-panel);
}
.selection-info {
  font-size: 13px;
  color: var(--om-text);
}
.selection-info b {
  color: var(--om-accent);
  font-variant-numeric: tabular-nums;
}
.selection-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pager {
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pager-info { font-size: 13px; color: var(--om-text-muted); }
.upload-panel { margin-bottom: 16px; }
.template-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--om-border, #e8e8e8);
}
.template-hint {
  font-size: 13px;
  color: var(--om-text-muted);
  line-height: 1.5;
}
.upload-inner { padding: 12px 0; text-align: center; }
.upload-icon { font-size: 36px; }
.upload-text { margin-top: 6px; }
.upload-text em { color: var(--om-accent); font-style: normal; }
.upload-hint { margin-top: 6px; font-size: 12px; color: var(--om-text-muted); }
.form-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}
.field label {
  display: block;
  font-size: 12px;
  color: var(--om-text-muted);
  margin-bottom: 6px;
}
.field-check { display: flex; align-items: end; padding-bottom: 6px; }
.actions { margin-top: 16px; display: flex; gap: 8px; }
.thick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 8px;
}
@media (max-width: 900px) {
  .form-grid, .thick-grid { grid-template-columns: 1fr; }
}
</style>
