/**
 * 前端展示模块注册表（树形：栏目 → 分组 → 页面）
 * 新增页面：1) 创建 Vue 组件  2) 在此注册  3) 无需改 App.vue
 *
 * 节点字段：
 *   page.soon = true   表示该页尚未实现，渲染为 PlaceholderPage
 *   page.icon          侧栏 SVG 图标键名（见 NavMark.vue）
 *   page.props         透传给组件的静态 props
 *   page.hideFilter    隐藏顶部 FilterBar
 *
 * 页面组件均按需异步加载（defineAsyncComponent + 动态 import），
 * 避免首屏把所有分析/导入页打进同一个 bundle。
 */
import { defineAsyncComponent } from 'vue'

const ComparisonPage = defineAsyncComponent(
  () => import('../components/ComparisonPage.vue'),
)
const ArcAnalysisPage = defineAsyncComponent(
  () => import('../components/ArcAnalysisPage.vue'),
)
const SpeedArcPage = defineAsyncComponent(
  () => import('../components/SpeedArcPage.vue'),
)
const WarningPage = defineAsyncComponent(
  () => import('../components/WarningPage.vue'),
)
const AlarmStatsPage = defineAsyncComponent(
  () => import('../components/AlarmStatsPage.vue'),
)
const InspectionReportPage = defineAsyncComponent(
  () => import('../components/InspectionReportPage.vue'),
)
const StripWearImportPage = defineAsyncComponent(
  () => import('../components/StripWearImportPage.vue'),
)
const StripWearDashboardPage = defineAsyncComponent(
  () => import('../components/StripWearDashboardPage.vue'),
)
const StripWearPredictPage = defineAsyncComponent(
  () => import('../components/StripWearPredictPage.vue'),
)
const ClimateImportPage = defineAsyncComponent(
  () => import('../components/ClimateImportPage.vue'),
)
const ClimateDashboardPage = defineAsyncComponent(
  () => import('../components/ClimateDashboardPage.vue'),
)
const MatchingWorkbenchPage = defineAsyncComponent(
  () => import('../components/MatchingWorkbenchPage.vue'),
)
const PoleBaselinePage = defineAsyncComponent(
  () => import('../components/PoleBaselinePage.vue'),
)
const UserManagementPage = defineAsyncComponent(
  () => import('../components/UserManagementPage.vue'),
)
const LineManagementPage = defineAsyncComponent(
  () => import('../components/LineManagementPage.vue'),
)
const AdminWorkbenchPage = defineAsyncComponent(
  () => import('../components/AdminWorkbenchPage.vue'),
)
const OpLogPage = defineAsyncComponent(
  () => import('../components/OpLogPage.vue'),
)

