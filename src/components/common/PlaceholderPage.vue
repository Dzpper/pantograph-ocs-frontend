<template>
  <div class="placeholder-page">
    <div class="ph-icon">{{ icon || '🚧' }}</div>
    <h2>{{ title }}</h2>
    <p>{{ description || '该模块正在规划中，敬请期待。' }}</p>
    <p class="ph-hint" v-if="hint">{{ hint }}</p>
  </div>
</template>

<script>
export default {
  name: 'PlaceholderPage',
  props: {
    title: { type: String, default: '即将上线' },
    description: { type: String, default: '' },
    hint: { type: String, default: '' },
    icon: { type: String, default: '' },
  },
}
</script>

<style scoped>
.placeholder-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 70vh;
  text-align: center;
  color: var(--om-text-muted);
}
.ph-icon {
  font-size: 56px;
  margin-bottom: 16px;
  opacity: 0.7;
}
h2 {
  color: var(--om-text);
  font-weight: 600;
  margin: 0 0 8px;
}
p {
  margin: 4px 0;
}
.ph-hint {
  color: var(--om-text-dim);
  font-size: 13px;
}
</style>
