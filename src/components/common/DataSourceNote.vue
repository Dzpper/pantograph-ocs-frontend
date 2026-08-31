<template>
  <el-alert
    class="data-source-note"
    :type="type"
    :closable="closable"
    show-icon
  >
    <template #title>{{ title }}</template>
    <slot>{{ message }}</slot>
  </el-alert>
</template>

<script>
export default {
  name: 'DataSourceNote',
  props: {
    title: { type: String, default: '数据来源说明' },
    message: { type: String, default: '' },
    type: { type: String, default: 'info' },
    closable: { type: Boolean, default: false },
  },
}
</script>

<style scoped>
.data-source-note {
  margin-bottom: 14px;
}
.data-source-note :deep(.el-alert__title) {
  font-size: 13px;
  font-weight: 600;
}
.data-source-note :deep(.el-alert__description) {
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
}
</style>
