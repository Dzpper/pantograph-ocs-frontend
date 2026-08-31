<template>
  <div class="data-page" v-loading="loading">
    <div class="page-head">
      <h2 class="page-title">隧道温湿度数据导入</h2>
      <p class="page-sub">导入 Excel，或按条件查询后勾选日数据统一编辑/删除</p>
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
            <el-button type="primary" @click="loadRows">查询</el-button>
            <el-button @click="openCreate">新增日数据</el-button>
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
            row-key="daily_id"
            @selection-change="onSelectionChange"
          >
            <el-table-column type="selection" width="42" reserve-selection />
            <el-table-column prop="observe_date" label="日期" min-width="140" />
            <el-table-column label="温度（℃）" min-width="120">
              <template #default="{ row }">{{ fmt(row.temp_c, 2) }}</template>
            </el-table-column>
            <el-table-column label="相对湿度（%）" min-width="140">
              <template #default="{ row }">{{ fmt(row.rh_pct, 2) }}</template>
            </el-table-column>
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
        <div class="om-panel upload-panel">
          <p class="import-tip">选择 Excel 后自动解析预览；核对日期/温度/湿度无误，再点「确认导入」写入数据库。</p>
          <div class="template-row">
            <el-button type="primary" plain :loading="downloadingTemplate" @click="downloadTemplate">
              下载填写模板
            </el-button>
            <span class="template-hint">
              管理员默认宽表（4/12 号线）；业主选「导入线路」后下载单线路模板。
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
              <div class="upload-text">将文件拖到此处，或 <em>点击选择</em></div>
              <div class="upload-hint">
                宽表：日期 + 4号线温度/湿度 + 12号线温度/湿度
              </div>
            </div>
          </el-upload>

          <div class="form-grid" v-if="file">
            <div class="field">
              <label>工作表</label>
              <el-select v-model="sheetName" clearable placeholder="默认第一张" style="width: 100%" @change="refreshPreview">
                <el-option
                  v-for="s in sheets"
                  :key="s.sheet_name"
                  :label="s.sheet_name"
                  :value="s.sheet_name"
                />
              </el-select>
            </div>
            <div class="field">
              <label>{{ isOwner ? '导入线路（必选）' : '仅导入指定线路（可选）' }}</label>
              <el-select
                v-model="importLineCode"
                :clearable="!isOwner"
                :placeholder="isOwner ? '请选择授权线路' : '空=宽表内全部线路'"
                style="width: 100%"
                @change="refreshPreview"
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
              <el-checkbox v-model="replaceLineData">覆盖该线路已有日数据</el-checkbox>
            </div>
          </div>

          <div class="actions">
            <el-button :disabled="!file" :loading="previewing" @click="refreshPreview">重新预览</el-button>
            <el-button
              type="primary"
              :disabled="!file || !previewData?.total_rows"
              :loading="importing"
              @click="doImport"
            >
              确认导入{{ previewData?.total_rows ? `（${previewData.total_rows} 日）` : '' }}
            </el-button>
          </div>

          <el-alert
            v-if="previewData?.note"
            :title="previewData.note"
            type="info"
            show-icon
            :closable="false"
            style="margin-top: 16px"
          />

          <div v-for="line in (previewData?.lines || [])" :key="line.line_code" class="preview-block">
            <div class="panel-title">
              {{ line.line_name }} · 共 {{ line.row_count }} 日
              <span class="muted">（{{ line.date_from }} ~ {{ line.date_to }}，下表最多预览前 {{ (line.preview_rows || []).length }} 行）</span>
            </div>
            <el-table :data="line.preview_rows || []" size="small" stripe max-height="280">
              <el-table-column prop="observe_date" label="日期" min-width="130" />
              <el-table-column label="温度（℃）" min-width="120">
                <template #default="{ row }">{{ fmt(row.temp_c, 2) }}</template>
              </el-table-column>
              <el-table-column label="相对湿度（%）" min-width="140">
                <template #default="{ row }">{{ fmt(row.rh_pct, 2) }}</template>
              </el-table-column>
            </el-table>
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
            <el-table-column prop="sheet_name" label="工作表" min-width="120" />
            <el-table-column prop="stored_rows" label="入库日数" min-width="100" />
            <el-table-column prop="date_from" label="起" min-width="120" />
            <el-table-column prop="date_to" label="止" min-width="120" />
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑日温湿度' : '新增日温湿度'"
      width="480px"
      destroy-on-close
    >
      <el-form :model="form" label-width="110px">
        <el-form-item label="线路" required>
          <el-select v-model="form.line_code" style="width: 100%" :disabled="!!editingId">
            <el-option v-for="l in lines" :key="l.line_code" :label="formatLineName(l.line_name, l.line_code)" :value="l.line_code" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker
            v-model="form.observe_date"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="温度（℃）">
          <el-input-number v-model="form.temp_c" :precision="3" :step="0.1" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="相对湿度（%）">
          <el-input-number
            v-model="form.rh_pct"
            :precision="3"
            :step="0.1"
            :min="0"
            :max="100"
            :controls="false"
            style="width: 100%"
          />
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
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchClimateLines,
  fetchClimateDaily,
  createClimateDaily,
  updateClimateDaily,
  deleteClimateDailyBatch,
  previewClimateData,
  importClimateExcel,
  downloadClimateImportTemplate,
  fetchImportLineOptions,
  fetchMe,
} from '../api/client'
import { loadClimatePrefs, saveClimatePrefs, defaultClimateDateRange } from '../utils/climatePrefs'
import { coerceLineCode, resolveLineName, formatLineName } from '../utils/lineDisplay'

