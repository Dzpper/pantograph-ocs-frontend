import axios from 'axios'
import { cachedPost, cacheKey, getCached, setCached } from './cache'
import { clearAuth, getToken } from '../utils/auth'
import { normalizeLineList } from '../utils/lineDisplay'
import { downloadApiBlob } from '../utils/download'

const client = axios.create({
  baseURL: '/api',
  timeout: 120000,
})

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && !String(err.config?.url || '').includes('/auth/login')) {
      clearAuth()
      window.dispatchEvent(new CustomEvent('om-auth-expired'))
    }
    return Promise.reject(err)
  },
)

export async function fetchCaptcha() {
  const res = await client.get('/auth/captcha')
  return res.data
}

export async function login(username, password, captchaId, captchaCode) {
  const res = await client.post('/auth/login', {
    username,
    password,
    captcha_id: captchaId,
    captcha_code: captchaCode,
  })
  return res.data
}

export async function changePassword(oldPassword, newPassword) {
  const res = await client.post('/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  })
  return res.data
}

export async function fetchMe() {
  const res = await client.get('/auth/me')
  return res.data
}

export async function fetchAuthUsers() {
  const res = await client.get('/auth/users')
  return res.data.users || []
}

export async function fetchAuthLineOptions() {
  const res = await client.get('/auth/line-options')
  return normalizeLineList(res.data.lines || [])
}

export async function fetchImportLineOptions() {
  const res = await client.get('/auth/import-line-options')
  return normalizeLineList(res.data.lines || [])
}

export async function fetchLineRegistry(includeInactive = true) {
  const res = await client.get('/auth/lines/registry', {
    params: { include_inactive: includeInactive },
  })
  return res.data.lines || []
}

export async function fetchLineRegistryDetail(registryId) {
  const res = await client.get(`/auth/lines/registry/${registryId}`)
  return res.data.line
}

export async function updateLineRegistry(registryId, payload) {
  const res = await client.put(`/auth/lines/registry/${registryId}`, payload)
  return res.data
}

export async function setLineRegistryActive(registryId, isActive) {
  const res = await client.patch(`/auth/lines/registry/${registryId}/active`, { is_active: isActive })
  return res.data
}

export async function deleteLineRegistry(registryId) {
  const res = await client.delete(`/auth/lines/registry/${registryId}`)
  return res.data
}

export async function fetchLinePresets() {
  const res = await client.get('/auth/lines/presets')
  return res.data.presets || []
}

export async function previewOpenLine(payload) {
  const res = await client.post('/auth/lines/preview', payload)
  return res.data
}

export async function openLineSimple(payload) {
  const res = await client.post('/auth/lines/open-simple', payload)
  return res.data
}

export async function suggestLineCodes(payload) {
  const res = await client.post('/auth/lines/suggest-codes', payload)
  return res.data
}

export async function openLine(payload) {
  const res = await client.post('/auth/lines/open', payload)
  return res.data
}

export async function openLinePreset(presetKey) {
  const res = await client.post('/auth/lines/open-preset', { preset_key: presetKey })
  return res.data
}

export async function createMonitorStaging(payload) {
  const res = await client.post('/auth/import/monitor/staging', payload)
  return res.data
}

export async function uploadMonitorStagingFiles(stagingId, files) {
  const form = new FormData()
  for (const f of files) {
    form.append('files', f, f.name)
    form.append('relative_paths', f.webkitRelativePath || f.name)
  }
  const res = await client.post(`/auth/import/monitor/staging/${stagingId}/files`, form, {
    timeout: 600000,
  })
  return res.data
}

export async function downloadMonitorImportTemplate() {
  return downloadApiBlob(client, '/auth/import/monitor/template', 'monitor_import_template.xlsx')
}

export async function runMonitorSnapshot(monitorCode) {
  const res = await client.post('/auth/import/monitor/snapshot', { monitor_code: monitorCode })
  return res.data
}

export async function fetchMonitorBatches(registryId, params = {}) {
  const res = await client.get(`/auth/lines/registry/${registryId}/monitor-batches`, { params })
  return res.data
}

export async function deleteMonitorBatches(registryId, batchIds) {
  const res = await client.post(`/auth/lines/registry/${registryId}/monitor-batches/delete`, {
    batch_ids: batchIds,
  })
  return res.data
}

export async function runMonitorImport(payload) {
  const res = await client.post('/auth/import/monitor/run', payload)
  return res.data
}

export async function fetchImportJob(jobId) {
  const res = await client.get(`/auth/import/jobs/${jobId}`)
  return res.data
}

export async function createAuthUser(payload) {
  const res = await client.post('/auth/users', payload)
  return res.data
}

export async function updateAuthUser(userId, payload) {
  const res = await client.put(`/auth/users/${userId}`, payload)
  return res.data
}

export async function deleteAuthUser(userId) {
  const res = await client.delete(`/auth/users/${userId}`)
  return res.data
}

export async function bulkSetAuthUserActive(userIds, isActive) {
  const res = await client.post('/auth/users/bulk-active', { user_ids: userIds, is_active: isActive })
  return res.data
}

export async function fetchOpLogs(params = {}) {
  const res = await client.get('/auth/op-logs', { params })
  return res.data
}

export async function fetchImportJobs(params = {}) {
  const res = await client.get('/auth/import/jobs', { params })
  return res.data.jobs || []
}

export async function fetchLines() {
  const res = await client.get('/lines')
  return normalizeLineList(res.data.lines || [])
}

export async function fetchDates(lineId, direction) {
  const res = await client.get('/dates', { params: { line_id: lineId, direction } })
  return {
    dates: res.data.dates || [],
    dateMeta: res.data.date_meta || {},
    mergeNote: res.data.merge_note || '',
  }
}

export async function fetchMetrics() {
  const res = await client.get('/metrics')
  return res.data.metrics || []
}

export async function postComparison(payload, options) {
  return cachedPost(client, '/comparison', payload, options)
}

export async function postArcAnalysis(payload, options) {
  return cachedPost(client, '/arc-analysis', payload, options)
}

export async function postWarning(payload, options) {
  return cachedPost(client, '/warning', payload, options)
}

/** 速度-燃弧：仅区间列表（轻量） */
export async function fetchSpeedArcMeta(payload) {
  const key = cacheKey('/speed-arc-meta', payload)
  const hit = getCached(key)
  if (hit) return hit
  const data = await cachedPost(client, '/speed-arc', { ...payload, segment_index: null })
  setCached(key, data)
  return data
}

/** 速度-燃弧：单个区间图表数据 */
export async function fetchSpeedArcSegment(payload, segmentIndex) {
  const req = { ...payload, segment_index: segmentIndex }
  return cachedPost(client, '/speed-arc', req)
}

export async function postAlarmOverview(payload, options) {
  return cachedPost(client, '/alarm/overview', payload, options)
}

export async function postAlarmPoleDetail(payload) {
  const res = await client.post('/alarm/pole-detail', payload)
  return res.data
}

export async function fetchMetaLines() {
  const res = await client.get('/meta/lines')
  return res.data.lines || []
}

export async function fetchMetaDomains() {
  const res = await client.get('/meta/domains')
  return res.data.domains || []
}

export async function fetchMetaStations(lineId, direction = '上行') {
  const res = await client.get('/meta/stations', { params: { line_id: lineId, direction } })
  return res.data
}

export async function postInspectionReport(payload) {
  const res = await client.post('/owner/inspection-report', payload)
  return res.data
}

/** 碳滑板磨耗 */
export async function fetchStripWearLines() {
  const res = await client.get('/strip-wear/lines')
  return normalizeLineList(res.data.lines || [])
}

export async function fetchStripWearVehicles(lineCode) {
  const res = await client.get('/strip-wear/vehicles', { params: { line_code: lineCode } })
  return res.data.vehicles || []
}

export async function fetchStripWearBatches(lineCode = '', limit = 50) {
  const res = await client.get('/strip-wear/batches', { params: { line_code: lineCode, limit } })
  return res.data.batches || []
}

export async function previewStripWearSheets(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await client.post('/strip-wear/preview-sheets', form)
  return res.data
}

export async function downloadStripWearImportTemplate(lineCode = '') {
  await downloadApiBlob(
    client.get('/strip-wear/import-template', {
      params: lineCode ? { line_code: lineCode } : {},
      responseType: 'blob',
    }),
    '碳滑板磨耗导入模板.xlsx',
  )
}

export async function importStripWearExcel(file, options = {}) {
  const form = new FormData()
  form.append('file', file)
  if (options.line_code) form.append('line_code', options.line_code)
  if (options.line_name) form.append('line_name', options.line_name)
  if (options.sheet_name) form.append('sheet_name', options.sheet_name)
  form.append('replace_line_data', options.replace_line_data ? 'true' : 'false')
  const res = await client.post('/strip-wear/import', form)
  return res.data
}

export async function postStripWearDashboard(payload) {
  const res = await client.post('/strip-wear/dashboard', payload)
  return res.data
}

export async function fetchStripWearVehicleTrend(params) {
  const res = await client.get('/strip-wear/vehicle-trend', { params })
  return res.data
}

export async function postStripWearPredict(payload) {
  const res = await client.post('/strip-wear/predict', payload)
  return res.data
}

export async function fetchStripWearMeasurements(params) {
  const res = await client.get('/strip-wear/measurements', { params })
  return res.data
}

export async function createStripWearMeasurement(payload) {
  const res = await client.post('/strip-wear/measurements', payload)
  return res.data
}

export async function updateStripWearMeasurement(id, payload) {
  const res = await client.put(`/strip-wear/measurements/${id}`, payload)
  return res.data
}

export async function deleteStripWearMeasurement(id) {
  const res = await client.delete(`/strip-wear/measurements/${id}`)
  return res.data
}

export async function deleteStripWearMeasurements(payload) {
  const res = await client.post('/strip-wear/measurements/delete', payload)
  return res.data
}

/** 隧道温湿度 */
export async function fetchClimateLines() {
  const res = await client.get('/climate/lines')
  return normalizeLineList(res.data.lines || [])
}

export async function fetchClimateBatches(lineCode = '', limit = 50) {
  const res = await client.get('/climate/batches', { params: { line_code: lineCode, limit } })
  return res.data.batches || []
}

export async function previewClimateSheets(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await client.post('/climate/preview-sheets', form)
  return res.data
}

export async function downloadClimateImportTemplate(lineCode = '') {
  await downloadApiBlob(
    client.get('/climate/import-template', {
      params: lineCode ? { line_code: lineCode } : {},
      responseType: 'blob',
    }),
    '隧道温湿度导入模板.xlsx',
  )
}

export async function previewClimateData(file, options = {}) {
  const form = new FormData()
  form.append('file', file)
  if (options.line_code) form.append('line_code', options.line_code)
  if (options.sheet_name) form.append('sheet_name', options.sheet_name)
  form.append('preview_limit', String(options.preview_limit || 30))
  const res = await client.post('/climate/preview-data', form)
  return res.data
}

export async function importClimateExcel(file, options = {}) {
  const form = new FormData()
  form.append('file', file)
  if (options.line_code) form.append('line_code', options.line_code)
  if (options.sheet_name) form.append('sheet_name', options.sheet_name)
  form.append('replace_line_data', options.replace_line_data ? 'true' : 'false')
  const res = await client.post('/climate/import', form)
  return res.data
}

export async function postClimateDashboard(payload) {
  const res = await client.post('/climate/dashboard', payload)
  return res.data
}

export async function deleteClimateLine(lineCode) {
  const res = await client.post('/climate/delete', { line_code: lineCode, ids: [] })
  return res.data
}

export async function fetchClimateDaily(params) {
  const res = await client.get('/climate/daily', { params })
  return res.data
}

export async function createClimateDaily(payload) {
  const res = await client.post('/climate/daily', payload)
  return res.data
}

export async function updateClimateDaily(id, payload) {
  const res = await client.put(`/climate/daily/${id}`, payload)
  return res.data
}

export async function deleteClimateDaily(id) {
  const res = await client.delete(`/climate/daily/${id}`)
  return res.data
}

export async function deleteClimateDailyBatch(payload) {
  const res = await client.post('/climate/daily/delete', payload)
  return res.data
}

/** 综合分析：燃弧 KPI / 分型 / 相关性诊断 */
export async function postArcKpi(payload) {
  const res = await client.post('/arc/kpi', payload)
  return res.data
}

export async function postArcTyping(payload) {
  const res = await client.post('/arc/typing', payload)
  return res.data
}

export async function postCorrelationDiagnose(payload) {
  const res = await client.post('/correlation/diagnose', payload)
  return res.data
}

export default client
