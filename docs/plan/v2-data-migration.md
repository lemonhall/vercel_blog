# v2 Data Migration Plan

## Goal

从真实 Linode 数据源迁移历史文章和图片到 Supabase Postgres + Vercel Blob，保证可 dry-run、可重跑、可校验、可追溯。

## PRD Trace

- REQ-0001-002
- REQ-0001-003
- REQ-0001-006

## Scope

做：

- 读取真实 SQLite 或生产数据库导出。
- 读取 Linode 图片目录、URL 清单或 manifest。
- 扫描历史 HTML 中的图片引用。
- 上传图片到 Vercel Blob。
- 写入 `assets` 和 `post_assets`。
- 导入文章到 `posts`，保留 `legacy_id`。
- 重写 `content_html` 中的图片 URL。
- 输出 missing、orphan、failed、rewritten 报告。
- 支持 dry-run 和幂等重跑。
- 支持断点续传：状态文件记录每张图片、每篇文章和每个关联关系的处理结果。
- 支持正式迁移分阶段执行：inventory、upload-assets、import-posts、verify。

不做：

- 不使用 `refs/` 快照作为正式迁移依据。
- 不删除 Linode 原始数据。
- 不在未确认的情况下修改生产域名或 DNS。
- 不在 v2 做图片压缩、AI 修复或内容重写。

## Acceptance

- dry-run 不写 Supabase 和 Blob。
- 同一输入重复执行不会产生重复文章或重复资产。
- 每个被重写的图片 URL 都能追溯到 `assets`。
- 所有失败项都出现在迁移报告中。
- 迁移后公开站点能读取导入文章。
- 中断后重跑命令，只处理状态文件中未完成或失败重试的项目。
- 状态文件损坏或输入源变化时，命令必须拒绝继续并给出明确错误。

## Resume Design

默认状态目录：

```text
migration_state/
  v2-state.json
  reports/
    inventory.json
    dry-run.json
    upload-assets.json
    import-posts.json
    verify.json
```

状态粒度：

- `sourceFingerprint`：记录 SQLite 文件大小、mtime、图片目录文件数量和总大小。
- `assets[legacyPath]`：记录 `sha256`、`size`、`contentType`、`blobPathname`、`blobUrl`、`status`、`attempts`、`error`。
- `posts[legacyId]`：记录 `slug`、`status`、`rewrittenImageCount`、`missingImageCount`、`error`。
- `postAssets[legacyId|legacyPath]`：记录文章和图片关联是否已写入。

重跑规则：

- `uploaded`、`imported`、`linked` 项默认跳过。
- `failed` 项默认重试，超过 `--max-attempts` 后保持失败并进入报告。
- `--force` 只重新计算计划，不删除 Blob 或 Supabase 记录。
- Blob pathname 固定为 `legacy/uploads/<文件名>`，避免随机后缀导致重复上传。
- Supabase 文章按 `legacy_id` upsert，assets 按 `legacy_path` upsert。

## Files

- `scripts/migrate/**`
- `src/lib/migration/**`
- `tests/migration/**`
- `docs/plan/v2-index.md`

## Steps

1. TDD Red：写真实数据格式的 fixture 测试，覆盖 SQLite 读取、图片 inventory、URL 重写、dry-run、断点续传。
2. Run Red：运行 migration tests，预期因迁移模块不存在失败。
3. Green：实现 inventory、asset planner、state store、Blob uploader、Supabase writer。
4. Run Green：迁移测试通过。
5. Refactor：拆分 source、planner、writer、reporter。
6. E2E：用 Linode 拉取数据跑 dry-run，再由用户确认后跑正式迁移。

## Commands

```powershell
npm run migrate -- --source refs/lemon_blog_sync_latest --dry-run
npm run migrate -- --source refs/lemon_blog_sync_latest --phase upload-assets
npm run migrate -- --source refs/lemon_blog_sync_latest --phase import-posts
npm run migrate -- --source refs/lemon_blog_sync_latest --phase verify
```

## Risks

- Linode 图片路径与 HTML 引用不一致。
- 历史 HTML 存在破损标签。
- 大量图片上传中断，需要断点续跑。
- Vercel Blob 费用取决于历史图片总量和访问流量。
- 旧 HTML 中存在 `blog.lemonhall.me/static/uploads/*`，需要按文件名映射到本地图片后再重写。

## Anti Cheat

不能用 `refs/` 样本数据证明 v2 完成；必须使用 Linode 拉取后的真实数据源和报告。
