# v2 Index: Production Data Migration

## Vision

关联 PRD：[PRD-0001: Vercel Blog Migration](../prd/PRD-0001-vercel-blog-migration.md)

v2 专门处理真实生产迁移。Linode 最新数据已通过 GitHub 分支 `linode-sync-20260610` 同步到本机，正式输入源为 `refs/lemon_blog_sync_latest`。

当前 inventory：

- SQLite：`refs/lemon_blog_sync_latest/app.db`
- 图片目录：`refs/lemon_blog_sync_latest/app/static/uploads`
- 文章表：`notes`
- 文章数量：668
- 图片文件：5166 个，约 1.16 GB
- 本地图片引用：5005 次，唯一引用 5002 个
- 本地引用缺失：0 个
- 未引用图片：164 个
- 外部图片 URL：40 个

## Milestones

| Milestone | Scope | DoD | Verification | Status |
|---|---|---|---|---|
| M1 Inventory | 盘点 SQLite、图片、本地引用和外部 URL | dry-run 报告包含文章 668、图片 5166、本地缺失 0、外部 URL 清单 | `npm run migrate -- --dry-run --report-only`，migration tests | doing |
| M2 Asset Upload | 上传历史图片到 Vercel Blob | 状态文件记录每个 asset 的 `pending/uploaded/failed/skipped`；重跑不重复上传已成功项 | asset upload tests，真实迁移日志 | todo |
| M3 Post Import | 导入文章并重写 HTML 图片 URL | `posts.legacy_id` 唯一；HTML 中 `/static/uploads/*` 全部重写为 Blob URL；重跑不重复文章 | import tests，Supabase probe | todo |
| M4 Migration Verification | 校验文章、图片、缺失和孤儿资源 | 输出 missing/orphan/failed/rewritten 报告；公开站点能读取导入文章 | migration verification，E2E | todo |

## Plan Index

- [v2-data-migration](./v2-data-migration.md)

## Traceability Matrix

| Req ID | PRD | v2 Plan | Tests / Commands | Evidence | Status |
|---|---|---|---|---|---|
| REQ-0001-002 | PRD-0001 | v2-data-migration | import tests，Supabase probe | pending | doing |
| REQ-0001-003 | PRD-0001 | v2-data-migration | asset upload/rewrite tests | pending | doing |
| REQ-0001-006 | PRD-0001 | v2-data-migration | dry-run tests，resume tests，report tests | pending | doing |

## ECN Index

- [ECN-0002](../ecn/ECN-0002-defer-production-migration.md): 真实迁移等待 Linode 数据。
- [ECN-0003](../ecn/ECN-0003-migration-moved-to-v2.md): 所有迁移相关工作移入 v2。
- [ECN-0004](../ecn/ECN-0004-linode-data-ready.md): Linode 真实数据已同步到 `refs/lemon_blog_sync_latest`。

## v2 Entry Conditions

- Linode SQLite 或生产数据库导出已在本地可读。
- Linode 图片目录或 manifest 已在本地可读。
- Vercel Blob token 和 Supabase service role key 已配置在本地环境变量中。
- 用户明确确认开始 v2 迁移。

## Difference Log

- 2026-06-10：Linode 数据已就绪；旧 `refs/lemon_blog` 快照继续保留但不参与本轮迁移。
- 2026-06-10：迁移必须支持断点续传，状态文件默认写入 `migration_state/v2-state.json`，报告写入 `migration_state/reports/`。
