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

## Files

- `scripts/migrate/**`
- `src/lib/migration/**`
- `tests/migration/**`
- `docs/plan/v2-index.md`

## Steps

1. TDD Red：写真实数据格式的 fixture 测试，覆盖 SQLite 读取、图片 inventory、URL 重写、dry-run。
2. Run Red：运行 migration tests，预期因迁移模块不存在失败。
3. Green：实现 inventory、asset planner、Blob uploader、Supabase writer。
4. Run Green：迁移测试通过。
5. Refactor：拆分 source、planner、writer、reporter。
6. E2E：用 Linode 拉取数据跑 dry-run，再由用户确认后跑正式迁移。

## Risks

- Linode 图片路径与 HTML 引用不一致。
- 历史 HTML 存在破损标签。
- 大量图片上传中断，需要断点续跑。
- Vercel Blob 费用取决于历史图片总量和访问流量。

## Anti Cheat

不能用 `refs/` 样本数据证明 v2 完成；必须使用 Linode 拉取后的真实数据源和报告。

