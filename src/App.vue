<template>
  <LoginPage v-if="authReady && !authUser" @success="onLoginSuccess" />
  <div v-else-if="authReady" class="om-app">
    <!-- 顶部导航 -->
    <header class="om-header">
      <div class="om-brand">
        <button type="button" class="om-mobile-menu-btn" aria-label="打开菜单" @click="mobileMenuOpen = true">
          ☰
        </button>
        <img src="/logo.png" alt="国创" class="om-logo-img" />
        <div class="om-brand-text">
          <span class="om-brand-title">国创弓网数据及碳滑板磨耗分析</span>
          <span class="om-brand-sub">Guochuang OCS Data &amp; Strip-Wear Analysis</span>
          <span class="om-mobile-page-title">{{ currentPageLabel }}</span>
        </div>
      </div>

      <div class="om-header-right">
        <el-dropdown trigger="click" @command="onUserCommand">
          <span class="om-icon-btn user-btn">
            {{ authUser?.display_name || authUser?.username || '用户' }}
            <small v-if="authUser?.role === 'admin'"> · 管理员</small>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>{{ authUser?.username }}</el-dropdown-item>
              <el-dropdown-item command="change-password">修改密码</el-dropdown-item>
              <el-dropdown-item v-if="isAdminUser" command="workbench">管理工作台</el-dropdown-item>
              <el-dropdown-item v-if="isAdminUser" command="lines">线路管理</el-dropdown-item>
              <el-dropdown-item v-if="isAdminUser" command="users">用户管理</el-dropdown-item>
              <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button text size="small" class="om-theme-btn" @click="toggleTheme">
          <span class="om-theme-mark" :data-theme="isDark ? 'dark' : 'light'" aria-hidden="true" />
          {{ isDark ? '暗色' : '浅色' }}
        </el-button>
      </div>
    </header>

    <div class="om-body">
      <!-- 左侧父子菜单：栏目 -> 分组 -> 页面 -->
      <aside class="om-sidebar om-panel">
        <el-menu
          ref="treeMenu"
          class="om-tree-menu"
          :default-active="currentPage"
          :default-openeds="activeMenuParents"
          unique-opened
          @select="onMenuSelect"
        >
          <template v-for="center in menuTree" :key="center.key">
            <el-sub-menu :index="center.key">
              <template #title>
                <NavMark :name="center.icon" size="lg" />
                <span class="om-menu-center-label">{{ center.label }}</span>
              </template>

              <template v-for="group in center.groups" :key="group.key">
                <el-sub-menu
                  v-if="group.pages.length > 1"
                  :index="`${center.key}-${group.key}`"
                >
                  <template #title>
                    <NavMark :name="group.icon || 'dot'" />
                    <span class="om-menu-group-label">{{ group.label }}</span>
                  </template>
                  <el-menu-item
                    v-for="page in group.pages"
                    :key="page.key"
                    :index="page.key"
                  >
                    <NavMark :name="page.icon || 'dot'" />
                    <span class="om-menu-label">{{ page.label }}</span>
                    <span v-if="page.soon" class="om-soon-tag">即将上线</span>
                  </el-menu-item>
                </el-sub-menu>

                <template v-else>
                  <el-menu-item
                    v-for="page in group.pages"
                    :key="page.key"
                    :index="page.key"
                  >
                    <NavMark :name="page.icon || 'dot'" />
                    <span class="om-menu-label">{{ page.label }}</span>
                    <span v-if="page.soon" class="om-soon-tag">即将上线</span>
                  </el-menu-item>
                </template>
              </template>
            </el-sub-menu>
          </template>
        </el-menu>
      </aside>

      <!-- 主内容区 -->
      <main class="om-main om-grid-bg">
        <el-alert
          v-if="apiError"
          :title="apiError"
          type="error"
          show-icon
          closable
          style="margin-bottom: 12px"
          @close="apiError = ''"
        />

        <FilterBar
          v-if="linesReady && !currentDef?.page?.hideFilter"
          :lines="filterLines"
          :dates="dates"
          :date-meta="dateMeta"
          :merge-note="mergeNote"
          :line-id="lineId"
          :direction="direction"
          :selected-dates="selectedDates"
          :dates-loading="datesLoading"
          :date-filter-mode="currentDef?.page?.dateFilterMode || 'periods'"
          :hide-direction="!!currentDef?.page?.hideDirection"
          :simple-dates="!!currentDef?.page?.simpleDates"
          :default-range-months="currentDef?.page?.defaultRangeMonths || 1"
          :default-select-count="currentDef?.page?.defaultSelectCount || 0"
          :max-select-dates="currentDef?.page?.maxSelectDates || 0"
          :enable-batch-picker="filterEnableBatchPicker"
          :enable-multi-batch-compare="filterEnableMultiBatchCompare"
          :manual-batch="manualBatch"
          :batch-by-date="batchByDate"
          :batches-by-date="batchesByDate"
          @update:lineId="onLineChange"
          @update:direction="onDirectionChange"
          @update:selectedDates="onDatesChange"
          @update:manualBatch="onManualBatchChange"
          @update:batchByDate="onBatchByDateChange"
          @update:batchesByDate="onBatchesByDateChange"
          @change="onFilterChange"
          @query="onFilterQuery"
        />

        <div class="om-content">
          <keep-alive>
            <component
              :is="currentComponent"
              :key="pageCacheKey"
              v-bind="pageProps"
              @navigate="navigateTo"
            />
          </keep-alive>
        </div>
      </main>
    </div>

    <el-drawer
      v-model="mobileMenuOpen"
      direction="ltr"
      size="min(86vw, 320px)"
      title="功能导航"
      class="om-mobile-drawer"
    >
      <div class="om-mobile-centers">
        <button
          v-for="c in visibleCenters"
          :key="c.key"
          class="om-mobile-center-btn"
          :class="{ active: currentCenter === c.key }"
          @click="onMobileSwitchCenter(c.key)"
        >
          <NavMark :name="c.icon" size="lg" />
          <span>{{ c.label }}</span>
        </button>
      </div>
      <div v-for="group in visibleGroups" :key="group.key" class="om-mobile-group">
        <div class="om-mobile-group-title">{{ group.label }}</div>
        <button
          v-for="page in group.pages"
          :key="page.key"
          class="om-mobile-page-btn"
          :class="{ active: currentPage === page.key }"
          @click="onMobileSwitchPage(page.key)"
        >
          <NavMark :name="page.icon || 'dot'" />
          <span>{{ page.label }}</span>
        </button>
      </div>
    </el-drawer>

    <ChangePasswordDialog v-model="changePasswordVisible" />
  </div>
