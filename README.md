# Vercel Blog

柠檬叔个人博客的 Vercel 友好重写版。

## 当前范围

当前代码已完成 v1-v5 主链路：

- Next.js App Router + TypeScript。
- Supabase Postgres schema，包含文章、资产、食谱 tags。
- Vercel Blob 图片上传接口。
- 单人后台登录、TipTap 富文本编辑器、草稿管理、文章保存接口。
- 公开首页、文章详情页、数据库 `ILIKE` 搜索、分页、排序、宽模式。
- 前台管理员编辑入口和逻辑删除，删除只把文章降为草稿。
- `/recipes` 食谱频道、食谱 tags 云、tag 多选 AND 过滤和食谱内搜索。
- 迁移 CLI 支持 Linode 同步快照 inventory、图片上传、文章导入和 dry-run 报告。
- Playwright fixture 模式，避免 E2E 依赖真实 Supabase。

当前仍不做：

- 不使用 `refs/` 作为真实数据源。
- 不做评论、多主题、外部搜索服务、中文分词、向量搜索。
- 不物理删除文章行。

迁移边界：

- 旧 `refs/lemon_blog` 只做结构参考。
- 真实迁移输入源是 `refs/lemon_blog_sync_latest`，详见 [v2-index](./docs/plan/v2-index.md)。
- 食谱识别结果由 AI 阅读正文后生成 JSONL，再通过导入链路写入 `content_kind` 和 tags，不能用关键词规则替代。

## 技术栈

- Next.js 15
- React 19
- Supabase Postgres
- Vercel Blob
- TipTap
- Vitest
- Playwright

## 环境变量

完整配置指南见：[Vercel 与 Supabase 环境变量配置指南](./docs/setup/vercel-supabase-env.md)。

本地创建 `.env`：

```powershell
Copy-Item .env.example .env
```

## Supabase 初始化

在 Supabase SQL Editor 中执行：

```text
supabase/schema.sql
```

该 schema 创建：

- `posts`
- `assets`
- `post_assets`
- `tags`
- `post_tags`
- `search_posts(q text)`
- `save_post_tags(...)`
- `list_recipe_tags()`
- `list_recipe_posts_by_tag(tag_slug text)`
- `list_recipe_posts_by_tags(tag_slugs text[])`
- `search_recipe_posts_by_tags(q text, tag_slugs text[])`
- `list_tags_for_post(target_post_id uuid)`

## 本地开发

```powershell
npm install
npm run dev
```

打开：

- 公开站点：`http://127.0.0.1:3000/`
- 搜索页：`http://127.0.0.1:3000/search`
- 食谱频道：`http://127.0.0.1:3000/recipes`
- 后台：`http://127.0.0.1:3000/admin`

## 迁移命令

默认源为 `refs/lemon_blog_sync_latest`，状态写入 `migration_state/v2-state.json`，报告写入 `migration_state/reports/`。

```powershell
npm run migrate -- --dry-run --report-only
npm run migrate -- --phase upload-assets
npm run migrate -- --phase import-posts
npm run migrate -- --phase verify
```

真实上传和导入需要 `.env` 中配置 `BLOB_READ_WRITE_TOKEN`、`SUPABASE_DEV_URL` 和 `SUPABASE_DEV_SECRET_KEY`。

## 验证

```powershell
npm test
npm run build
npm run e2e
```

E2E 通过 `USE_FIXTURE_DATA=1` 使用内置测试文章，不依赖真实 Supabase 数据。

## 目录

```text
app/                 Next.js routes
src/components/      UI components
src/lib/             env/auth/html/posts/supabase helpers
scripts/migrate/     Linode data migration CLI
supabase/schema.sql  Supabase schema
tests/               unit and e2e tests
docs/prd/            PRD
docs/plan/           v1-v5 plans
docs/ecn/            change notices
refs/                ignored legacy reference snapshot
migration_state/     ignored-style migration state and reports
```

## 迁移说明

`refs/` 是旧项目快照，只能用于结构参考。真实迁移必须等待 Linode 数据拉取完成后进入 v2，不要用当前 `refs/lemon_blog/app.db` 当作准数据源。
