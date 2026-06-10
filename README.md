# Vercel Blog

柠檬叔个人博客的 Vercel 友好重写版。

## 当前范围

v1 做：

- Next.js App Router + TypeScript。
- Supabase Postgres schema 空表。
- Vercel Blob 图片上传接口。
- 单人后台登录、TipTap 富文本编辑器、文章保存接口。
- 公开首页、文章详情页、数据库 `ILIKE` 搜索。
- Playwright fixture 模式，避免 E2E 依赖真实 Supabase。

v1 不做：

- 不执行历史数据迁移。
- 不使用 `refs/` 作为真实数据源。
- 不做评论、多主题、外部搜索服务、中文分词、向量搜索。

v2 做迁移：

- 等 Linode 数据完整拉取后，再按 [v2-index](./docs/plan/v2-index.md) 执行真实迁移。

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
- `search_posts(q text)`

## 本地开发

```powershell
npm install
npm run dev
```

打开：

- 公开站点：`http://127.0.0.1:3000/`
- 搜索页：`http://127.0.0.1:3000/search`
- 后台：`http://127.0.0.1:3000/admin`

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
supabase/schema.sql  Supabase schema
tests/               unit and e2e tests
docs/prd/            PRD
docs/plan/           v1/v2 plans
docs/ecn/            change notices
refs/                ignored legacy reference snapshot
```

## 迁移说明

`refs/` 是旧项目快照，只能用于结构参考。真实迁移必须等待 Linode 数据拉取完成后进入 v2，不要用当前 `refs/lemon_blog/app.db` 当作准数据源。
