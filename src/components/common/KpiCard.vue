<template>
  <div
    class="kpi-card om-panel"
    :class="[`tone-${tone}`, { clickable }]"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="onClick"
    @keydown.enter="onClick"
  >
    <div class="kpi-top">
      <span class="kpi-label">{{ label }}</span>
      <span class="kpi-icon" v-if="icon">{{ icon }}</span>
    </div>
    <div class="kpi-value">
      {{ value }}<span class="kpi-unit" v-if="unit">{{ unit }}</span>
    </div>
    <div class="kpi-sub" v-if="sub || $slots.default">
      <slot>
        <span v-for="(item, i) in subItems" :key="i" class="kpi-sub-item">
          {{ item.label }}：<b :class="{ danger: item.danger }">{{ item.value }}</b>
        </span>
      </slot>
    </div>
    <div v-if="clickable && hint" class="kpi-hint">{{ hint }}</div>
  </div>
</template>

<script>
export default {
  name: 'KpiCard',
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], default: '—' },
    unit: { type: String, default: '' },
    sub: { type: Array, default: () => [] },
    icon: { type: String, default: '' },
    tone: { type: String, default: 'accent' },
    clickable: { type: Boolean, default: false },
    hint: { type: String, default: '点击查看 →' },
  },
  emits: ['click'],
  computed: {
    subItems() {
      return (this.sub || []).map((s) =>
        typeof s === 'string' ? { label: s, value: '' } : s
      )
    },
  },
  methods: {
    onClick() {
      if (this.clickable) this.$emit('click')
    },
  },
}
</script>

<style scoped>
.kpi-card {
  padding: 18px 20px;
  min-height: 118px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  overflow: hidden;
}
.kpi-card.clickable {
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.kpi-card.clickable:hover {
  transform: translateY(-2px);
  border-color: var(--om-accent);
  box-shadow: 0 4px 16px rgba(52, 136, 217, 0.15);
}
.kpi-card.clickable:focus-visible {
  outline: 2px solid var(--om-accent);
  outline-offset: 2px;
}
.kpi-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--om-accent);
  box-shadow: 0 0 12px var(--om-accent);
}
.tone-danger::before {
  background: var(--om-danger);
  box-shadow: 0 0 12px var(--om-danger);
}
.tone-warning::before {
  background: var(--om-warning);
  box-shadow: 0 0 12px var(--om-warning);
}
.tone-success::before {
  background: var(--om-success);
  box-shadow: 0 0 12px var(--om-success);
}
.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.kpi-label {
  font-size: 13px;
  color: var(--om-text-muted);
  letter-spacing: 0.5px;
}
.kpi-icon {
  font-size: 18px;
  opacity: 0.85;
}
.kpi-value {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--om-text);
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
}
.tone-danger .kpi-value {
  color: var(--om-danger);
}
.tone-warning .kpi-value {
  color: var(--om-warning);
}
.tone-success .kpi-value {
  color: var(--om-success);
}
.kpi-unit {
  font-size: 14px;
  margin-left: 4px;
  color: var(--om-text-muted);
  font-weight: 400;
}
.kpi-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  font-size: 12px;
  color: var(--om-text-muted);
}
.kpi-sub-item b {
  color: var(--om-text);
  font-weight: 600;
}
.kpi-sub-item b.danger {
  color: var(--om-danger);
}
.kpi-hint {
  margin-top: auto;
  font-size: 11px;
  color: var(--om-accent);
  opacity: 0.85;
}
</style>