export const centers = [
  {
    key: 'strip-wear',
    label: '碳滑板磨耗',
    icon: 'strip',
    groups: [
      {
        key: 'strip-data',
        label: '数据与看板',
        icon: 'layers',
        pages: [
          {
            key: 'strip-import',
            label: '数据导入',
            icon: 'list',
            component: StripWearImportPage,
            hideFilter: true,
            description: '碳滑板磨耗测点数据导入',
          },
          {
            key: 'strip-dashboard',
            label: '磨耗数据看板',
            icon: 'chart',
            component: StripWearDashboardPage,
            hideFilter: true,
            description: '全线累计磨耗率、当期变化、各车明细',
          },
          {
            key: 'strip-predict',
            label: '可用预估',
            icon: 'trend',
            component: StripWearPredictPage,
            hideFilter: true,
            description: '关注清单与预计可用天数（仅分析，不给出处置指令）',
          },
        ],
      },
    ],
  },
  {
    key: 'analysis',
    label: '综合分析',
    icon: 'analysis',
    groups: [
      {
        key: 'line-risk',
        label: '线路研判',
        icon: 'target',
        pages: [
          {
            key: 'matching-workbench',
            label: '线路简报',
            icon: 'trend',
            component: MatchingWorkbenchPage,
            dateFilterMode: 'range',
            defaultSelectCount: 12,
            description: '线路燃弧时长与燃弧率',
          },
          {
            key: 'pole-baseline',
            label: '杆号评估',
            icon: 'pole',
            component: PoleBaselinePage,
            dateFilterMode: 'range',
            defaultSelectCount: 12,
            enableBatchPicker: true,
            enableMultiBatchCompare: true,
            description: '按杆号对照自身历史',
          },
          {
            key: 'alarm-network',
            label: '超限统计',
            icon: 'line',
            component: AlarmStatsPage,
            dateFilterMode: 'range',
            defaultSelectCount: 12,
            enableBatchPicker: true,
            enableMultiBatchCompare: true,
            description: '阈值次数、类型与热点',
          },
        ],
      },
      {
        key: 'data-analysis',
        label: '检测数据明细',
        icon: 'list',
        pages: [
          {
            key: 'arc',
            label: '燃弧分析',
            icon: 'arc',
            component: ArcAnalysisPage,
            dateFilterMode: 'range',
            defaultRangeMonths: 1,
            enableBatchPicker: true,
            enableMultiBatchCompare: true,
            description: '燃弧强度超限散点与明细（综合分析的点位来源）',
          },
          {
            key: 'speed-arc',
            label: '速度-燃弧图',
            icon: 'speed',
            component: SpeedArcPage,
            dateFilterMode: 'range',
            defaultSelectCount: 2,
            enableBatchPicker: true,
            enableMultiBatchCompare: true,
            description: '速度与燃弧强度关联（综合分析的工况核对）',
          },
          {
            key: 'warning',
            label: '超限预警',
            icon: 'alert',
            component: WarningPage,
            dateFilterMode: 'range',
            defaultRangeMonths: 1,
            enableBatchPicker: true,
            enableMultiBatchCompare: true,
            description: '按阈值检测超限点',
          },
          {
            key: 'comparison',
            label: '新旧对比',
            icon: 'compare',
            component: ComparisonPage,
            dateFilterMode: 'range',
            defaultSelectCount: 2,
            enableBatchPicker: true,
            enableMultiBatchCompare: true,
            description: '两期检测数据沿杆号叠加对比',
          },
        ],
      },
    ],
  },
  {
    key: 'climate',
    label: '隧道温湿度',
    icon: 'climate',
    groups: [
      {
        key: 'climate-data',
        label: '数据与看板',
        icon: 'layers',
        pages: [
          {
            key: 'climate-import',
            label: '数据导入',
            icon: 'list',
            component: ClimateImportPage,
            hideFilter: true,
            description: '隧道日温湿度导入与维护',
          },
          {
            key: 'climate-dashboard',
            label: '温湿度看板',
            icon: 'chart',
            component: ClimateDashboardPage,
            hideFilter: true,
            description: '日温度/湿度趋势与高湿天数（仅陈述事实）',
          },
        ],
      },
    ],
  },
  {
    key: 'focus-report',
    label: '分析报告',
    icon: 'report',
    adminOnly: true,
    groups: [
      {
        key: 'focus-report-group',
        label: '报告',
        icon: 'report',
        pages: [
          {
            key: 'inspection-report',
            label: '检测分析报告',
            icon: 'report',
            component: InspectionReportPage,
            hideDirection: true,
            simpleDates: true,
            description: '燃弧锚段 / 综合检测 / 碳滑板磨耗',
          },
        ],
      },
    ],
  },
  {
    key: 'system',
    label: '系统管理',
    icon: 'system',
    groups: [
      {
        key: 'sys-lines',
        label: '线路与权限',
        icon: 'shield',
        pages: [
          {
            key: 'sys-home',
            label: '管理工作台',
            icon: 'chart',
            component: AdminWorkbenchPage,
            hideFilter: true,
            adminOnly: true,
          },
          {
            key: 'sys-lines',
            label: '线路管理',
            icon: 'list',
            component: LineManagementPage,
            hideFilter: true,
            adminOnly: true,
            description: '线路开通、弓网入库与三域数据状态',
          },
          {
            key: 'sys-user',
            label: '用户管理',
            icon: 'user',
            component: UserManagementPage,
            hideFilter: true,
            adminOnly: true,
          },
        ],
      },
      {
        key: 'sys-log',
        label: '系统日志',
        icon: 'log',
        pages: [
          {
            key: 'sys-log',
            label: '操作日志',
            icon: 'log',
            component: OpLogPage,
            hideFilter: true,
            adminOnly: true,
          },
        ],
      },
    ],
  },
]

export const DEFAULT_CENTER = 'strip-wear'
export const DEFAULT_PAGE = 'strip-dashboard'

export function findPage(pageKey) {
  for (const c of centers) {
    for (const g of c.groups || []) {
      for (const p of g.pages || []) {
        if (p.key === pageKey) return { center: c, group: g, page: p }
      }
    }
  }
  return null
}

export function pagesOfCenter(centerKey) {
  const c = centers.find((x) => x.key === centerKey)
  return c?.groups || []
}

export function firstPageKeyOfCenter(centerKey) {
  const groups = pagesOfCenter(centerKey)
  for (const g of groups) {
    if (g.pages?.length) return g.pages[0].key
  }
  return null
}
