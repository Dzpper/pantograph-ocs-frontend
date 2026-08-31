<template>
  <div class="login-page">
    <div class="login-card om-panel">
      <div class="brand">
        <img src="/logo.png" alt="国创" class="logo" />
        <h1>国创弓网数据及碳滑板磨耗分析</h1>
        <p>请登录后使用系统</p>
      </div>
      <el-form
        class="login-form"
        label-position="top"
        @submit.prevent="submit"
      >
        <el-form-item label="用户名" class="login-field">
          <el-input
            v-model="username"
            size="large"
            autocomplete="username"
            placeholder="请输入用户名"
            clearable
          />
        </el-form-item>
        <el-form-item label="密码" class="login-field">
          <el-input
            v-model="password"
            size="large"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="验证码" class="login-field">
          <div class="captcha-row">
            <el-input
              v-model="captchaCode"
              size="large"
              maxlength="8"
              autocomplete="off"
              placeholder="请输入验证码"
              @keyup.enter="submit"
            />
            <button type="button" class="captcha-img" title="点击刷新验证码" @click="loadCaptcha">
              <img v-if="captchaImage" :src="captchaImage" alt="验证码" />
              <span v-else class="captcha-loading">加载中</span>
            </button>
          </div>
        </el-form-item>
        <el-button type="primary" class="submit-btn" size="large" :loading="loading" @click="submit">
          登录
        </el-button>
      </el-form>
      <p class="hint">
        默认管理员：admin / Admin@123。若清空过用户表，需重启后端后使用此默认密码。
      </p>
    </div>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchCaptcha, login } from '../api/client'
import { setAuth } from '../utils/auth'

export default {
  name: 'LoginPage',
  emits: ['success'],
  setup(props, { emit }) {
    const username = ref('')
    const password = ref('')
    const captchaId = ref('')
    const captchaCode = ref('')
    const captchaImage = ref('')
    const loading = ref(false)

    async function loadCaptcha() {
      captchaCode.value = ''
      captchaImage.value = ''
      try {
        const data = await fetchCaptcha()
        captchaId.value = data.captcha_id
        captchaImage.value = data.image
      } catch {
        ElMessage.error('验证码加载失败，请检查后端服务')
      }
    }

    async function submit() {
      if (!username.value || !password.value) {
        ElMessage.warning('请输入用户名和密码')
        return
      }
      if (!captchaId.value || !captchaCode.value) {
        ElMessage.warning('请输入验证码')
        return
      }
      loading.value = true
      try {
        const data = await login(
          username.value,
          password.value,
          captchaId.value,
          captchaCode.value,
        )
        setAuth(data.token, data.user)
        emit('success', data.user)
      } catch (e) {
        ElMessage.error(e?.response?.data?.detail || '登录失败')
        await loadCaptcha()
      } finally {
        loading.value = false
      }
    }

    onMounted(loadCaptcha)

    return {
      username,
      password,
      captchaCode,
      captchaImage,
      loading,
      loadCaptcha,
      submit,
    }
  },
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #ecfeff 100%);
  padding: 24px 16px;
}
.login-card {
  width: 100%;
  max-width: 420px;
  padding: 28px 24px 22px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
}
.brand { text-align: center; margin-bottom: 24px; }
.logo { width: 56px; height: 56px; object-fit: contain; }
.brand h1 { margin: 12px 0 6px; font-size: 1.05rem; font-weight: 650; color: #0f172a; line-height: 1.4; }
.brand p { margin: 0; font-size: 0.88rem; color: #64748b; }
.login-form { width: 100%; }
.login-form :deep(.el-form-item) { margin-bottom: 16px; }
.login-form :deep(.el-form-item__label) {
  padding: 0 0 6px;
  line-height: 1.4;
  font-size: 0.88rem;
  font-weight: 500;
  color: #334155;
}
.login-form :deep(.el-input),
.login-form :deep(.el-input__wrapper) {
  width: 100%;
  box-sizing: border-box;
}
.login-field { width: 100%; }
.captcha-row {
  display: flex;
  gap: 10px;
  width: 100%;
  align-items: center;
}
.captcha-row :deep(.el-input) {
  flex: 1;
  min-width: 0;
}
.captcha-img {
  flex: 0 0 120px;
  height: 44px;
  padding: 0;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  overflow: hidden;
}
.captcha-img img {
  width: 100%;
  height: 100%;
  display: block;
}
.captcha-loading {
  font-size: 12px;
  color: #94a3b8;
}
.submit-btn {
  width: 100%;
  margin-top: 4px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.hint { margin: 16px 0 0; font-size: 0.75rem; color: #94a3b8; text-align: center; line-height: 1.5; }
</style>
