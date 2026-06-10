# Agent 工作说明

## 项目范围

本仓库是柠檬叔个人博客的 Vercel 友好重写版。

v1 当前范围：

- 建立 Next.js / Supabase / Vercel Blob 应用骨架。
- 保留 Supabase 空表和 schema。
- 提供公开阅读页、基础 `ILIKE` 搜索、单人后台编辑和图片上传。

迁移范围：

- 所有生产迁移工作都属于 v2。
- 不要把 `refs/lemon_blog/app.db` 当作迁移验收依据。
- 不要把 `refs/` 当作生产真实数据源。
- 等 Linode 数据拉到本地后，再启动 v2 迁移。

## 必读文档

- PRD：`docs/prd/PRD-0001-vercel-blog-migration.md`
- v1 计划：`docs/plan/v1-index.md`
- v2 迁移计划：`docs/plan/v2-index.md`
- 环境变量指南：`docs/setup/vercel-supabase-env.md`
- ECN：`docs/ecn/`

如果实现改变范围，先更新 ECN 和计划文档，再继续写代码。

## 常用命令

使用 PowerShell 语法。

```powershell
npm install
npm test
npm run build
npm run e2e
```

E2E 的 fixture 环境变量由 Playwright 配置自动注入。

## Playwright 浏览器

- 默认使用用户本机已安装的 Chrome。
- Playwright 项目配置里设置 `channel: "chrome"`。
- 不要因为 Playwright 提示 bundled browser 缺失就要求下载浏览器。
- 如果报缺少 `chromium_headless_shell`，先切换系统 Chrome 再重跑。

## 文件与安全

- `refs/` 必须保持 git 忽略。
- 不要提交 `.env`、Supabase secret key、Blob token 或 APNs 密钥。
- 用户上传不要写入项目文件系统。
- 运行时图片上传只使用 Vercel Blob。
- 数据库使用 Supabase Postgres。

## 开发纪律

- 按 vN 计划和 Req ID 追溯推进。
- 优先先写测试，再写实现。
- 声称代码完成前，至少运行 `npm test` 和 `npm run build`。
- 涉及用户流程时运行 `npm run e2e`。
- 如果 E2E 因本地环境失败，要明确报告失败原因。

## 前端风格

参考 `E:\development\homestay`：

- 暖米色背景。
- 深墨色文字。
- 灰绿色强调色。
- serif 展示标题。
- 克制的表面、细线和柔和阴影。

博客首先要好读、耐看，不要做成营销首页。

