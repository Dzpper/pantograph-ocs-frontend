<template>
  <div class="page" v-loading="loading">
    <div class="page-head">
      <div>
        <h2 class="page-title">管理工作台</h2>
        <p class="page-sub">
          按顺序完成线路开通与弓网入库、业主授权；各线三域数据状态请在「线路管理」查看与维护。
        </p>
      </div>
      <el-button @click="load">刷新</el-button>
    </div>

    <!-- 引导步骤 -->
    <div class="steps om-panel">
      <div class="step" :class="{ done: stats.lineCount > 0 && stats.noMonitor === 0 }">
        <div class="step-no">1</div>
        <div class="step-body">
          <div class="step-title">线路管理与弓网入库</div>
          <div class="step-desc">开通线路、浏览器上传前处理结果并导入弓网，查看三域数据状态</div>
          <el-button type="primary" link @click="go('sys-lines')">前往线路管理 →</el-button>
        </div>
      </div>
      <div class="step" :class="{ done: stats.ownerCount > 0 }">
        <div class="step-no">2</div>
        <div class="step-body">
          <div class="step-title">创建业主并授权</div>
          <div class="step-desc">业主只能导入、查看已授权线路的磨耗与温湿度</div>
          <el-button type="primary" link @click="go('sys-user')">前往用户管理 →</el-button>
        </div>
      </div>
      <div class="step" :class="{ done: stats.lineCount > 0 && stats.ownerCount > 0 }">
        <div class="step-no">3</div>
        <div class="step-body">
          <div class="step-title">查看分析与汇报</div>
          <div class="step-desc">在各分析模块查阅弓网状态，生成检测报告并导出</div>
          <div class="step-links">
            <el-button type="primary" link @click="goCenter('strip-wear', 'strip-dashboard')">碳滑板磨耗 →</el-button>
            <el-button type="primary" link @click="goCenter('analysis', 'alarm-network')">综合分析 →</el-button>
            <el-button type="primary" link @click="goCenter('focus-report', 'inspection-report')">分析报告 →</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- KPI 数据卡片 -->
    <div class="kpi-section-title">线路与数据状态</div>
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-val">{{ stats.lineCount }}</div>
        <div class="kpi-label">已开通线路</div>
      </div>
      <div class="kpi-card" :class="{ warn: stats.noMonitor > 0 }">
        <div class="kpi-val">{{ stats.noMonitor }}</div>
        <div class="kpi-label">待弓网入库</div>
      </div>
      <div class="kpi-card" :class="{ warn: stats.noStrip > 0 }">
        <div class="kpi-val">{{ stats.noStrip }}</div>
        <div class="kpi-label">待磨耗数据</div>
      </div>
      <div class="kpi-card" :class="{ warn: stats.noClimate > 0 }">
        <div class="kpi-val">{{ stats.noClimate }}</div>
        <div class="kpi-label">待温湿度</div>
      </div>
    </div>

    <div class="kpi-section-title" style="margin-top:16px">用户与审计</div>
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-val">{{ stats.ownerCount }}</div>
        <div class="kpi-label">业主账户（启用）</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">{{ stats.activeUserCount }}</div>
        <div class="kpi-label">7天内登录用户</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">—</div>
        <div class="kpi-label">操作日志</div>
        <div class="kpi-action">
          <el-button type="primary" link size="small" @click="go('sys-log')">查看 →</el-button>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">{{ stats.lineCount }}</div>
        <div class="kpi-label">已开通线路</div>
        <div class="kpi-action">
          <el-button type="primary" link size="small" @click="go('sys-lines')">管理 →</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, inject } from 'vue'
import { fetchLineRegistry, fetchAuthUsers } from '../api/client'

export default {
  name: 'AdminWorkbenchPage',
  setup() {
    const loading = ref(false)
    const lines = ref([])
    const users = ref([])
    const navigateTo = inject('navigateTo', null)

    const stats = computed(() => {
      const list = lines.value || []
      const allUsers = users.value || []
      const now = Date.now()
      const sevenDays = 7 * 24 * 3600 * 1000
      const activeUserCount = allUsers.filter((u) => {
        if (!u.last_login_at) return false
        const t = new Date(u.last_login_at).getTime()
        return !isNaN(t) && now - t <= sevenDays
      }).length
      return {
        lineCount: list.length,
        noMonitor: list.filter((x) => !x.has_monitor_data).length,
        noStrip: list.filter((x) => !x.strip_measurement_count).length,
        noClimate: list.filter((x) => !x.climate_day_count).length,
        ownerCount: allUsers.filter((u) => u.role === 'owner' && u.is_active).length,
        activeUserCount,
      }
    })

    async function load() {
      loading.value = true
      try {
        const [registry, userList] = await Promise.all([
          fetchLineRegistry(),
          fetchAuthUsers(),
        ])
        lines.value = registry
        users.value = userList
      } finally {
        loading.value = false
      }
    }

    function go(page) {
      if (navigateTo) navigateTo({ center: 'system', page })
    }

    function goCenter(center, page) {
      if (navigateTo) navigateTo({ center, page })
    }

    onMounted(load)

    return { loading, lines, stats, load, go, goCenter }
  },
}
</script>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.page-title { margin: 0 0 6px; font-size: 20px; }
.page-sub {
  margin: 0;
  font-size: 13px;
  color: var(--om-text-muted, #64748b);
  line-height: 1.6;
  max-width: 720px;
}
.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px;
}
.step {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--om-panel-border);
  border-radius: var(--om-radius-sm);
  background: var(--om-bg-3);
}
.step.done {
  border-color: rgba(61, 191, 173, 0.45);
  background: var(--om-accent-soft-2);
}
.step-no {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--om-accent-soft);
  color: var(--om-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}
.step.done .step-no {
  background: var(--om-success);
  color: #fff;
}
.step-title { font-weight: 600; margin-bottom: 4px; }
.step-desc {
  font-size: 12px;
  color: var(--om-text-muted);
  margin-bottom: 6px;
  line-height: 1.5;
}
.step-links { display: flex; flex-wrap: wrap; gap: 4px; }
.kpi-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--om-text-muted);
  margin-bottom: 8px;
}
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 4px;
}
.kpi-card {
  background: var(--om-bg-3);
  border: 1px solid var(--om-panel-border);
  border-radius: var(--om-radius-sm);
  padding: 14px 16px 12px;
  text-align: center;
  position: relative;
}
.kpi-card.warn {
  border-color: rgba(232, 168, 74, 0.5);
  background: rgba(232, 168, 74, 0.08);
}
.kpi-card.warn .kpi-val { color: var(--om-warning); }
.kpi-val { font-size: 28px; font-weight: 700; color: var(--om-text); }
.kpi-label { font-size: 12px; color: var(--om-text-muted); margin-top: 4px; }
.kpi-action { margin-top: 4px; }
@media (max-width: 960px) {
  .steps { grid-template-columns: 1fr; }
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