</template>

<script>
import { computed } from 'vue'
import { fetchLines, fetchDates, fetchStripWearLines, fetchMe, postAggWarmup } from './api/client'
import { centers, DEFAULT_CENTER, DEFAULT_PAGE, findPage, pagesOfCenter, firstPageKeyOfCenter } from './config/modules'
import PlaceholderPage from './components/common/PlaceholderPage.vue'
import FilterBar from './components/common/FilterBar.vue'
import NavMark from './components/common/NavMark.vue'
import LoginPage from './components/LoginPage.vue'
import ChangePasswordDialog from './components/ChangePasswordDialog.vue'
import { clearAuth, getStoredUser, getToken, isAdmin } from './utils/auth'
import { pickLineCode, pickLineName, resolveLineName } from './utils/lineDisplay'
import { loadBatchPrefs, saveBatchPrefs, withBatchPayload } from './utils/batchPrefs'

const FILTER_STORAGE_KEY = 'om_filter_prefs'

export default {
  name: 'App',
  components: { FilterBar, NavMark, LoginPage, ChangePasswordDialog },
  provide() {
    return {
      navigateTo: this.navigateTo,
      clearNavigationContext: this.clearNavigationContext,
      analysisQueryNonce: computed(() => this.queryNonce),
    }
  },
  data() {
    return {
      centers,
      lines: [],
      stripLines: [],
      dates: [],
      dateMeta: {},
      mergeNote: '',
      lineId: '',
      direction: '上行',
      selectedDates: [],
      dateRange: null,
      currentCenter: DEFAULT_CENTER,
      currentPage: DEFAULT_PAGE,
      isDark: false,
      apiError: '',
      datesLoading: false,
      filterSwitching: false,
      datesLoadSeq: 0,
      navigationContext: {},
      authUser: null,
      authReady: false,
      linesReady: false,
      _savedLineId: '',
      mobileMenuOpen: false,
      changePasswordVisible: false,
      /** 同日多组检测：手动选组状态 */
      manualBatch: false,
      batchByDate: {},
      batchesByDate: {},
      /** 手动点「查询」时递增，分析页据此强制刷新 */
      queryNonce: 0,
      _warmupTimer: null,
    }
  },
  computed: {
    isAdminUser() {
      return isAdmin(this.authUser)
    },
    visibleCenters() {
      if (this.isAdminUser) return this.centers
      return this.centers.filter((c) => c.key !== 'system' && !c.adminOnly)
    },
    currentGroups() {
      const groups = pagesOfCenter(this.currentCenter)
      if (this.isAdminUser) return groups
      return groups
        .map((g) => ({
          ...g,
          pages: (g.pages || []).filter((p) => !p.adminOnly),
        }))
        .filter((g) => g.pages?.length)
    },
    visibleGroups() {
      return this.currentGroups
    },
    menuTree() {
      return this.visibleCenters.map((c) => ({
        key: c.key,
        label: c.label,
        icon: c.icon,
        groups: this.menuGroupsOf(c),
      }))
    },
    activeMenuParents() {
      const def = findPage(this.currentPage)
      if (!def) return []
      const groupIndex = `${def.center.key}-${def.group.key}`
      return def.group.pages.length > 1
        ? [def.center.key, groupIndex]
        : [def.center.key]
    },
    currentDef() {
      return findPage(this.currentPage)
    },
    filterEnableBatchPicker() {
      const page = this.currentDef?.page
      if (this.currentCenter !== 'analysis') return false
      if (page?.enableBatchPicker) return true
      return this.currentDef?.group?.key === 'data-analysis'
    },
    filterEnableMultiBatchCompare() {
      return !!this.currentDef?.page?.enableMultiBatchCompare
    },
    currentComponent() {
      const def = this.currentDef
      if (!def) return PlaceholderPage
      if (def.page.soon || !def.page.component) return PlaceholderPage
      return def.page.component
    },
    pageProps() {
      const def = this.currentDef
      if (!def) return {}
      if (def.page.soon || !def.page.component) {
        return {
          title: def.page.label,
          description: def.page.description || '',
          hint: def.page.hint || '',
          icon: def.page.icon || '',
        }
      }
      return {
        ...(def.page.props || {}),
        lineId: this.lineId,
        lineName: this.currentLineName,
        direction: this.direction,
        selectedDates: this.selectedDates,
        dateRange: this.dateRange,
        isDark: this.isDark,
        navigateContext: this.navigationContext,
        manualBatch: this.manualBatch,
        batchByDate: this.batchByDate,
        batchesByDate: this.batchesByDate,
        queryNonce: this.queryNonce,
      }
    },
    currentLineName() {
      return resolveLineName(this.lineId, this.filterLines, '未选择')
    },
    /** 汇报页合并弓网检测线 + 碳滑板线，便于有任一数据的线路都能选 */
    filterLines() {
      if (this.currentCenter !== 'focus-report') return this.lines
      return this.mergedReportLines
    },
    mergedReportLines() {
      const byKey = new Map()
      const put = (code, source, kind) => {
        if (!code) return
        const name = pickLineName(typeof source === 'object' ? source : { name: source }, code)
        const exist = byKey.get(code)
        if (exist) {
          if (kind === 'detect') exist.hasDetect = true
          if (kind === 'strip') exist.hasStrip = true
          if (name && name !== '未命名线路') {
            exist.name = name
            exist.label = name
          }
          return
        }
        byKey.set(code, {
          code,
          name,
          label: name,
          hasDetect: kind === 'detect',
          hasStrip: kind === 'strip',
        })
      }
      for (const l of this.lines || []) {
        put(pickLineCode(l), l, 'detect')
      }
      for (const l of this.stripLines || []) {
        const sc = pickLineCode(l)
        let mapped = sc
        if (typeof sc === 'string' && sc.includes('_STRIP_')) {
          mapped = sc.replace('_STRIP_', '_LINE_')
        } else if (typeof sc === 'string' && sc.startsWith('ZZ_STRIP')) {
          mapped = sc.replace('ZZ_STRIP', 'ZZ_LINE')
        }
        const detectHit = (this.lines || []).find((x) => pickLineCode(x) === mapped)
        if (detectHit) {
          put(mapped, detectHit, 'strip')
        } else {
          put(sc, l, 'strip')
        }
      }
      return Array.from(byKey.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh'))
    },
    pageCacheKey() {
      // 仅按页面缓存，勿把线路/日期编进 key，否则改筛选会整页重挂、物理量被重置
      return this.currentPage
    },
    currentPageLabel() {
      return this.currentDef?.page?.label || '数据看板'
    },
  },
  async mounted() {
    this.restoreTheme()
    this.syncThemeClass()
    window.addEventListener('om-auth-expired', this.onAuthExpired)
    await this.bootstrapAuth()
  },
  beforeUnmount() {
    window.removeEventListener('om-auth-expired', this.onAuthExpired)
  },
  watch: {
    currentPage() {
      this.$nextTick(() => {
        const def = findPage(this.currentPage)
        if (!def || !this.$refs.treeMenu) return
        this.$refs.treeMenu.open(def.center.key)
        if (def.group.pages.length > 1) {
          this.$refs.treeMenu.open(`${def.center.key}-${def.group.key}`)
        }
      })
    },
  },
  methods: {
    filterStorageKey() {
      const u = this.authUser?.username
      return u ? `${FILTER_STORAGE_KEY}_${u}` : FILTER_STORAGE_KEY
    },
    syncBatchPrefsFromStorage() {
      if (!this.lineId) {
        this.manualBatch = false
        this.batchByDate = {}
        this.batchesByDate = {}
        return
      }
      const prefs = loadBatchPrefs(this.lineId, this.direction)
      this.manualBatch = prefs.manualBatch
      this.batchByDate = { ...prefs.batchByDate }
      this.batchesByDate = { ...(prefs.batchesByDate || {}) }
    },
    saveBatchPrefsForCurrent(partial = {}) {
      if (!this.lineId) return
      const next = saveBatchPrefs(partial, this.lineId, this.direction)
      this.manualBatch = next.manualBatch
      this.batchByDate = { ...(next.batchByDate || {}) }
      this.batchesByDate = { ...(next.batchesByDate || {}) }
    },
    async bootstrapAuth() {
      const token = getToken()
      if (!token) {
        this.authUser = null
        this.linesReady = false
        this.authReady = true
        return
      }
      try {
        this.authUser = await fetchMe()
      } catch {
        clearAuth()
        this.authUser = getStoredUser()
        if (this.authUser) clearAuth()
        this.authUser = null
      }
      if (this.authUser) {
        this.linesReady = false
        this.lineId = ''
        this._savedLineId = ''
        this.restoreFilterPrefs()
        await this.loadLines()
      } else {
        this.linesReady = false
      }
      this.authReady = true
    },
    async onLoginSuccess(user) {
      this.authUser = user
      this.linesReady = false
      this.lineId = ''
      this._savedLineId = ''
      this.selectedDates = []
      this.dates = []
      this.restoreFilterPrefs()
      await this.loadLines()
    },
    onAuthExpired() {
      this.authUser = null
      this.apiError = '登录已过期，请重新登录'
    },
    onUserCommand(cmd) {
      if (cmd === 'logout') {
        clearAuth()
        this.authUser = null
        this.lineId = ''
        this.linesReady = false
        this.selectedDates = []
        this.dates = []
        return
      }
      if (cmd === 'change-password') {
        this.changePasswordVisible = true
        return
      }
      if (cmd === 'workbench') {
        this.navigateTo({ center: 'system', page: 'sys-home' })
        return
      }
      if (cmd === 'lines') {
        this.navigateTo({ center: 'system', page: 'sys-lines' })
        return
      }
      if (cmd === 'users') {
        this.navigateTo({ center: 'system', page: 'sys-user' })
      }
    },
    restoreTheme() {
      try {
        const saved = localStorage.getItem('om_theme')
        // 默认白天；仅显式选过 dark 才进黑夜
        this.isDark = saved === 'dark'
      } catch {
        this.isDark = false
      }
    },
    restoreFilterPrefs() {
      try {
        const raw = localStorage.getItem(this.filterStorageKey())
        if (!raw) return
        const prefs = JSON.parse(raw)
        const savedCenter = this.centers.find((c) => c.key === prefs.currentCenter)
        const centerAllowed = savedCenter && (this.isAdminUser || !savedCenter.adminOnly)
        if (prefs.currentCenter && pagesOfCenter(prefs.currentCenter).length && centerAllowed) {
          this.currentCenter = prefs.currentCenter
        } else {
          this.currentCenter = DEFAULT_CENTER
        }
        if (prefs.currentPage && findPage(prefs.currentPage)) {
          this.currentPage = prefs.currentPage
        } else {
          this.currentPage = firstPageKeyOfCenter(this.currentCenter) || DEFAULT_PAGE
        }
        if (prefs.direction) this.direction = prefs.direction
        // 业主每次进入使用授权列表首条；管理员可记住上次线路
        if (this.isAdminUser && prefs.lineId) {
          this._savedLineId = prefs.lineId
        } else {
          this._savedLineId = ''
        }
        if (!this.isAdminUser) {
          this.selectedDates = []
        } else if (Array.isArray(prefs.selectedDates)) {
          this.selectedDates = prefs.selectedDates.filter(Boolean)
        }
        if (Array.isArray(prefs.dateRange) && prefs.dateRange.length === 2) {
          this.dateRange = prefs.dateRange
        }
      } catch {
        /* ignore */
      }
    },
    saveFilterPrefs() {
      try {
        const payload = {
          currentCenter: this.currentCenter,
          currentPage: this.currentPage,
          direction: this.direction,
          selectedDates: this.selectedDates,
          dateRange: this.dateRange,
        }
        if (this.isAdminUser) payload.lineId = this.lineId
        localStorage.setItem(this.filterStorageKey(), JSON.stringify(payload))
      } catch {
        /* ignore */
      }
    },
    applyLineFromPool() {
      const pool = this.filterLines
      if (!pool.length) {
        this.lineId = ''
        this.selectedDates = []
        this.dates = []
        this._savedLineId = ''
        return false
      }
      if (!this.isAdminUser) {
        this.lineId = pool[0].code
        this.selectedDates = []
        this._savedLineId = ''
        return true
      }
      const preferred = this._savedLineId || this.lineId
      const hit = preferred && pool.some((l) => l.code === preferred)
      if (!hit) {
        this.lineId = pool[0].code
        this.selectedDates = []
      } else {
        this.lineId = preferred
      }
      this._savedLineId = ''
      return true
    },
    navigateTo({ center, page, context, lineId, direction } = {}) {
      if (lineId) this.lineId = lineId
      if (direction) this.direction = direction
      if (context && Object.keys(context).length) {
        this.navigationContext = { ...context, _ts: Date.now() }
      }
      if (center && pagesOfCenter(center).length) this.currentCenter = center
      if (page && findPage(page)) this.currentPage = page
      else if (center && pagesOfCenter(center).length) {
        this.currentPage = firstPageKeyOfCenter(center) || this.currentPage
      }
      this.saveFilterPrefs()
    },
    clearNavigationContext() {
      this.navigationContext = {}
    },
    switchCenter(key) {
      this.currentCenter = key
      const first = firstPageKeyOfCenter(key)
      if (first) this.currentPage = first
      // 汇报页线路池合并后，校正当前选中线路
      const pool = this.filterLines
      if (pool.length && !pool.some((l) => l.code === this.lineId)) {
        this.applyLineFromPool()
      }
      this.saveFilterPrefs()
      this.adjustDatesForPage()
      this.loadDates()
      this.scheduleAnalysisWarmup()
    },
    switchPage(key) {
      this.currentPage = key
      this.navigationContext = {}
      this.saveFilterPrefs()
      this.adjustDatesForPage()
    },
    menuGroupsOf(center) {
      const groups = (center.groups || []).map((g) => ({
        ...g,
        pages: (g.pages || []).filter((p) => !p.adminOnly || this.isAdminUser),
      }))
      return groups.filter((g) => g.pages.length)
    },
    onMenuSelect(pageKey) {
      const def = findPage(pageKey)
      if (!def) return
      this.currentCenter = def.center.key
      this.currentPage = def.page.key
      this.navigationContext = {}
      this.saveFilterPrefs()
      this.adjustDatesForPage()
      this.loadDates()
      this.scheduleAnalysisWarmup()
      this.mobileMenuOpen = false
    },
    onMobileSwitchCenter(key) {
      this.switchCenter(key)
      this.mobileMenuOpen = false
    },
    onMobileSwitchPage(key) {
      this.switchPage(key)
      this.mobileMenuOpen = false
    },
    adjustDatesForPage() {
      if (!this.dates.length) return
      const stillValid = (this.selectedDates || []).filter((d) => this.dates.includes(d))
      if (stillValid.length) {
        this.selectedDates = stillValid
        return
      }
      const isRangeMode = this.currentDef?.page?.dateFilterMode === 'range'
      const defaultCount = this.currentDef?.page?.defaultSelectCount
      if (isRangeMode) {
        this.selectedDates = []
      } else if (this.currentDef?.page?.simpleDates) {
        this.selectedDates = this.dates.slice(0, Math.min(2, this.dates.length))
      } else if (defaultCount && defaultCount > 0) {
        this.selectedDates = this.dates.slice(0, Math.min(defaultCount, this.dates.length))
      } else {
        this.selectedDates = this.dates.slice(0, 1)
      }
    },
    toggleTheme() {
      this.isDark = !this.isDark
      this.syncThemeClass()
      try {
        localStorage.setItem('om_theme', this.isDark ? 'dark' : 'light')
      } catch {
        /* ignore */
      }
    },
    syncThemeClass() {
      document.documentElement.classList.toggle('om-light', !this.isDark)
    },
    onLineChange(v) {
      if (v !== this.lineId) {
        this.filterSwitching = true
        this.lineId = v
        this.selectedDates = []
        this.syncBatchPrefsFromStorage()
        this.saveFilterPrefs()
        this.loadDates()
      }
    },
    onDirectionChange(v) {
      if (v !== this.direction) {
        this.filterSwitching = true
        this.direction = v
        this.selectedDates = []
        this.syncBatchPrefsFromStorage()
        this.saveFilterPrefs()
        this.loadDates()
      }
    },
    onDatesChange(v) {
      if (this.filterSwitching) return
      const incoming = Array.isArray(v) ? v : []
      if (!this.dates.length) {
        this.selectedDates = incoming
        this.saveFilterPrefs()
        return
      }
      const compact = (d) => String(d || '').replace(/-/g, '').slice(0, 8)
      const byCompact = new Map((this.dates || []).map((d) => [compact(d), d]))
      const kept = []
      for (const d of incoming) {
        const hit = byCompact.get(compact(d)) || (this.dates.includes(d) ? d : '')
        if (hit && !kept.includes(hit)) kept.push(hit)
      }
      this.selectedDates = kept
      this.saveFilterPrefs()
      this.scheduleAnalysisWarmup()
    },
    onFilterQuery() {
      this.queryNonce += 1
    },
    onManualBatchChange(v) {
      if (this.filterSwitching) return
      this.manualBatch = !!v
      this.saveBatchPrefsForCurrent({ manualBatch: this.manualBatch, batchByDate: this.batchByDate, batchesByDate: this.batchesByDate })
    },
    onBatchByDateChange(v) {
      if (this.filterSwitching) return
      this.batchByDate = { ...(v || {}) }
      this.saveBatchPrefsForCurrent({ manualBatch: this.manualBatch, batchByDate: this.batchByDate, batchesByDate: this.batchesByDate })
    },
    onBatchesByDateChange(v) {
      if (this.filterSwitching) return
      this.batchesByDate = { ...(v || {}) }
      this.saveBatchPrefsForCurrent({ manualBatch: this.manualBatch, batchByDate: this.batchByDate, batchesByDate: this.batchesByDate })
    },
    onFilterChange(payload) {
      if (this.filterSwitching) {
        return
      }
      if (payload?.dateRange) {
        this.dateRange = payload.dateRange
      } else if (payload && Object.prototype.hasOwnProperty.call(payload, 'dateRange') && !payload.dateRange) {
        this.dateRange = null
      }
      if (payload?.manualBatch != null) {
        this.manualBatch = !!payload.manualBatch
      }
      if (payload?.batchByDate) {
        this.batchByDate = { ...payload.batchByDate }
      }
      if (payload?.batchesByDate) {
        this.batchesByDate = { ...payload.batchesByDate }
      }
      saveBatchPrefs({
        manualBatch: this.manualBatch,
        batchByDate: this.batchByDate,
        batchesByDate: this.batchesByDate,
      }, this.lineId, this.direction)
      this.saveFilterPrefs()
      this.scheduleAnalysisWarmup()
    },
    scheduleAnalysisWarmup() {
      if (this._warmupTimer) clearTimeout(this._warmupTimer)
      this._warmupTimer = setTimeout(() => {
        this._warmupTimer = null
        this.warmupAnalysisAgg()
      }, 800)
    },
    warmupAnalysisAgg() {
      if (this.currentCenter !== 'analysis') return
      if (!this.lineId || !this.selectedDates?.length) return
      const payload = withBatchPayload({
        line_id: this.lineId,
        direction: this.direction || '上行',
        dates: this.selectedDates.map((d) => String(d).replace(/-/g, '').slice(0, 8)),
      }, this.manualBatch, this.batchByDate, this.batchesByDate)
      postAggWarmup(payload).catch(() => {})
    },
    async loadLines() {
      this.linesReady = false
      try {
        const [detect, strip] = await Promise.all([
          fetchLines(),
          fetchStripWearLines().catch(() => []),
        ])
        this.lines = detect || []
        this.stripLines = strip || []
        if (this.applyLineFromPool()) {
          this.syncBatchPrefsFromStorage()
          await this.loadDates()
        }
      } catch (e) {
        this.apiError = '无法连接后端 API，请确认 backend 服务已启动（默认 http://localhost:8000）'
        console.error(e)
      } finally {
        this.linesReady = true
      }
    },
    async loadDates() {
      if (!this.lineId || !this.direction) return
      const seq = ++this.datesLoadSeq
      const reqLine = this.lineId
      const reqDir = this.direction
      // 纯碳滑板线无检测日期时，汇报仍可选，日期留空
      const isStripOnly =
        this.currentCenter === 'focus-report' &&
        String(this.lineId).includes('STRIP') &&
        !(this.lines || []).some((l) => l.code === this.lineId)
      this.datesLoading = true
      try {
        if (isStripOnly) {
          if (seq !== this.datesLoadSeq || this.lineId !== reqLine || this.direction !== reqDir) return
          this.dates = []
          this.dateMeta = {}
          this.mergeNote = ''
          this.selectedDates = []
          return
        }
        const res = await fetchDates(this.lineId, this.direction)
        if (seq !== this.datesLoadSeq || this.lineId !== reqLine || this.direction !== reqDir) return
        this.dates = res.dates || []
        this.dateMeta = res.dateMeta || {}
        this.mergeNote = res.mergeNote || ''
        if (!this.dates.length) {
          this.selectedDates = []
          return
        }
        if (this.filterSwitching) {
          // 日期池交给 FilterBar 按新线路/行别重选；
          // 这里若把已选日滤成空，分析页会当成「未选检测日」不再请求。
          return
        }
        const stillValid = (this.selectedDates || []).filter((d) => this.dates.includes(d))
        if (stillValid.length) {
          this.selectedDates = stillValid
          return
        }
        const mode = this.currentDef?.page?.dateFilterMode || 'periods'
        if (mode === 'range') {
          this.selectedDates = []
          return
        }
        if (this.currentDef?.page?.simpleDates) {
          this.selectedDates = this.dates.slice(0, Math.min(2, this.dates.length))
        } else {
          const n = this.currentDef?.page?.defaultSelectCount || 1
          this.selectedDates = this.dates.slice(0, Math.min(n, this.dates.length))
        }
      } catch (e) {
        console.error(e)
        if (seq !== this.datesLoadSeq) return
        this.selectedDates = []
        this.dateMeta = {}
        this.mergeNote = ''
      } finally {
        if (seq === this.datesLoadSeq) {
          this.datesLoading = false
          this.filterSwitching = false
        }
      }
    },
  },
}
</script>

<style scoped>
.om-app {
  height: 100vh;
  width: 100%;
  max-width: 100vw;
  display: flex;
  flex-direction: column;
  /* 顶部双光源渐变背景：左蓝右青，营造纵深感 */
  background:
    radial-gradient(1100px 520px at 88% -10%, rgba(61, 191, 173, 0.07), transparent 60%),
    radial-gradient(900px 480px at -8% -6%, rgba(52, 136, 217, 0.09), transparent 55%),
    var(--om-bg);
  color: var(--om-text);
  overflow: hidden;
  overscroll-behavior: none;
}

/* 顶部导航 */
.om-header {
  height: var(--om-header-h);
  flex: 0 0 var(--om-header-h);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px 0 20px;
  background: var(--om-bg-2);
  border-bottom: 1px solid var(--om-panel-border);
  box-shadow: var(--om-panel-glow);
  position: relative;
  z-index: 10;
  min-width: 0;
}
/* 底部品牌渐变强调线 */
.om-header::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: linear-gradient(
    90deg,
    var(--om-brand-blue),
    var(--om-brand-teal) 45%,
    rgba(61, 191, 173, 0) 90%
  );
  opacity: 0.55;
  pointer-events: none;
}
.om-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  min-width: 0;
}
.om-logo-img {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgba(61, 191, 173, 0.35));
}
.om-brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
  overflow: hidden;
}
.om-brand-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: linear-gradient(90deg, var(--om-brand-blue) 0%, var(--om-brand-teal) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.om-brand-sub {
  font-size: 10px;
  color: var(--om-text-dim);
  letter-spacing: 0.3px;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.om-theme-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--om-text-muted);
  flex-shrink: 0;
}
.om-theme-mark {
  width: 12px;
  height: 12px;
  display: inline-block;
  position: relative;
  flex-shrink: 0;
}
.om-theme-mark[data-theme='light']::before {
  content: '';
  position: absolute;
  inset: 2px;
  border: 1.5px solid currentColor;
  border-radius: 50%;
}
.om-theme-mark[data-theme='dark']::before {
  content: '';
  position: absolute;
  inset: 1px;
  border: 1.5px solid currentColor;
  border-radius: 50%;
  border-right-color: transparent;
  border-bottom-color: transparent;
  transform: rotate(-35deg);
}
.om-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  margin-left: auto;
}
.om-icon-btn {
  cursor: pointer;
  font-size: 14px;
  color: var(--om-text-muted);
  flex-shrink: 0;
}
.om-icon-btn.om-clickable:hover {
  color: var(--om-accent);
}
.om-icon-btn:hover {
  color: var(--om-accent);
}

