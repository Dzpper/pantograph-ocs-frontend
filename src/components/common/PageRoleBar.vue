<template>
  <div class="role-bar">
    <div class="role-now">
      <b>{{ current }}</b>
      <span>{{ role }}</span>
    </div>
    <div class="role-hops">
      <el-button
        v-for="h in hops"
        :key="h.page"
        link
        type="primary"
        @click="$emit('go', h)"
      >
        {{ h.label }} →
      </el-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PageRoleBar',
  props: {
    current: { type: String, default: '' },
    role: { type: String, default: '' },
    hops: { type: Array, default: () => [] },
  },
  emits: ['go'],
}
</script>

<style scoped>
.role-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--om-border, #e2e8f0);
  background: var(--om-panel-soft, #f8fafc);
}
.role-now {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.role-now b {
  font-size: 0.92rem;
  color: var(--om-text, #0f172a);
}
.role-now span {
  font-size: 0.78rem;
  color: var(--om-text-dim, #64748b);
  line-height: 1.45;
}
.role-hops {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
</style>
