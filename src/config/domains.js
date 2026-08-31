/** 数据域通用配置（Web 模块化） */
export const domains = [
  {
    key: 'monitor',
    label: '弓网检测',
    codeField: 'monitor_code',
    importMode: 'pipeline',
    apiPrefix: '/api',
  },
  {
    key: 'strip',
    label: '碳滑板磨耗',
    codeField: 'strip_code',
    importMode: 'upload',
    apiPrefix: '/api/strip-wear',
  },
  {
    key: 'climate',
    label: '隧道温湿度',
    codeField: 'strip_code',
    importMode: 'upload',
    apiPrefix: '/api/climate',
  },
]

export function domainByKey(key) {
  return domains.find((d) => d.key === key)
}
