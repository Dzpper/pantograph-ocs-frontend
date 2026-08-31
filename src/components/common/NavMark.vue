<template>
  <svg
    class="nav-mark"
    :class="{ 'is-lg': size === 'lg' }"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- 碳滑板 -->
    <template v-if="name === 'strip'">
      <rect x="3" y="9" width="18" height="6" rx="1.5" />
      <path d="M7 9V7.5M12 9V6.5M17 9V7.5" />
    </template>
    <!-- 隧道温湿度 -->
    <template v-else-if="name === 'climate'">
      <path d="M12 3v11" />
      <path d="M12 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
      <path d="M16 6.5a2.5 2.5 0 0 1 0 5" />
    </template>
    <!-- 数据分析 -->
    <template v-else-if="name === 'analysis'">
      <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" />
    </template>
    <!-- 汇报 -->
    <template v-else-if="name === 'report'">
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5M9 13h8M9 17h6" />
    </template>
    <!-- 系统 -->
    <template v-else-if="name === 'system'">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </template>
    <!-- 列表/数据管理 -->
    <template v-else-if="name === 'list'">
      <path d="M9 7h11M9 12h11M9 17h11M5 7h.01M5 12h.01M5 17h.01" />
    </template>
    <!-- 柱状图 -->
    <template v-else-if="name === 'chart'">
      <path d="M4 19V11M10 19V6M16 19v-8M22 19H2" />
    </template>
    <!-- 趋势 -->
    <template v-else-if="name === 'trend'">
      <path d="M3 17l6-6 4 4 7-8" />
      <path d="M15 7h5v5" />
    </template>
    <!-- 线路 -->
    <template v-else-if="name === 'line'">
      <circle cx="5" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
      <path d="M7 12h10" />
    </template>
    <!-- 燃弧 -->
    <template v-else-if="name === 'arc'">
      <path d="M13 2 7 13h5l-1 9 7-12h-5l1-8z" />
    </template>
    <!-- 速度 -->
    <template v-else-if="name === 'speed'">
      <path d="M5.5 17.5a8 8 0 1 1 13 0" />
      <path d="M12 13l4-3" />
      <circle cx="12" cy="13" r="1.2" fill="currentColor" stroke="none" />
    </template>
    <!-- 预警 -->
    <template v-else-if="name === 'alert'">
      <path d="M12 4 3 19h18L12 4z" />
      <path d="M12 10v4M12 16.5h.01" />
    </template>
    <!-- 对比 -->
    <template v-else-if="name === 'compare'">
      <path d="M8 5v14M16 5v14M4 9h8M12 15h8" />
    </template>
    <!-- 用户 -->
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.8-3.2 4.2-4.8 7-4.8s5.2 1.6 7 4.8" />
    </template>
    <!-- 日志 -->
    <template v-else-if="name === 'log'">
      <path d="M8 4h9a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z" />
      <path d="M10 9h6M10 13h6" />
    </template>
    <!-- 分组：数据与看板（层叠） -->
    <template v-else-if="name === 'layers'">
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z" />
      <path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
    </template>
    <!-- 分组：综合分析（聚焦目标） -->
    <template v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </template>
    <!-- 分组：权限（盾牌） -->
    <template v-else-if="name === 'shield'">
      <path d="M12 3l7 3v5.5c0 4.5-3 7.6-7 9.5-4-1.9-7-5-7-9.5V6l7-3z" />
      <path d="m9 12 2 2 4-4" />
    </template>
    <!-- 默认点 -->
    <template v-else>
      <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
    </template>
  </svg>
</template>

<script>
export default {
  name: 'NavMark',
  props: {
    name: { type: String, default: 'dot' },
    size: { type: String, default: 'sm' }, // sm | lg
  },
}
</script>

<style scoped>
.nav-mark {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  display: block;
  opacity: 0.92;
}
.nav-mark.is-lg {
  width: 18px;
  height: 18px;
  flex-basis: 18px;
}
</style>
