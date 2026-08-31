# Pantograph-OCS Frontend

国创弓网数据及碳滑板磨耗分析平台 - 前端（独立项目）

基于 Vue3 + Element Plus + ECharts 构建。

## 快速开始

```bash
npm install
npm run dev
```

开发模式下 Vite 代理 `/api` 请求到后端（默认 `http://127.0.0.1:8000`），
通过 `.env.development` 中的 `VITE_API_BASE` 可修改后端地址。

## 构建生产版本

```bash
npm run build
```

产物在 `dist/`，用任意静态服务器部署，需在反向代理层将 `/api` 转发到后端。

## 项目结构

```
src/
├── api/          # API 请求客户端与缓存
├── components/   # 页面组件
│   └── common/   # 通用 UI 组件
├── config/       # 模块注册表
├── styles/       # 全局样式
└── utils/        # 工具函数
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_BASE` | `http://127.0.0.1:8000` | API 后端地址 |

此项目已从 [Pantograph-OCS-analysis](https://github.com/xxx/Pantograph-OCS-analysis) 分离，
需配合后端使用。
