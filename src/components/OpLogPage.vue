<template>
  <div class="page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2 class="page-title">操作日志</h2>
        <p class="page-sub">记录关键管理操作，如用户创建/删除/密码重置等</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="toolbar om-panel">
      <el-select v-model="filters.op_type" placeholder="全部操作" clearable style="width: 160px" @change="onFilter">
        <el-option
          v-for="t in opTypeOptions"
          :key="t.value"
          :label="t.label"
          :value="t.value"
        />
      </el-select>
      <el-input
        v-model="filters.operator"
        placeholder="操作人"
        clearable
        style="width: 140px"
        @change="onFilter"
      />
      <el-date-picker
        v-model="filters.date_from"
        type="date"
        placeholder="开始日期"
        value-format="YYYY-MM-DD"
        style="width: 140px"
        @change="onFilter"
      />
      <el-date-picker
        v-model="filters.date_to"
        type="date"
        placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 140px"
        @change="onFilter"
      />
    </div>

    <div class="om-panel">
      <el-table :data="items" size="small" stripe>
        <el-table-column prop="log_id" label="ID" min-width="72" />
        <el-table-column label="操作类型" min-width="160">
          <template #default="{ row }">
            <el-tag size="small" :type="opTagType(row.op_type)">
              {{ opLabel(row.op_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="280" />
        <el-table-column prop="operator" label="操作人" min-width="120" />
        <el-table-column prop="created_at" label="时间" min-width="172" />
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="load"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onActivated } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchOpLogs } from '../api/client'

const OP_TYPES = [
  { value: 'create_user',           label: '创建用户',   type: 'success' },
  { value: 'delete_user',           label: '删除用户',   type: 'danger' },
  { value: 'reset_password',        label: '重置密码',   type: 'warning' },
  { value: 'enable_user',           label: '启用用户',   type: 'success' },
  { value: 'disable_user',          label: '停用用户',   type: 'info' },
  { value: 'bulk_enable_user',      label: '批量启用',   type: 'success' },
  { value: 'bulk_disable_user',     label: '批量停用',   type: 'info' },
]

export default {
  name: 'OpLogPage',
  setup() {
    const loading = ref(false)
    const items = ref([])
    const total = ref(0)
    const page = ref(1)
    const pageSize = 50
    const filters = ref({ op_type: '', operator: '', date_from: '', date_to: '' })

    const opTypeOptions = OP_TYPES

    function opLabel(t) {
      return OP_TYPES.find((x) => x.value === t)?.label || t
    }
    function opTagType(t) {
      return OP_TYPES.find((x) => x.value === t)?.type || ''
    }

    async function load() {
      loading.value = true
      try {
        const res = await fetchOpLogs({
          page: page.value,
          page_size: pageSize,
          op_type: filters.value.op_type,
          operator: filters.value.operator,
          date_from: filters.value.date_from,
          date_to: filters.value.date_to,
        })
        items.value = res.items || []
        total.value = res.total || 0
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || '加载失败')
      } finally {
        loading.value = false
      }
    }

    function onFilter() {
      page.value = 1
      load()
    }

    onMounted(load)
    onActivated(load)

    return {
      loading, items, total, page, pageSize, filters, opTypeOptions,
      opLabel, opTagType, load, onFilter,
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
.page-title { margin: 0 0 4px; font-size: 1.35rem; font-weight: 700; color: var(--om-text); }
.page-sub { margin: 0; font-size: 0.85rem; color: var(--om-text-muted); }
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 14px;
  margin-bottom: 10px;
}
.pagination { display: flex; justify-content: flex-end; }
</style>
