# ECN-0004: Linode 真实数据已就绪

## 基本信息

- **ECN 编号**：ECN-0004
- **关联 PRD**：PRD-0001
- **关联 Req ID**：REQ-0001-002、REQ-0001-003、REQ-0001-006
- **发现阶段**：v2-data-migration 启动前 inventory
- **日期**：2026-06-10

## 变更原因

Linode 端最新 SQLite 与图片目录已经通过 GitHub 分支 `linode-sync-20260610` 同步到本机，路径为 `refs/lemon_blog_sync_latest`。v2 不再处于等待状态，可以进入真实数据迁移执行。

## 变更内容

### 原设计

v2 计划写明“等待 Linode 数据”，并禁止把旧 `refs/lemon_blog` 快照作为正式迁移依据。

### 新设计

`refs/lemon_blog_sync_latest` 是 2026-06-10 从 Linode 同步的新数据快照，可作为本轮 v2 的正式输入源。迁移必须支持 dry-run、断点续传和幂等重跑，任何写入 Vercel Blob 或 Supabase 的步骤都必须记录到本地状态文件。

## 影响范围

- 受影响的 Req ID：REQ-0001-002、REQ-0001-003、REQ-0001-006
- 受影响的 vN 计划：`docs/plan/v2-index.md`、`docs/plan/v2-data-migration.md`
- 受影响的测试：`tests/migration/**`
- 受影响的代码文件：`scripts/migrate/**`、`src/lib/migration/**`

## 处置方式

- [x] PRD 约束保持有效：旧 `refs/lemon_blog` 仍不是正式输入。
- [x] v2 计划同步更新到 `refs/lemon_blog_sync_latest`。
- [x] 追溯矩阵同步更新。
- [ ] 相关测试随迁移实现补齐。