/* 主体 */
.om-body {
  flex: 1;
  display: flex;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

/* 侧栏 */
.om-sidebar {
  width: var(--om-sidebar-w);
  flex: 0 0 var(--om-sidebar-w);
  margin: 12px 0 12px 12px;
  padding: 12px 8px;
  overflow-x: hidden;
  overflow-y: auto;
  min-width: 0;
}
.om-tree-menu {
  border-right: none;
  background: transparent;
}
.om-tree-menu :deep(.el-menu) {
  background: transparent;
}
.om-tree-menu :deep(.el-sub-menu__title),
.om-tree-menu :deep(.el-menu-item) {
  height: 42px;
  line-height: 42px;
  border-radius: var(--om-radius-sm);
  margin: 2px 4px;
  color: var(--om-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.18s ease, color 0.18s ease;
}
.om-tree-menu :deep(.el-sub-menu__title:hover),
.om-tree-menu :deep(.el-menu-item:hover) {
  background: var(--om-accent-soft);
  color: var(--om-text);
}
.om-tree-menu :deep(.el-menu-item.is-active) {
  color: var(--om-brand-blue);
  background: linear-gradient(90deg, var(--om-accent-soft), rgba(52, 136, 217, 0) 92%);
  font-weight: 600;
  box-shadow: inset 3px 0 0 var(--om-brand-blue);
}
.om-tree-menu :deep(.el-sub-menu .el-menu-item) {
  min-width: 0;
}
/* 子菜单展开箭头：颜色减淡 + 展开时旋转过渡 */
.om-tree-menu :deep(.el-sub-menu__icon-arrow) {
  color: var(--om-text-dim);
  transition: transform 0.2s ease, color 0.18s ease;
}
.om-tree-menu :deep(.el-sub-menu__title:hover .el-sub-menu__icon-arrow) {
  color: var(--om-text-muted);
}
.om-tree-menu :deep(.nav-mark) {
  margin-right: 8px;
  transition: color 0.18s ease;
}
.om-menu-center-label,
.om-menu-group-label {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.om-menu-center-label {
  font-weight: 600;
  letter-spacing: 0.3px;
}
.om-menu-group-label {
  font-size: 13px;
  color: var(--om-text-muted);
  letter-spacing: 0.2px;
}
.om-menu-group {
  margin-bottom: 16px;
}
.om-menu-group-title {
  font-size: 12px;
  color: var(--om-text-dim);
  padding: 6px 10px;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.om-menu-item {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--om-text-muted);
  padding: 9px 12px;
  border-radius: var(--om-radius-sm);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color 0.15s, background 0.15s;
  margin-bottom: 2px;
  min-width: 0;
}
.om-menu-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}
.om-menu-item:hover {
  color: var(--om-text);
  background: var(--om-accent-soft);
}
.om-menu-item.active {
  color: var(--om-brand-blue);
  background: var(--om-accent-soft);
  box-shadow: inset 3px 0 0 var(--om-brand-blue);
}
.om-soon-tag {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 10px;
  color: var(--om-warning);
  border: 1px solid var(--om-warning);
  border-radius: 999px;
  padding: 0 8px;
  opacity: 0.75;
}

@media (max-width: 1100px) {
  .om-brand-sub {
    display: none;
  }
}

@media (max-width: 860px) {
  .om-brand-title {
    font-size: 13px;
  }
  .om-sidebar {
    width: 200px;
    flex-basis: 200px;
  }
}

.om-mobile-menu-btn {
  display: none;
  width: 40px;
  height: 40px;
  border: 1px solid var(--om-panel-border);
  border-radius: var(--om-radius-sm);
  background: var(--om-bg-3);
  color: var(--om-text);
  font-size: 18px;
  cursor: pointer;
  flex: 0 0 40px;
}
.om-mobile-page-title {
  display: none;
  margin-top: 2px;
  font-size: 11px;
  color: var(--om-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.om-mobile-centers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}
.om-mobile-center-btn,
.om-mobile-page-btn {
  width: 100%;
  text-align: left;
  border: 1px solid var(--om-panel-border);
  background: var(--om-bg-3);
  color: var(--om-text-muted);
  border-radius: var(--om-radius-sm);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.18s ease;
}
.om-mobile-center-btn:hover,
.om-mobile-page-btn:hover {
  border-color: var(--om-brand-teal);
  color: var(--om-text);
}
.om-mobile-center-btn.active,
.om-mobile-page-btn.active {
  color: var(--om-brand-blue);
  border-color: var(--om-brand-blue);
  background: linear-gradient(90deg, var(--om-accent-soft), rgba(52, 136, 217, 0) 90%);
  box-shadow: inset 3px 0 0 var(--om-brand-blue);
}
.om-mobile-group {
  margin-bottom: 14px;
}
.om-mobile-group-title {
  font-size: 12px;
  color: var(--om-text-dim);
  margin: 0 0 8px;
}
.om-mobile-page-btn {
  margin-bottom: 6px;
}

@media (max-width: 768px) {
  .om-header {
    padding: 0 10px 0 12px;
    gap: 8px;
  }
  .om-mobile-menu-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .om-brand {
    flex: 1 1 auto;
    max-width: none;
  }
  .om-brand-sub {
    display: none;
  }
  .om-mobile-page-title {
    display: block;
  }
  .om-sidebar {
    display: none;
  }
  .om-body {
    flex-direction: column;
  }
  .om-main {
    padding: 10px 10px 14px;
  }
  .om-header-right .user-btn {
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .om-theme-btn span:not(.om-theme-mark) {
    display: none;
  }
}

/* 主区 */
.om-main {
  flex: 1;
  min-width: 0;
  padding: 12px 16px 16px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-x: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.om-content {
  flex: 1;
  min-height: 0;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}
</style>