function emptyForm(lineCode = '') {
  return {
    line_code: lineCode,
    observe_date: '',
    temp_c: null,
    rh_pct: null,
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
    return '接口不存在（404）。请重启后端以加载温湿度增删改接口后重试。'
  }
  return e?.message || fallback
}

export default {
  name: 'ClimateImportPage',
  setup() {
    const activeTab = ref('crud')
    const loading = ref(false)
    const saving = ref(false)
    const importing = ref(false)
    const downloadingTemplate = ref(false)
    const previewing = ref(false)
    const previewData = ref(null)

    const lines = ref([])
    const prefs0 = loadClimatePrefs()
    const lineCode = ref(prefs0.lineCode || '')
    const dateRange = ref(prefs0.dateRange || defaultClimateDateRange())
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
        lines.value = await fetchClimateLines()
        lineCode.value = coerceLineCode(lineCode.value, lines.value)
        if (!lineCode.value && lines.value.length) {
          const withData = lines.value.find((l) => (l.filled_count || 0) > 0)
          lineCode.value = (withData || lines.value[0]).line_code
        }
        if (!dateRange.value) dateRange.value = defaultClimateDateRange()
        saveClimatePrefs({ lineCode: lineCode.value, dateRange: dateRange.value })
      } catch (e) {
        lines.value = []
        ElMessage.error(apiErr(e, '加载线路失败'))
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
        const data = await fetchClimateDaily({
          line_code: lineCode.value,
          date_from: dateRange.value?.[0] || '',
          date_to: dateRange.value?.[1] || '',
          page: page.value,
          page_size: pageSize.value,
        })
        if (data?.detail && data.items == null) {
          throw Object.assign(new Error(String(data.detail)), {
            response: { status: 404, data: { detail: data.detail } },
          })
        }
        rows.value = data.items || []
        total.value = data.total || 0
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
      saveClimatePrefs({ lineCode: lineCode.value, dateRange: dateRange.value })
      await loadRows()
    }

    function onPageSizeChange() {
      page.value = 1
      clearSelection()
      loadRows()
    }

    function onSelectionChange(sel) {
      selectedRows.value = sel || []
      selectedIds.value = selectedRows.value.map((r) => r.daily_id)
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
        ElMessage.warning('请勾选恰好 1 条后再编辑')
        return
      }
      openEdit(selectedRows.value[0])
    }

    function openCreate() {
      editingId.value = null
      form.value = emptyForm(lineCode.value)
      dialogVisible.value = true
    }

    function openEdit(row) {
      editingId.value = row.daily_id
      form.value = {
        line_code: lineCode.value,
        observe_date: String(row.observe_date || '').slice(0, 10),
        temp_c: row.temp_c,
        rh_pct: row.rh_pct,
      }
      dialogVisible.value = true
    }

    async function saveForm() {
      if (!form.value.line_code || !form.value.observe_date) {
        ElMessage.warning('请填写线路与日期')
        return
      }
      if (form.value.temp_c == null && form.value.rh_pct == null) {
        ElMessage.warning('温度与湿度至少填写一项')
        return
      }
      saving.value = true
      try {
        if (editingId.value) {
          await updateClimateDaily(editingId.value, form.value)
          ElMessage.success('已更新')
        } else {
          await createClimateDaily(form.value)
          ElMessage.success('已新增')
        }
        dialogVisible.value = false
        await loadLines()
        await loadRows()
      } catch (e) {
        ElMessage.error(apiErr(e, '保存失败'))
      } finally {
        saving.value = false
      }
    }

    function rowBrief(row) {
      const d = String(row.observe_date || '').slice(0, 10)
      return `${d || '—'} · T=${fmt(row.temp_c, 1)}℃ · RH=${fmt(row.rh_pct, 1)}%`
    }

    function buildDeletePreviewHtml(list) {
      const n = list.length
      const samples = list
        .slice(0, 8)
        .map((r) => `<li>${rowBrief(r)}</li>`)
        .join('')
      const more = n > 8 ? `<li>…另有 ${n - 8} 条</li>` : ''
      return (
        `<p>即将<strong>永久删除</strong> <b>${n}</b> 条日温湿度，删除后不可恢复。</p>` +
        `<p style="margin:10px 0 4px;font-size:12px;color:var(--el-text-color-secondary)">勾选预览：</p>` +
        `<ul style="margin:0;padding-left:18px;font-size:12px;max-height:160px;overflow:auto">${samples}${more}</ul>` +
        `<p style="margin-top:12px">请确认已核对勾选内容后再继续。</p>`
      )
    }

    async function batchDelete() {
      const list = selectedRows.value
      const n = list.length
      if (!n) {
        ElMessage.warning('请先勾选要删除的记录')
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
        await ElMessageBox.prompt(`请输入要删除的条数「${n}」以确认操作`, '二次确认', {
          confirmButtonText: '确认删除',
          cancelButtonText: '取消',
          confirmButtonClass: 'el-button--danger',
          inputPlaceholder: String(n),
          inputPattern: new RegExp(`^${n}$`),
          inputErrorMessage: `请输入数字 ${n}`,
          distinguishCancelAndClose: true,
        })
        await deleteClimateDailyBatch({ ids: selectedIds.value })
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
        lines.value.find((l) => l.line_code === lineCode.value)?.filled_count ?? '全部'
      try {
        await ElMessageBox.confirm(
          `<p>将清空线路 <b>${lineName}</b> 的全部日温湿度（约 ${count} 条）。</p>` +
            `<p style="margin-top:8px;color:var(--el-color-danger)">此操作不可恢复，且会影响温湿度看板与相关性诊断。</p>`,
          '清空线路',
          {
            type: 'error',
            dangerouslyUseHTMLString: true,
            confirmButtonText: '下一步',
            cancelButtonText: '取消',
            distinguishCancelAndClose: true,
          },
        )
        await ElMessageBox.prompt(`请输入完整线路名称以确认清空：\n「${lineName}」`, '二次确认', {
          confirmButtonText: '确认清空',
          cancelButtonText: '取消',
          confirmButtonClass: 'el-button--danger',
          inputPlaceholder: lineName,
          inputValidator: (v) => {
            if (String(v || '').trim() !== lineName) return `请输入：${lineName}`
            return true
          },
          distinguishCancelAndClose: true,
        })
        const res = await deleteClimateDailyBatch({ line_code: lineCode.value, ids: [] })
        ElMessage.success(`已清空 ${res.deleted || 0} 条`)
        clearSelection()
        await loadLines()
        await loadRows()
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') ElMessage.error(apiErr(e, '清空失败'))
      }
    }

    async function onFileChange(uploadFile) {
      file.value = uploadFile.raw
      fileList.value = [uploadFile]
      resultMsg.value = ''
      importResults.value = []
      previewData.value = null
      sheetName.value = ''
      await refreshPreview()
    }

    function onFileRemove() {
      file.value = null
      fileList.value = []
      sheets.value = []
      sheetName.value = ''
      previewData.value = null
    }

    async function downloadTemplate() {
      if (isOwner.value && !importLineCode.value && importLineOptions.value.length > 1) {
        ElMessage.info('已下载通用模板；在下方选择「导入线路」后再次下载可生成单线路模板')
      }
      downloadingTemplate.value = true
      try {
        const code = importLineCode.value || (isOwner.value ? '' : lineCode.value)
        await downloadClimateImportTemplate(code || '')
        ElMessage.success('模板已开始下载')
      } catch (e) {
        ElMessage.error(apiErr(e, '下载失败'))
      } finally {
        downloadingTemplate.value = false
      }
    }

    async function refreshPreview() {
      if (!file.value) return
      previewing.value = true
      try {
        const res = await previewClimateData(file.value, {
          line_code: importLineCode.value || '',
          sheet_name: sheetName.value || '',
          preview_limit: 30,
        })
        previewData.value = res
        sheets.value = res.sheets || []
        if (!sheetName.value && res.sheet_name) sheetName.value = res.sheet_name
        if (!res.total_rows) {
          ElMessage.warning('未解析到有效温湿度行，请检查表头是否含日期与温度/湿度')
        } else {
          ElMessage.success(`已预览 ${res.total_rows} 日数据，确认后可导入`)
        }
      } catch (e) {
        previewData.value = null
        ElMessage.error(apiErr(e, '预览失败'))
      } finally {
        previewing.value = false
      }
    }

    async function doImport() {
      if (!file.value) return
      if (!previewData.value?.total_rows) {
        ElMessage.warning('请先预览到有效数据再导入')
        return
      }
      if (isOwner.value && !importLineCode.value) {
        ElMessage.warning('请选择要导入的线路')
        return
      }
      importing.value = true
      resultMsg.value = ''
      try {
        const res = await importClimateExcel(file.value, {
          line_code: importLineCode.value || '',
          sheet_name: sheetName.value || '',
          replace_line_data: replaceLineData.value,
        })
        importResults.value = res.imports || []
        resultOk.value = true
        resultMsg.value = `导入成功：${importResults.value.map((x) => `${x.line_name} ${x.stored_rows} 日`).join('；')}`
        ElMessage.success(resultMsg.value)
        await loadLines()
        if (activeTab.value === 'crud') await loadRows()
      } catch (e) {
        resultOk.value = false
        resultMsg.value = apiErr(e, '导入失败')
        ElMessage.error(resultMsg.value)
      } finally {
        importing.value = false
      }
    }

    onMounted(async () => {
      await loadImportLineOptions()
      await loadLines()
      await loadRows()
    })

    return {
      activeTab,
      loading,
      saving,
      importing,
      downloadingTemplate,
      previewing,
      previewData,
      lines,
      lineCode,
      dateRange,
      rows,
      total,
      page,
      pageSize,
      selectedIds,
      tableRef,
      dialogVisible,
      editingId,
      form,
      file,
      fileList,
      sheets,
      sheetName,
      importLineCode,
      replaceLineData,
      importResults,
      resultMsg,
      resultOk,
      importLineOptions,
      isOwner,
      fmt,
      loadRows,
      onFilterChange,
      onPageSizeChange,
      onSelectionChange,
      clearSelection,
      onMoreCommand,
      editSelected,
      openCreate,
      openEdit,
      saveForm,
      batchDelete,
      onFileChange,
      onFileRemove,
      downloadTemplate,
      refreshPreview,
      doImport,
      formatLineName,
    }
  },
}
</script>

