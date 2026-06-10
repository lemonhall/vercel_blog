# v2 Index: Production Data Migration

## Vision

关联 PRD：[PRD-0001: Vercel Blog Migration](../prd/PRD-0001-vercel-blog-migration.md)

v2 专门处理真实生产迁移。启动前置条件是 Linode 上的数据库、图片目录或图片清单已经完整拉取到本地，并明确路径。

## Milestones

| Milestone | Scope | DoD | Verification | Status |
|---|---|---|---|---|
| M1 Inventory | 盘点 SQLite、Linode 图片、本地图片和远程 URL | 输出完整 inventory 报告，不以 `refs/` 为准 | inventory report tests | blocked |
| M2 Asset Upload | 上传历史图片到 Vercel Blob | 幂等上传，失败可重跑，输出 mapping | asset upload tests | blocked |
| M3 Post Import | 导入文章并重写 HTML 图片 URL | `posts.legacy_id` 唯一，HTML URL 全部按 mapping 重写 | import tests | blocked |
| M4 Migration Verification | 校验文章、图片、缺失和孤儿资源 | 输出 missing/orphan/failed/rewritten 报告 | migration E2E | blocked |

## Plan Index

- [v2-data-migration](./v2-data-migration.md)

## Traceability Matrix

| Req ID | PRD | v2 Plan | Tests / Commands | Evidence | Status |
|---|---|---|---|---|---|
| REQ-0001-002 | PRD-0001 | v2-data-migration | migration import tests | pending | blocked |
| REQ-0001-003 | PRD-0001 | v2-data-migration | asset upload/rewrite tests | pending | blocked |
| REQ-0001-006 | PRD-0001 | v2-data-migration | dry-run tests，report tests | pending | blocked |

## ECN Index

- [ECN-0002](../ecn/ECN-0002-defer-production-migration.md): 真实迁移等待 Linode 数据。
- [ECN-0003](../ecn/ECN-0003-migration-moved-to-v2.md): 所有迁移相关工作移入 v2。

## v2 Entry Conditions

- Linode SQLite 或生产数据库导出已在本地可读。
- Linode 图片目录或 manifest 已在本地可读。
- Vercel Blob token 和 Supabase service role key 已配置在本地环境变量中。
- 用户明确确认开始 v2 迁移。

## Difference Log

v2 尚未开始，等待 Linode 数据。

