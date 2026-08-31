<template>
  <div class="page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2 class="page-title">用户管理</h2>
        <p class="page-sub">为业主账户分配已在「线路管理」中登记的系统线路</p>
      </div>
      <el-button type="primary" @click="openCreate">新建用户</el-button>
    </div>

    <!-- 搜索工具栏 -->
    <div class="toolbar om-panel">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索用户名 / 显示名 / 备注"
        clearable
        style="width: 240px"
        @input="onSearch"
      />
      <el-select v-model="filterRole" placeholder="全部角色" clearable style="width: 120px" @change="onSearch">
        <el-option label="管理员" value="admin" />
        <el-option label="业主" value="owner" />
      </el-select>
      <el-select v-model="filterActive" placeholder="全部状态" clearable style="width: 120px" @change="onSearch">
        <el-option label="启用" value="active" />
        <el-option label="停用" value="inactive" />
      </el-select>
      <div class="toolbar-right" v-if="selectedIds.length">
        <el-button size="small" @click="batchSetActive(true)">批量启用</el-button>
        <el-button size="small" type="warning" @click="batchSetActive(false)">批量停用</el-button>
        <span class="sel-hint">已选 {{ selectedIds.length }} 人</span>
      </div>
    </div>

    <div class="om-panel">
      <el-table
        :data="filteredUsers"
        size="small"
        stripe
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="40" />
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="display_name" label="显示名" min-width="130" />
        <el-table-column label="角色" min-width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.role === 'admin' ? 'danger' : 'info'">
              {{ row.role === 'admin' ? '管理员' : '业主' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="授权线路" min-width="200">
          <template #default="{ row }">
            <span v-if="row.role === 'admin'" class="dim">全部线路</span>
            <span v-else-if="row.line_codes?.length">{{ formatLines(row.line_codes) }}</span>
            <span v-else class="warn">未分配</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120">
          <template #default="{ row }">
            <span class="dim">{{ row.remark || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="72">
          <template #default="{ row }">
            <el-tag size="small" :type="row.is_active ? 'success' : 'info'">
              {{ row.is_active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近登录" min-width="148">
          <template #default="{ row }">
            <span class="dim">{{ row.last_login_at || '从未登录' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="warning" @click="openResetPwd(row)">重置密码</el-button>
            <el-button link type="danger" @click="removeUser(row)" :disabled="row.username === 'admin'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新建 / 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="editing ? '编辑用户' : '新建用户'" width="540px">
      <el-form label-width="90px" style="padding-right: 12px">
        <el-form-item label="用户名" v-if="!editing">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="显示名">
          <el-input v-model="form.display_name" />
        </el-form-item>
        <el-form-item :label="editing ? '新密码' : '密码'">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            :placeholder="editing ? '留空则不修改' : '至少 6 位'"
          />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="管理员" value="admin" />
            <el-option label="业主" value="owner" />
          </el-select>
        </el-form-item>
        <el-form-item label="授权线路" v-if="form.role === 'owner'">
          <el-select v-model="form.line_codes" multiple filterable style="width: 100%">
            <el-option
              v-for="l in lineOptions"
              :key="l.line_code"
              :label="l.line_name"
              :value="l.line_code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="联系方式、所属单位等（选填）" maxlength="256" show-word-limit />
        </el-form-item>
        <el-form-item label="状态" v-if="editing">
          <el-switch v-model="form.is_active" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 独立重置密码对话框 -->
    <el-dialog v-model="resetPwdVisible" title="重置密码" width="400px">
      <el-form label-width="90px">
        <el-form-item label="新密码">
          <el-input v-model="resetPwdForm.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="强制改密">
          <el-switch v-model="resetPwdForm.must_change_password" active-text="下次登录须改密" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doResetPwd">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, computed, onMounted, onActivated } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchAuthUsers,
  fetchAuthLineOptions,
  createAuthUser,
  updateAuthUser,
  deleteAuthUser,
  bulkSetAuthUserActive,
} from '../api/client'
import { inferLineNameFromCode } from '../utils/lineDisplay'

export default {
  name: 'UserManagementPage',
  setup() {
    const loading = ref(false)
    const saving = ref(false)
    const users = ref([])
    const lineOptions = ref([])
    const dialogVisible = ref(false)
    const editing = ref(null)
    const form = ref(emptyForm())

    const searchKeyword = ref('')
    const filterRole = ref('')
    const filterActive = ref('')
    const selectedIds = ref([])

    const resetPwdVisible = ref(false)
    const resetPwdTarget = ref(null)
    const resetPwdForm = ref({ password: '', must_change_password: true })

    const filteredUsers = computed(() => {
      let list = users.value || []
      const kw = searchKeyword.value.trim().toLowerCase()
      if (kw) {
        list = list.filter(
          (u) =>
            u.username.toLowerCase().includes(kw) ||
            (u.display_name || '').toLowerCase().includes(kw) ||
            (u.remark || '').toLowerCase().includes(kw),
        )
      }
      if (filterRole.value) list = list.filter((u) => u.role === filterRole.value)
      if (filterActive.value === 'active') list = list.filter((u) => u.is_active)
      if (filterActive.value === 'inactive') list = list.filter((u) => !u.is_active)
      return list
    })

    function emptyForm() {
      return {
        username: '',
        display_name: '',
        password: '',
        role: 'owner',
        line_codes: [],
        is_active: true,
        remark: '',
      }
    }

    function formatLines(codes) {
      const map = Object.fromEntries(lineOptions.value.map((l) => [l.line_code, l.line_name]))
      return (codes || []).map((c) => map[c] || inferLineNameFromCode(c)).join('、')
    }

    function onSearch() {}
    function onSelectionChange(rows) {
      selectedIds.value = rows.map((r) => r.user_id)
    }

    async function refreshLineOptions() {
      lineOptions.value = await fetchAuthLineOptions()
    }

    async function load() {
      loading.value = true
      try {
        users.value = await fetchAuthUsers()
        await refreshLineOptions()
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || '加载失败')
      } finally {
        loading.value = false
      }
    }

    async function openCreate() {
      editing.value = null
      form.value = emptyForm()
      try { await refreshLineOptions() } catch {}
      dialogVisible.value = true
    }

    async function openEdit(row) {
      editing.value = row
      form.value = {
        username: row.username,
        display_name: row.display_name,
        password: '',
        role: row.role,
        line_codes: [...(row.line_codes || [])],
        is_active: row.is_active,
        remark: row.remark || '',
      }
      try { await refreshLineOptions() } catch {}
      dialogVisible.value = true
    }

    async function save() {
      saving.value = true
      try {
        if (editing.value) {
          const payload = {
            display_name: form.value.display_name,
            role: form.value.role,
            is_active: form.value.is_active,
            line_codes: form.value.role === 'owner' ? form.value.line_codes : [],
            remark: form.value.remark,
          }
          if (form.value.password) payload.password = form.value.password
          await updateAuthUser(editing.value.user_id, payload)
        } else {
          await createAuthUser({
            username: form.value.username,
            password: form.value.password,
            display_name: form.value.display_name || form.value.username,
            role: form.value.role,
            line_codes: form.value.role === 'owner' ? form.value.line_codes : [],
            remark: form.value.remark,
          })
        }
        ElMessage.success('已保存')
        dialogVisible.value = false
        await load()
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || '保存失败')
      } finally {
        saving.value = false
      }
    }

    function openResetPwd(row) {
      resetPwdTarget.value = row
      resetPwdForm.value = { password: '', must_change_password: true }
      resetPwdVisible.value = true
    }

    async function doResetPwd() {
      if (!resetPwdForm.value.password || resetPwdForm.value.password.length < 6) {
        ElMessage.warning('新密码至少 6 位')
        return
      }
      saving.value = true
      try {
        await updateAuthUser(resetPwdTarget.value.user_id, {
          password: resetPwdForm.value.password,
          must_change_password: resetPwdForm.value.must_change_password,
        })
        ElMessage.success('密码已重置')
        resetPwdVisible.value = false
        await load()
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || '重置失败')
      } finally {
        saving.value = false
      }
    }

    async function batchSetActive(isActive) {
      if (!selectedIds.value.length) return
      const label = isActive ? '启用' : '停用'
      try {
        await ElMessageBox.confirm(
          `确定要${label}选中的 ${selectedIds.value.length} 个用户吗？`,
          '确认',
          { type: 'warning' },
        )
        await bulkSetAuthUserActive(selectedIds.value, isActive)
        ElMessage.success(`已${label} ${selectedIds.value.length} 个用户`)
        selectedIds.value = []
        await load()
      } catch (e) {
        if (e !== 'cancel') ElMessage.error(e?.response?.data?.detail || '操作失败')
      }
    }

    async function removeUser(row) {
      try {
        await ElMessageBox.confirm(`确定删除用户「${row.username}」？`, '确认', { type: 'warning' })
        await deleteAuthUser(row.user_id)
        ElMessage.success('已删除')
        await load()
      } catch (e) {
        if (e !== 'cancel') ElMessage.error(e?.response?.data?.detail || '删除失败')
      }
    }

    onMounted(load)
    onActivated(load)

    return {
      loading, saving, users, lineOptions, dialogVisible, editing, form,
      searchKeyword, filterRole, filterActive, filteredUsers, selectedIds,
      resetPwdVisible, resetPwdTarget, resetPwdForm,
      formatLines, onSearch, onSelectionChange,
      openCreate, openEdit, save, removeUser,
      openResetPwd, doResetPwd, batchSetActive,
    }
  },
}
</script>

<style scoped>
.page { padding: 8px 4px 28px; }
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.page-title { margin: 0 0 4px; font-size: 1.35rem; font-weight: 700; color: #0f172a; }
.page-sub { margin: 0; font-size: 0.85rem; color: #64748b; }
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 14px;
  margin-bottom: 10px;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.sel-hint { font-size: 13px; color: #64748b; }
.dim { color: #64748b; }
.warn { color: #b45309; }
</style>