<style scoped>
.data-page { padding: 4px 2px 24px; }
.page-title { margin: 0 0 4px; font-size: 1.25rem; }
.page-sub { margin: 0; color: var(--om-text-muted, #6b7280); font-size: 0.9rem; }
.om-option-extra { float: right; color: var(--om-text-dim); font-size: 12px; margin-left: 12px; }
.select-hint { margin: 8px 0; font-size: 0.85rem; color: var(--om-text-muted); }
.selection-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 8px 0 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
}
.selection-actions { display: flex; gap: 8px; }
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pager-info { font-size: 0.85rem; color: var(--om-text-muted); }
.more-caret { margin-left: 4px; opacity: 0.7; }
.danger-item { color: var(--el-color-danger); }
.upload-panel { margin-top: 4px; }
.template-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--om-divider);
}
.template-hint {
  font-size: 13px;
  color: var(--om-text-muted);
  line-height: 1.5;
}
.upload-inner { padding: 12px; text-align: center; }
.upload-text { font-size: 0.95rem; }
.upload-hint { margin-top: 6px; font-size: 0.8rem; color: var(--om-text-muted); }
.import-tip { margin: 0 0 12px; font-size: 0.9rem; color: var(--om-text-muted); }
.preview-block { margin-top: 16px; }
.panel-title { font-weight: 600; margin-bottom: 8px; }
.panel-title .muted { font-weight: 400; font-size: 0.8rem; color: var(--om-text-dim); margin-left: 6px; }
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 12px;
  margin-top: 16px;
  align-items: end;
}
.field label { display: block; font-size: 0.8rem; color: var(--om-text-muted); margin-bottom: 4px; }
.actions { margin-top: 16px; display: flex; gap: 8px; }
@media (max-width: 900px) {
  .form-grid { grid-template-columns: 1fr; }
}
</style>
