<template>
  <el-dialog
    v-model="visible"
    title="修改密码"
    width="420px"
    :close-on-click-modal="false"
    @closed="resetForm"
  >
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="原密码">
        <el-input
          v-model="oldPassword"
          type="password"
          show-password
          autocomplete="current-password"
          placeholder="请输入当前密码"
        />
      </el-form-item>
      <el-form-item label="新密码">
        <el-input
          v-model="newPassword"
          type="password"
          show-password
          autocomplete="new-password"
          placeholder="至少 6 位"
        />
      </el-form-item>
      <el-form-item label="确认新密码">
        <el-input
          v-model="confirmPassword"
          type="password"
          show-password
          autocomplete="new-password"
          placeholder="再次输入新密码"
          @keyup.enter="submit"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { changePassword } from '../api/client'

export default {
  name: 'ChangePasswordDialog',
  props: {
    modelValue: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'success'],
  setup(props, { emit }) {
    const visible = ref(false)
    const oldPassword = ref('')
    const newPassword = ref('')
    const confirmPassword = ref('')
    const loading = ref(false)

    watch(
      () => props.modelValue,
      (v) => {
        visible.value = v
      },
      { immediate: true },
    )

    watch(visible, (v) => {
      emit('update:modelValue', v)
    })

    function resetForm() {
      oldPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      loading.value = false
    }

    async function submit() {
      if (!oldPassword.value || !newPassword.value) {
        ElMessage.warning('请填写原密码和新密码')
        return
      }
      if (newPassword.value.length < 6) {
        ElMessage.warning('新密码至少 6 位')
        return
      }
      if (newPassword.value !== confirmPassword.value) {
        ElMessage.warning('两次输入的新密码不一致')
        return
      }
      loading.value = true
      try {
        await changePassword(oldPassword.value, newPassword.value)
        ElMessage.success('密码已修改，请妥善保管')
        visible.value = false
        emit('success')
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || '修改失败')
      } finally {
        loading.value = false
      }
    }

    return {
      visible,
      oldPassword,
      newPassword,
      confirmPassword,
      loading,
      resetForm,
      submit,
    }
  },
}
</script>
