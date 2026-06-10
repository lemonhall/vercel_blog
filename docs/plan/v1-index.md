# v1 Index: Vercel Blog Migration

## Vision

关联 PRD：[PRD-0001: Vercel Blog Migration](../prd/PRD-0001-vercel-blog-migration.md)

v1 目标是搭建可部署、可迁移、可编辑、可阅读的新博客基础版本。v1 不以 `refs/` 快照为全量事实来源；`refs/` 只作为旧结构样本和测试 fixture 的来源。

## Milestones

| Milestone | Scope | DoD | Verification | Status |
|---|---|---|---|---|
| M1 Foundation | Next.js/Vercel/Supabase Postgres/Blob 基础骨架 | 项目可构建，环境变量边界清楚，数据模型落地 | `npm run build`，schema 测试 | todo |
| M2 Editor Admin | 单人后台和富文本编辑 | 登录后可写文章、上传图片、保存 HTML | Playwright 后台流程 | todo |
| M3 Public Site | 公开首页、搜索和详情页 | 文章可读，搜索可用，图片/代码块响应式，HTML 安全渲染 | Playwright 阅读/搜索流程和截图检查 | todo |

## Plan Index

- [v1-foundation](./v1-foundation.md)
- [v1-editor-admin](./v1-editor-admin.md)
- [v1-public-site](./v1-public-site.md)

## Traceability Matrix

| Req ID | PRD | v1 Plan | Tests / Commands | Evidence | Status |
|---|---|---|---|---|---|
| REQ-0001-001 | PRD-0001 | v1-foundation | `npm run build`，schema/env 测试 | pending | todo |
| REQ-0001-002 | PRD-0001 | v1-foundation | schema tests，full migration moved to v2 | pending | v2 |
| REQ-0001-003 | PRD-0001 | v2-data-migration | moved to v2 by ECN-0003 | pending | v2 |
| REQ-0001-004 | PRD-0001 | v1-editor-admin | Playwright admin editor flow | pending | todo |
| REQ-0001-005 | PRD-0001 | v1-public-site | Playwright public reading flow | pending | todo |
| REQ-0001-006 | PRD-0001 | v1-foundation，v2-data-migration | secret scan，migration moved to v2 | pending | v2 |
| REQ-0001-007 | PRD-0001 | v1-public-site | post search tests，Playwright search flow | pending | todo |

## ECN Index

- [ECN-0001](../ecn/ECN-0001-supabase-and-search.md): 数据库锁定 Supabase，v1 加入 `LIKE` / `ILIKE` 基础全文搜索。
- [ECN-0002](../ecn/ECN-0002-defer-production-migration.md): 真实迁移延期到 Linode 数据拉取完成后，当前只建空表和辅助边界。
- [ECN-0003](../ecn/ECN-0003-migration-moved-to-v2.md): 所有迁移相关工作移入 v2，v1 只保留空表/schema。

## v1 Non Goals

- 不把 Flask-AppBuilder 权限表迁移为业务模型。
- 不把全部历史图片提交进仓库。
- 不在 v1 做评论系统、多主题切换、多人协作编辑。
- 不在 v1 引入外部搜索服务、中文分词、向量搜索。
- 不在 v1 执行迁移、编写迁移脚本或使用 `refs/` 做迁移验收。
- 不以当前 `refs/` 目录判断真实生产数据完整性。

## Doc QA Gate

- PRD 每条需求都有 Req ID、范围、非目标、验收口径：done。
- v1 每个计划均追溯到 Req ID：done。
- 每个计划都有验证命令和预期输出：done。
- 同一概念命名统一：`posts`、`assets`、`legacy_id`、`content_html`、`blob_url`。
- ECN-0001 已同步到 PRD 和 v1 计划：done。
- ECN-0002 已同步到 v1 计划：done。
- ECN-0003 已同步到 v1/v2 计划：done。

## Difference Log

- 真实迁移和所有迁移实现均移入 v2：根据 ECN-0003，等待 Linode 数据完整拉取后再做。
