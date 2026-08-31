<template>
  <div class="chart-card om-panel">
    <div class="chart-card-head">
      <div class="chart-card-title">
        <span class="dot" />
        <span>{{ title }}</span>
        <span class="chart-card-desc" v-if="description">{{ description }}</span>
      </div>
      <div class="chart-card-tools">
        <slot name="tools" />
        <el-button
          v-if="downloadable"
          size="small"
          text
          @click="onDownload"
        >
          ⬇ 下载
        </el-button>
      </div>
    </div>
    <div class="chart-card-body" :style="{ height: bodyHeight }">
      <slot />
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChartCard',
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    downloadable: { type: Boolean, default: true },
    height: { type: [String, Number], default: 320 },
  },
  computed: {
    bodyHeight() {
      if (typeof this.height === 'number') return `${this.height}px`
      return this.height
    },
  },
  methods: {
    onDownload() {
      const chart = this.$el.querySelector('canvas')
      if (!chart) return
      const url = chart.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `${this.title || 'chart'}.png`
      a.click()
    },
  },
}
</script>

<style scoped>
.chart-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.chart-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--om-divider);
}
.chart-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--om-text);
}
.chart-card-title .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--om-accent);
  box-shadow: 0 0 8px var(--om-accent);
}
.chart-card-desc {
  font-size: 12px;
  font-weight: 400;
  color: var(--om-text-dim);
  margin-left: 6px;
}
.chart-card-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}
.chart-card-body {
  flex: 1;
  min-height: 0;
  padding: 8px 4px 4px;
}
</style>
