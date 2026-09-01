<template>
  <div class="page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2 class="page-title">线路管理</h2>
        <p class="page-sub">
          线路开通、弓网导入与三域数据状态。点「维护」查看导入记录、管理批次。内部编码开通后不可修改。
        </p>
      </div>
      <el-button type="primary" @click="openCreate">开通新线路</el-button>
    </div>

    <div class="om-panel om-toolbar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索线路名称 / 城市"
        style="width: 220px"
      />
      <el-radio-group v-model="statusFilter">
        <el-radio-button label="all">全部</el-radio-button>
        <el-radio-button label="active">启用</el-radio-button>
        <el-radio-button label="inactive">已停用</el-radio-button>
      </el-radio-group>
      <el-button @click="loadAll">刷新</el-button>
    </div>

    <div class="om-panel">
      <el-table :data="filteredLines" size="small" stripe empty-text="暂无线路">
        <el-table-column prop="line_name" label="线路名称" min-width="150" />
        <el-table-column prop="city" label="城市" width="90" />
        <el-table-column label="状态" width="88">
          <template #default="{ row }">
            <el-tag size="small" :type="row.is_active ? 'success' : 'info'">
              {{ row.is_active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="弓网检测" width="96">
          <template #default="{ row }">
            <el-tag size="small" :type="row.has_monitor_data ? 'success' : 'info'">
              {{ row.has_monitor_data ? '已入库' : '待入库' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="磨耗" width="96">
          <template #default="{ row }">
            <el-tag size="small" :type="row.strip_measurement_count ? 'success' : 'info'">
              {{ row.strip_measurement_count ? `${row.strip_measurement_count} 条` : '待导入' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="温湿度" width="96">
          <template #default="{ row }">
            <el-tag size="small" :type="row.climate_day_count ? 'success' : 'info'">
              {{ row.climate_day_count ? `${row.climate_day_count} 日` : '待导入' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="授权" width="72">
          <template #default="{ row }">
            {{ row.grant_count || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="168" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openMaintain(row)">维护</el-button>
            <el-button link type="primary" @click="openImport(row)">导入弓网</el-button>
          </template>
        </el-table-column>
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-codes">
              <p>
                弓网编码：{{ row.monitor_code }} · 磨耗/温湿度编码：{{ row.strip_code }}
              </p>
              <p v-if="!row.can_delete" class="muted">
                已有数据或用户授权时不可删除；可先停用，或清理数据/授权后再删。
              </p>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-drawer
      v-model="maintainVisible"
      :title="maintainRow ? `维护 · ${maintainRow.line_name}` : '线路维护'"
      size="480px"
      destroy-on-close
    >
      <div v-if="maintainRow" class="maintain-body">
        <div class="maintain-status">
          <div class="status-item">
            <span>状态</span>
            <el-tag size="small" :type="maintainRow.is_active ? 'success' : 'info'">
              {{ maintainRow.is_active ? '启用' : '停用' }}
            </el-tag>
          </div>
          <div class="status-item">
            <span>弓网</span>
            <b>{{ maintainRow.has_monitor_data ? '已入库' : '待入库' }}</b>
          </div>
          <div class="status-item">
            <span>磨耗</span>
            <b>{{ maintainRow.strip_measurement_count ? `${maintainRow.strip_measurement_count} 条` : '待导入' }}</b>
          </div>
          <div class="status-item">
            <span>温湿度</span>
            <b>{{ maintainRow.climate_day_count ? `${maintainRow.climate_day_count} 日` : '待导入' }}</b>
          </div>
        </div>
        <p class="maintain-hint">
          弓网编码 {{ maintainRow.monitor_code }} · 磨耗/温湿度 {{ maintainRow.strip_code }}。
          磨耗与温湿度请到对应栏目导入。
        </p>
        <div class="maintain-actions">
          <el-button type="primary" @click="openImport(maintainRow)">导入弓网</el-button>
          <el-button :disabled="!maintainRow.has_monitor_data" @click="openManage(maintainRow)">管理批次</el-button>
          <el-button @click="openEdit(maintainRow)">编辑档案</el-button>
          <el-button v-if="maintainRow.is_active" type="warning" plain @click="toggleActive(maintainRow, false)">停用</el-button>
          <el-button v-else type="success" plain @click="toggleActive(maintainRow, true)">启用</el-button>
          <el-button type="danger" plain :disabled="!maintainRow.can_delete" @click="removeLine(maintainRow)">删除</el-button>
        </div>

        <h4 class="job-title">最近导入任务</h4>
        <el-table :data="recentJobs" size="small" v-loading="jobsLoading" empty-text="暂无导入记录">
          <el-table-column prop="status" label="状态" width="88">
            <template #default="{ row }">
              <el-tag size="small" :type="jobTag(row.status)">{{ jobStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="进度" width="72">
            <template #default="{ row }">{{ row.progress_pct != null ? `${row.progress_pct}%` : '—' }}</template>
          </el-table-column>
          <el-table-column label="结果" min-width="140">
            <template #default="{ row }">
              <span v-if="row.status === 'failed'" class="job-err">{{ row.error_message || '失败' }}</span>
              <span v-else>
                入库 {{ row.imported_count ?? 0 }} · 跳过 {{ row.skipped_count ?? 0 }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>

    <!-- 开通 -->
    <el-dialog v-model="createVisible" title="开通新线路" width="520px" @closed="resetCreateForm">
      <el-form label-width="112px" @submit.prevent>
        <el-form-item label="所在城市" required>
          <el-input v-model="createForm.city" placeholder="如：乌鲁木齐、宁波" @input="debouncedPreview" />
        </el-form-item>
        <el-form-item label="线号" required>
          <el-input v-model="createForm.line_no" placeholder="如：1、4、12" @input="debouncedPreview" />
        </el-form-item>
        <el-form-item label="线路全称">
          <el-input
            v-model="createForm.line_name"
            placeholder="自动生成，可按运营名称修改"
            @input="debouncedPreview"
          />
        </el-form-item>
        <el-form-item label="城市简称" :required="preview.needs_abbr">
          <el-input
            v-model="createForm.operator_abbr"
            :placeholder="preview.needs_abbr ? '必填，如 WLMQ' : '已自动识别，可修改'"
            @input="debouncedPreview"
          />
          <p v-if="preview.abbr_hint" class="field-hint warn">{{ preview.abbr_hint }}</p>
        </el-form-item>
      </el-form>
      <div v-if="preview.line_name" class="preview-box">
        <div class="preview-title">将创建线路档案</div>
        <p>{{ preview.line_name }}（{{ preview.city }}）</p>
      </div>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!canSubmitCreate" @click="submitCreate">
          确认开通
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑 -->
    <el-dialog v-model="editVisible" title="编辑线路" width="480px" @closed="resetEditForm">
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="线路名称" required>
          <el-input v-model="editForm.line_name" placeholder="如：郑州地铁4号线" />
        </el-form-item>
        <el-form-item label="城市" required>
          <el-input v-model="editForm.city" placeholder="如：郑州" />
        </el-form-item>
        <el-form-item label="内部编码">
          <div class="readonly-codes">
            <div>弓网：{{ editForm.monitor_code }}</div>
            <div>磨耗/温湿度：{{ editForm.strip_code }}</div>
          </div>
          <p class="field-hint">编码开通后不可改，避免与已入库数据不一致</p>
        </el-form-item>
        <el-form-item label="燃弧强度阈值">
          <el-input-number
            v-model="editForm.arc_intensity_threshold_a2s"
            :min="0"
            :step="10000"
            style="width: 100%"
          />
          <p class="field-hint">A²·s，留空则使用系统默认（20万）</p>
        </el-form-item>
        <el-form-item label="每弓滑板数">
          <el-select v-model="editForm.strips_per_bow" style="width: 100%">
            <el-option :value="2" label="2 板（双弓共 4 块）" />
            <el-option :value="3" label="3 板（双弓共 6 块）" />
            <el-option :value="4" label="4 板（双弓共 8 块）" />
          </el-select>
          <p class="field-hint">一组车两受电弓；仅影响碳滑板导入列与偏磨计算，改后请按新模板导入</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 弓网浏览器上传导入 -->
    <el-dialog
      v-model="importVisible"
      :title="importRunning ? '正在导入弓网数据' : '弓网数据导入'"
      width="620px"
      :close-on-click-modal="!importRunning || importDone"
      :show-close="true"
      @closed="resetImport"
    >
      <template v-if="!importRunning && !importDone">
        <p class="import-line-name">{{ importForm.line_name }}（{{ importForm.monitor_code }}）</p>
        <p class="import-tip">
          选择本机前处理结果文件夹，上传其中的 <span class="mono">YYYYMMDD/结果_*.xlsx</span> 并增量入库（已入库批次自动跳过）。
        </p>

        <input
          ref="folderInputRef"
          type="file"
          webkitdirectory
          directory
          multiple
          class="hidden-input"
          @change="onLocalFolderSelected"
        />

        <div class="folder-row">
          <el-button type="primary" @click="pickLocalFolder">选择本机文件夹</el-button>
          <el-button @click="downloadTemplate">下载模板</el-button>
          <el-button v-if="selectedFiles.length" @click="clearLocalFiles">清空</el-button>
        </div>

        <p v-if="selectedFiles.length" class="import-scan">
          已选择 <strong>{{ selectedFiles.length }}</strong> 个 Excel，将上传到服务器后导入。
          <span v-if="folderScan.recent_dates?.length">最近日期：{{ folderScan.recent_dates.join('、') }}</span>
        </p>
        <p v-else class="import-scan muted">尚未选择文件夹。</p>

        <p v-if="folderSamplePaths.length" class="import-samples muted">
          示例：{{ folderSamplePaths.join(' · ') }}
        </p>

        <div class="import-options-row">
          <el-checkbox v-model="importForm.run_snapshot">
            后台预计算快照（可选，不勾选也可立即看数据）
          </el-checkbox>
        </div>
        <p class="import-hint-muted">入库完成后即可查看分析页面；快照在后台计算，不影响浏览。</p>
      </template>

      <template v-else>
        <el-progress
          v-if="uploadPhase"
          :percentage="uploadPct"
          :status="uploadPct >= 100 ? 'success' : undefined"
        />
        <p v-if="uploadPhase" class="import-stat">
          正在上传：{{ uploadDoneCount }} / {{ uploadTotalCount }}
        </p>
        <el-progress
          v-if="!uploadPhase"
          :percentage="importJob.progress_pct || 0"
          :status="importProgressStatus"
        />
        <p v-if="!uploadPhase" class="import-stat">
          入库：{{ importJob.done_files || 0 }} / {{ importJob.total_files || 0 }}
          · 新增 {{ importJob.imported_count || 0 }} · 跳过 {{ importJob.skipped_count || 0 }}
        </p>
        <p v-if="importJob.current_file && !uploadPhase" class="import-current">当前：{{ importJob.current_file }}</p>
        <pre v-if="importJob.log_tail && !uploadPhase" class="import-log">{{ importJob.log_tail }}</pre>
        <p v-if="importDone && importJob.status === 'completed'" class="import-done-tip">
          数据已入库，可立即关闭窗口并前往弓网分析页面查看。
          <span v-if="importForm.run_snapshot">快照正在后台计算，不影响浏览。</span>
        </p>
        <p v-if="importJob.error_message" class="field-hint warn">{{ importJob.error_message }}</p>
      </template>

      <template #footer>
        <el-button v-if="importRunning && !importDone" @click="closeImportWhileRunning">后台继续</el-button>
        <el-button v-if="!importRunning" @click="importVisible = false">{{ importDone ? '关闭' : '取消' }}</el-button>
        <el-button
          v-if="!importRunning && !importDone"
          type="primary"
          :disabled="!selectedFiles.length"
          @click="startUploadImport"
        >
          上传并导入
        </el-button>
        <el-button v-if="importDone" type="primary" @click="finishImport">完成</el-button>
      </template>
    </el-dialog>

    <!-- 弓网数据管理 -->
    <el-dialog
      v-model="manageVisible"
      :title="`弓网数据管理 · ${manageForm.line_name}`"
      width="920px"
      @closed="resetManage"
    >
      <div class="manage-summary" v-if="manageSummary.total_batches">
        共 <strong>{{ manageSummary.total_batches }}</strong> 个批次，
        <strong>{{ manageSummary.total_dates }}</strong> 个检测日
        <span v-if="manageSummary.min_date">（{{ manageSummary.min_date }} ~ {{ manageSummary.max_date }}）</span>
      </div>
      <div class="manage-summary muted" v-else>暂无弓网检测批次</div>

      <div class="manage-toolbar">
        <el-select v-model="manageFilter.direction" clearable placeholder="行别" style="width: 100px">
          <el-option label="上行" value="上行" />
          <el-option label="下行" value="下行" />
        </el-select>
        <el-date-picker
          v-model="manageFilter.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 260px"
        />
        <el-input
          v-model="manageFilter.keyword"
          clearable
          placeholder="批次号 / 文件名"
          style="width: 200px"
          @keyup.enter="searchManageBatches"
        />
        <el-button type="primary" :loading="manageLoading" @click="searchManageBatches">查询</el-button>
      </div>

      <el-table
        ref="manageTableRef"
        v-loading="manageLoading"
        :data="manageItems"
        size="small"
        stripe
        max-height="420"
        empty-text="暂无批次"
        @selection-change="onManageSelectionChange"
      >
        <el-table-column type="selection" width="42" />
        <el-table-column prop="inspect_date" label="检测日" width="108" />
        <el-table-column prop="direction" label="行别" width="64" />
        <el-table-column prop="group_no" label="组号" width="56" align="center" />
        <el-table-column prop="batch_code" label="批次号" min-width="160" show-overflow-tooltip />
        <el-table-column prop="file_name" label="来源文件" min-width="140" show-overflow-tooltip />
        <el-table-column prop="monitoring_row_count" label="测点数" width="72" align="right" />
        <el-table-column prop="imported_at" label="入库时间" width="150" />
      </el-table>

      <div class="manage-footer-row">
        <span class="manage-selected muted">
          已选 {{ manageSelected.length }} 项
        </span>
        <el-pagination
          v-model:current-page="managePage"
          v-model:page-size="managePageSize"
          :total="manageTotal"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          small
          @current-change="loadManageBatches"
          @size-change="onManagePageSizeChange"
        />
      </div>

      <template #footer>
        <el-button @click="manageVisible = false">关闭</el-button>
        <el-button
          type="danger"
          :disabled="!manageSelected.length"
          :loading="manageDeleting"
          @click="deleteSelectedBatches"
        >
          删除所选（{{ manageSelected.length }}）
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchLineRegistry,
  previewOpenLine,
  openLineSimple,
  updateLineRegistry,
  setLineRegistryActive,
  deleteLineRegistry,
  createMonitorStaging,
  uploadMonitorStagingFiles,
  runMonitorImport,
  fetchImportJob,
  fetchImportJobs,
  fetchMonitorBatches,
  deleteMonitorBatches,
  downloadMonitorImportTemplate,
} from '../api/client'

const UPLOAD_BATCH_SIZE = 25

function filterMonitorExcelFiles(fileList) {
  return Array.from(fileList || []).filter((f) => {
    const name = f.name || ''
    return name.toLowerCase().endsWith('.xlsx') && !name.startsWith('~$')
  })
}

function scanLocalMonitorFiles(files) {
  const dates = new Set()
  for (const f of files) {
    const path = f.webkitRelativePath || f.name
    const match = path.match(/20\d{6}/)
    if (match) {
      const d = match[0]
      dates.add(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`)
    }
  }
  return {
    exists: true,
    total_files: files.length,
    recent_dates: [...dates].sort().slice(-8),
  }
}

function emptyCreateForm() {
  return { city: '', line_no: '', line_name: '', operator_abbr: '' }
}

function emptyPreview() {
  return { needs_abbr: false, abbr_hint: '', line_name: '', city: '', monitor_code: '', strip_code: '' }
}

export default {
  name: 'LineManagementPage',
  setup() {
    const loading = ref(false)
    const saving = ref(false)
    const lines = ref([])
    const keyword = ref('')
    const statusFilter = ref('all')
    const createVisible = ref(false)
    const editVisible = ref(false)
    const createForm = ref(emptyCreateForm())
    const editForm = ref({
      registry_id: null,
      city: '',
      line_name: '',
      monitor_code: '',
      strip_code: '',
      arc_intensity_threshold_a2s: null,
      strips_per_bow: 2,
    })
    const preview = ref(emptyPreview())
    const importVisible = ref(false)
    const importRunning = ref(false)
    const importDone = ref(false)
    const folderInputRef = ref(null)
    const selectedFiles = ref([])
    const uploadPhase = ref(false)
    const uploadPct = ref(0)
    const uploadDoneCount = ref(0)
    const uploadTotalCount = ref(0)
    const importForm = ref({
      registry_id: null,
      line_name: '',
      monitor_code: '',
      run_snapshot: false,
    })
    const folderScan = ref({
      exists: false,
      total_files: 0,
      recent_dates: [],
    })
    const importJob = ref({})
    const manageVisible = ref(false)
    const manageLoading = ref(false)
    const manageDeleting = ref(false)
    const manageTableRef = ref(null)
    const manageForm = ref({
      registry_id: null,
      line_name: '',
      monitor_code: '',
    })
    const manageFilter = ref({
      direction: '',
      dateRange: null,
      keyword: '',
    })
    const manageItems = ref([])
    const manageSelected = ref([])
    const manageSummary = ref({
      total_batches: 0,
      total_dates: 0,
      min_date: null,
      max_date: null,
    })
    const managePage = ref(1)
    const managePageSize = ref(50)
    const manageTotal = ref(0)
    const maintainVisible = ref(false)
    const maintainRow = ref(null)
    const recentJobs = ref([])
    const jobsLoading = ref(false)
    let pollTimer = null
    let previewTimer = null

    const importProgressStatus = computed(() => {
      if (importJob.value.status === 'failed') return 'exception'
      if (importJob.value.status === 'completed') return 'success'
      return undefined
    })

    const folderSamplePaths = computed(() => {
      return selectedFiles.value
        .slice(0, 3)
        .map((f) => f.webkitRelativePath || f.name)
    })

    const canSubmitCreate = computed(() => {
      if (!createForm.value.city.trim() || !createForm.value.line_no.trim()) return false
      if (preview.value.needs_abbr && !createForm.value.operator_abbr.trim()) return false
      return Boolean(preview.value.monitor_code)
    })

    const filteredLines = computed(() => {
      let list = lines.value || []
      const kw = keyword.value.trim().toLowerCase()
      if (kw) {
        list = list.filter(
          (r) =>
            String(r.line_name || '').toLowerCase().includes(kw) ||
            String(r.city || '').toLowerCase().includes(kw),
        )
      }
      if (statusFilter.value === 'active') list = list.filter((r) => r.is_active)
      if (statusFilter.value === 'inactive') list = list.filter((r) => !r.is_active)
      return list
    })

    async function loadAll() {
      loading.value = true
      try {
        lines.value = await fetchLineRegistry(true)
        if (maintainRow.value?.registry_id) {
          const next = lines.value.find((r) => r.registry_id === maintainRow.value.registry_id)
          if (next) maintainRow.value = next
        }
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || e.message || '加载失败')
      } finally {
        loading.value = false
      }
    }

    function jobStatusLabel(s) {
      return ({ pending: '排队', running: '进行中', completed: '完成', failed: '失败' })[s] || s || '—'
    }
    function jobTag(s) {
      return ({ completed: 'success', failed: 'danger', running: 'warning', pending: 'info' })[s] || 'info'
    }

    async function loadRecentJobs(row) {
      jobsLoading.value = true
      try {
        const data = await fetchImportJobs({
          line_code: row?.monitor_code || undefined,
          limit: 8,
        })
        recentJobs.value = data.jobs || []
      } catch {
        recentJobs.value = []
      } finally {
        jobsLoading.value = false
      }
    }

    async function openMaintain(row) {
      maintainRow.value = row
      maintainVisible.value = true
      await loadRecentJobs(row)
    }

    async function runPreview() {
      if (!createForm.value.city.trim() || !createForm.value.line_no.trim()) {
        preview.value = emptyPreview()
        return
      }
      try {
        const data = await previewOpenLine({ ...createForm.value })
        preview.value = data
        if (data.line_name && !createForm.value.line_name) createForm.value.line_name = data.line_name
        if (data.operator_abbr && !createForm.value.operator_abbr) {
          createForm.value.operator_abbr = data.operator_abbr
        }
      } catch {
        preview.value = emptyPreview()
      }
    }

    function debouncedPreview() {
      clearTimeout(previewTimer)
      previewTimer = setTimeout(runPreview, 300)
    }

    function openCreate() {
      resetCreateForm()
      createVisible.value = true
    }

    function resetCreateForm() {
      createForm.value = emptyCreateForm()
      preview.value = emptyPreview()
    }

    async function submitCreate() {
      if (!canSubmitCreate.value) return
      saving.value = true
      try {
        await openLineSimple({ ...createForm.value })
        ElMessage.success('已开通，请前往用户管理分配业主')
        createVisible.value = false
        await loadAll()
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || e.message || '开通失败')
      } finally {
        saving.value = false
      }
    }

    function openEdit(row) {
      editForm.value = {
        registry_id: row.registry_id,
        city: row.city,
        line_name: row.line_name,
        monitor_code: row.monitor_code,
        strip_code: row.strip_code,
        arc_intensity_threshold_a2s: row.arc_intensity_threshold_a2s ?? null,
        strips_per_bow: Number(row.strips_per_bow) || 2,
      }
      editVisible.value = true
    }

    function resetEditForm() {
      editForm.value = {
        registry_id: null,
        city: '',
        line_name: '',
        monitor_code: '',
        strip_code: '',
        arc_intensity_threshold_a2s: null,
        strips_per_bow: 2,
      }
    }

    async function submitEdit() {
      if (!editForm.value.registry_id) return
      if (!editForm.value.city.trim() || !editForm.value.line_name.trim()) {
        ElMessage.warning('请填写城市与线路名称')
        return
      }
      saving.value = true
      try {
        const payload = {
          city: editForm.value.city.trim(),
          line_name: editForm.value.line_name.trim(),
          strips_per_bow: Number(editForm.value.strips_per_bow) || 2,
        }
        if (editForm.value.arc_intensity_threshold_a2s != null && editForm.value.arc_intensity_threshold_a2s !== '') {
          payload.arc_intensity_threshold_a2s = Number(editForm.value.arc_intensity_threshold_a2s)
        }
        await updateLineRegistry(editForm.value.registry_id, payload)
        ElMessage.success('已保存')
        editVisible.value = false
        await loadAll()
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || e.message || '保存失败')
      } finally {
        saving.value = false
      }
    }

    async function toggleActive(row, active) {
      const action = active ? '启用' : '停用'
      try {
        if (!active) {
          await ElMessageBox.confirm(
            `确定停用「${row.line_name}」？停用后不会出现在用户授权与业主导入列表中，已有数据保留。`,
            `${action}线路`,
            { type: 'warning' },
          )
        }
        await setLineRegistryActive(row.registry_id, active)
        ElMessage.success(`已${action}`)
        await loadAll()
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') {
          ElMessage.error(e?.response?.data?.detail || e.message || `${action}失败`)
        }
      }
    }

    async function removeLine(row) {
      if (!row.can_delete) {
        ElMessage.warning('该线路仍有数据或用户授权，无法删除')
        return
      }
      try {
        await ElMessageBox.confirm(
          `确定删除「${row.line_name}」？此操作不可恢复，仅适用于误开通且无任何数据的线路。`,
          '删除线路',
          { type: 'error', confirmButtonClass: 'el-button--danger' },
        )
        await deleteLineRegistry(row.registry_id)
        ElMessage.success('已删除')
        await loadAll()
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') {
          ElMessage.error(e?.response?.data?.detail || e.message || '删除失败')
        }
      }
    }

    function pickLocalFolder() {
      folderInputRef.value?.click()
    }

    async function downloadTemplate() {
      try {
        await downloadMonitorImportTemplate()
      } catch (e) {
        ElMessage.error(e?.message || '模板下载失败')
      }
    }

    function onLocalFolderSelected(event) {
      const files = filterMonitorExcelFiles(event.target.files)
      if (!files.length) {
        ElMessage.warning('所选文件夹中未发现 Excel 文件（.xlsx）')
        event.target.value = ''
        return
      }
      selectedFiles.value = files
      folderScan.value = scanLocalMonitorFiles(files)
      event.target.value = ''
    }

    function clearLocalFiles() {
      selectedFiles.value = []
      folderScan.value = { exists: false, total_files: 0, recent_dates: [] }
    }

    async function openImport(row) {
      importForm.value = {
        registry_id: row.registry_id,
        line_name: row.line_name,
        monitor_code: row.monitor_code,
        run_snapshot: false,
      }
      selectedFiles.value = []
      folderScan.value = { exists: false, total_files: 0, recent_dates: [] }
      importJob.value = {}
      importRunning.value = false
      importDone.value = false
      uploadPhase.value = false
      uploadPct.value = 0
      uploadDoneCount.value = 0
      uploadTotalCount.value = 0
      importVisible.value = true
    }

    function resetImport() {
      clearInterval(pollTimer)
      pollTimer = null
      importRunning.value = false
      importDone.value = false
      uploadPhase.value = false
      uploadPct.value = 0
      uploadDoneCount.value = 0
      uploadTotalCount.value = 0
      importJob.value = {}
      selectedFiles.value = []
    }

    async function pollJob(jobId) {
      try {
        const data = await fetchImportJob(jobId)
        importJob.value = data.job || {}
        if (['completed', 'failed'].includes(importJob.value.status)) {
          importRunning.value = false
          importDone.value = true
          clearInterval(pollTimer)
          pollTimer = null
          if (importJob.value.status === 'completed') {
            ElMessage.success('弓网数据已入库，可立即查看分析页面')
            await loadAll()
            if (maintainVisible.value) await loadRecentJobs(maintainRow.value)
          } else {
            ElMessage.error(importJob.value.error_message || '导入失败')
          }
        }
      } catch (e) {
        importRunning.value = false
        importDone.value = true
        clearInterval(pollTimer)
        ElMessage.error(e?.response?.data?.detail || e.message || '获取进度失败')
      }
    }

    async function startUploadImport() {
      if (!selectedFiles.value.length) return
      importRunning.value = true
      importDone.value = false
      uploadPhase.value = true
      uploadPct.value = 0
      uploadDoneCount.value = 0
      uploadTotalCount.value = selectedFiles.value.length
      importJob.value = {}

      try {
        const staging = await createMonitorStaging({
          registry_id: importForm.value.registry_id,
          monitor_code: importForm.value.monitor_code,
        })
        const stagingId = staging.staging_id
        const files = selectedFiles.value
        let uploaded = 0

        for (let i = 0; i < files.length; i += UPLOAD_BATCH_SIZE) {
          const batch = files.slice(i, i + UPLOAD_BATCH_SIZE)
          await uploadMonitorStagingFiles(stagingId, batch)
          uploaded += batch.length
          uploadDoneCount.value = uploaded
          uploadPct.value = Math.min(99, Math.round((uploaded * 100) / files.length))
        }
        uploadPct.value = 100

        uploadPhase.value = false
        const res = await runMonitorImport({
          registry_id: importForm.value.registry_id,
          monitor_code: importForm.value.monitor_code,
          staging_id: stagingId,
          run_snapshot: importForm.value.run_snapshot,
        })
        const jobId = res.job_id
        await pollJob(jobId)
        pollTimer = setInterval(() => pollJob(jobId), 1500)
      } catch (e) {
        importRunning.value = false
        uploadPhase.value = false
        ElMessage.error(e?.response?.data?.detail || e.message || '上传或导入失败')
      }
    }

    function closeImportWhileRunning() {
      clearInterval(pollTimer)
      pollTimer = null
      importVisible.value = false
      ElMessage.info('导入仍在服务器后台进行，完成后请刷新线路管理查看状态')
    }

    function resetManage() {
      manageItems.value = []
      manageSelected.value = []
      manageSummary.value = { total_batches: 0, total_dates: 0, min_date: null, max_date: null }
      managePage.value = 1
      manageFilter.value = { direction: '', dateRange: null, keyword: '' }
    }

    function onManageSelectionChange(rows) {
      manageSelected.value = rows || []
    }

    function onManagePageSizeChange() {
      managePage.value = 1
      loadManageBatches()
    }

    async function loadManageBatches() {
      if (!manageForm.value.registry_id) return
      manageLoading.value = true
      try {
        const [dateFrom, dateTo] = manageFilter.value.dateRange || []
        const data = await fetchMonitorBatches(manageForm.value.registry_id, {
          direction: manageFilter.value.direction || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          keyword: manageFilter.value.keyword.trim() || undefined,
          page: managePage.value,
          page_size: managePageSize.value,
        })
        manageItems.value = data.items || []
        manageTotal.value = data.total || 0
        manageSummary.value = data.summary || manageSummary.value
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || e.message || '加载批次失败')
      } finally {
        manageLoading.value = false
      }
    }

    async function searchManageBatches() {
      managePage.value = 1
      await loadManageBatches()
    }

    async function openManage(row) {
      manageForm.value = {
        registry_id: row.registry_id,
        line_name: row.line_name,
        monitor_code: row.monitor_code,
      }
      resetManage()
      manageVisible.value = true
      await loadManageBatches()
    }

    async function deleteSelectedBatches() {
      if (!manageSelected.value.length) return
      const count = manageSelected.value.length
      const sample = manageSelected.value
        .slice(0, 3)
        .map((r) => `${r.inspect_date} ${r.direction} ${r.batch_code}`)
        .join('\n')
      const more = count > 3 ? `\n…等共 ${count} 个批次` : ''
      try {
        await ElMessageBox.confirm(
          `确定删除以下弓网检测批次？关联测点与燃弧汇总将一并删除，且不可恢复。\n\n${sample}${more}`,
          '批量删除弓网数据',
          { type: 'warning', confirmButtonClass: 'el-button--danger' },
        )
      } catch {
        return
      }

      manageDeleting.value = true
      try {
        const batchIds = manageSelected.value.map((r) => r.batch_id)
        const result = await deleteMonitorBatches(manageForm.value.registry_id, batchIds)
        ElMessage.success(`已删除 ${result.deleted || count} 个批次`)
        manageTableRef.value?.clearSelection?.()
        manageSelected.value = []
        await loadManageBatches()
        await loadAll()
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || e.message || '删除失败')
      } finally {
        manageDeleting.value = false
      }
    }

    function finishImport() {
      importVisible.value = false
    }

    onMounted(loadAll)

    return {
      loading,
      saving,
      lines,
      keyword,
      statusFilter,
      filteredLines,
      createVisible,
      editVisible,
      createForm,
      editForm,
      preview,
      canSubmitCreate,
      importVisible,
      importRunning,
      importDone,
      folderInputRef,
      selectedFiles,
      uploadPhase,
      uploadPct,
      uploadDoneCount,
      uploadTotalCount,
      folderSamplePaths,
      importForm,
      folderScan,
      importJob,
      importProgressStatus,
      manageVisible,
      manageLoading,
      manageDeleting,
      manageTableRef,
      manageForm,
      manageFilter,
      manageItems,
      manageSelected,
      manageSummary,
      managePage,
      managePageSize,
      manageTotal,
      maintainVisible,
      maintainRow,
      recentJobs,
      jobsLoading,
      loadAll,
      debouncedPreview,
      openCreate,
      resetCreateForm,
      submitCreate,
      openEdit,
      openMaintain,
      jobStatusLabel,
      jobTag,
      resetEditForm,
      submitEdit,
      toggleActive,
      removeLine,
      openImport,
      pickLocalFolder,
      downloadTemplate,
      onLocalFolderSelected,
      clearLocalFiles,
      resetImport,
      startUploadImport,
      finishImport,
      closeImportWhileRunning,
      openManage,
      searchManageBatches,
      loadManageBatches,
      onManageSelectionChange,
      onManagePageSizeChange,
      deleteSelectedBatches,
      resetManage,
    }
  },
}
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.page-title { margin: 0 0 6px; font-size: 20px; }
.page-sub {
  margin: 0;
  font-size: 13px;
  color: var(--om-text-muted, #64748b);
  line-height: 1.6;
  max-width: 680px;
}
.om-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 16px;
}
.expand-codes { padding: 8px 12px; font-size: 12px; color: #64748b; line-height: 1.6; }
.maintain-body { display: flex; flex-direction: column; gap: 14px; }
.maintain-status {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.status-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #64748b;
}
.status-item b { color: #0f172a; font-weight: 650; }
.maintain-hint { margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.55; }
.maintain-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.job-title { margin: 8px 0 0; font-size: 14px; color: #0f172a; }
.job-err { color: #b91c1c; }
.expand-codes .muted { color: #94a3b8; margin: 4px 0 0; }
.expand-codes .mono { font-family: ui-monospace, monospace; word-break: break-all; }
.field-hint { margin: 4px 0 0; font-size: 12px; color: #888; }
.field-hint.warn { color: var(--el-color-warning); }
.preview-box {
  margin-left: 112px;
  padding: 10px 12px;
  background: #f5f7fa;
  border-radius: 8px;
  font-size: 13px;
}
.preview-title { font-weight: 600; margin-bottom: 4px; }
.readonly-codes {
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
  font-family: ui-monospace, monospace;
}
.import-line-name { margin: 0 0 8px; font-weight: 600; }
.import-tip { margin: 0 0 14px; font-size: 13px; color: #64748b; line-height: 1.6; }
.import-tip .mono { font-family: ui-monospace, monospace; font-size: 12px; }
.folder-row { display: flex; gap: 10px; margin-bottom: 8px; }
.hidden-input { display: none; }
.import-samples { margin: 0 0 12px; font-size: 12px; line-height: 1.5; word-break: break-all; }
.import-path-box {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.import-path-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
.import-path-value {
  font-size: 13px;
  font-family: ui-monospace, monospace;
  word-break: break-all;
  line-height: 1.5;
}
.import-scan { margin: 0 0 12px; font-size: 13px; color: #475569; line-height: 1.6; }
.import-scan.muted { color: #94a3b8; }
.import-options-row { margin-top: 4px; }
.import-hint-muted { margin: 8px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5; }
.import-done-tip { margin: 12px 0 0; font-size: 13px; color: #059669; line-height: 1.6; }
.manage-summary { margin-bottom: 12px; font-size: 13px; color: #475569; line-height: 1.6; }
.manage-summary.muted { color: #94a3b8; }
.manage-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.manage-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}
.manage-selected { font-size: 12px; white-space: nowrap; }
.import-stat { margin: 12px 0 4px; font-size: 13px; color: #64748b; }
.import-current { margin: 0; font-size: 12px; color: #475569; }
.import-log {
  margin-top: 12px;
  max-height: 180px;
  overflow: auto;
  padding: 10px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
}
</style>
