# Agent 工作说明

## 项目范围

本仓库是柠檬叔个人博客的 Vercel 友好重写版。

当前代码范围已经推进到 v5：

- v1：Next.js / Supabase / Vercel Blob 应用骨架、公开阅读页、基础 `ILIKE` 搜索、单人后台编辑和图片上传。
- v2：Linode 真实数据迁移链路，默认输入源为 `refs/lemon_blog_sync_latest`，迁移状态写入 `migration_state/v2-state.json`。
- v3：公开首页分页、排序、宽模式、footer、前台管理员编辑入口和逻辑删除。
- v4：TipTap 富文本编辑器升级，支持常用格式、图片、表格、代码块、sticky 工具栏和移动端适配。
- v5：食谱频道、`content_kind`、`tags` / `post_tags`、食谱 tag 云、tag 过滤页、食谱内搜索和 AI JSONL 标注导入链路。
- v6：Vercel AI Gateway 食谱卡路里估算、估算结果持久化、食谱列表最终 kcal 展示、详情页食材明细展示、存量食谱本地 JSONL 估算导入。

迁移范围：

- 不要把旧 `refs/lemon_blog/app.db` 当作迁移验收依据。
- 不要把旧 `refs/` 快照当作生产真实数据源。
- 真实迁移以 `refs/lemon_blog_sync_latest` 为输入，详见 `docs/plan/v2-index.md`。
- 上传和导入真实数据前，必须确认 `.env` 中有 `BLOB_READ_WRITE_TOKEN`、`SUPABASE_DEV_URL`、`SUPABASE_DEV_SECRET_KEY`。
- 食谱初始化标注必须来自 AI 阅读正文后的 JSONL；禁止用关键词规则、正则或纯程序分类替代 AI 判断。
- 在线食谱卡路里估算使用 `AI_GATEWAY_API_KEY` 和普通 `openai/gpt-5.5`；不得使用 `openai/gpt-5.5-pro`，不得把 key 暴露到前端。
- 存量食谱卡路里回填使用本地 JSONL 估算导入，不消耗 Vercel AI Gateway tokens；导入必须幂等并保留明细。

## 必读文档

- PRD：`docs/prd/PRD-0001-vercel-blog-migration.md`
- v1 计划：`docs/plan/v1-index.md`
- v2 迁移计划：`docs/plan/v2-index.md`
- v3 前台体验计划：`docs/plan/v3-index.md`
- v4 编辑器计划：`docs/plan/v4-index.md`
- v5 食谱 tags 计划：`docs/plan/v5-index.md`
- v6 食谱卡路里计划：`docs/plan/v6-index.md`
- 环境变量指南：`docs/setup/vercel-supabase-env.md`
- ECN：`docs/ecn/`

如果实现改变范围，先更新 ECN 和计划文档，再继续写代码。

## 常用命令

使用 PowerShell 语法。

```powershell
npm install
npm run dev
npm run vercel -- --version
supabase --version
npm test
npx tsc --noEmit
npm run build
npm run e2e
```

E2E 的 fixture 环境变量由 Playwright 配置自动注入。

迁移命令：

```powershell
npm run migrate -- --dry-run --report-only
npm run migrate -- --phase upload-assets
npm run migrate -- --phase import-posts
npm run migrate -- --phase verify
```

默认迁移源为 `refs/lemon_blog_sync_latest`。不要对 `refs/` 执行删除、移动或清理，除非用户明确要求。

CLI 工具：

- Supabase CLI 在 Windows 上通过 Scoop 安装，直接用 `supabase ...`。
- Vercel CLI 是项目 devDependency，通过 `npm run vercel -- ...` 调用。
- 登录类命令会打开浏览器授权，不要要求用户把账号密码或 token 发到聊天里。
- 当前 Supabase 项目 ref 是 `zlscvciucppvsrorwzjt`；执行远端 schema 可用 `supabase link --project-ref zlscvciucppvsrorwzjt` 后跑 `supabase db query --linked --file supabase/schema.sql`。
- `.env` 中的 Supabase secret key 不能执行 DDL；schema 变更必须走 SQL Editor、数据库连接串或已登录并 link 的 Supabase CLI。

## 架构入口

- 路由：`app/`，包含 `/`、`/search`、`/posts/[slug]`、`/admin`、`/recipes`、`/recipes/tags/[tag]`。
- 数据读取：`src/lib/posts.ts`。
- 后台保存和逻辑删除：`src/lib/admin-posts.ts`。
- 认证与 session：`src/lib/auth.ts`、`src/lib/admin-session.ts`。
- HTML 清洗：`src/lib/html.ts`。
- 富文本编辑器：`src/components/RichTextEditor.tsx`。
- 迁移计划与状态：`src/lib/migration/`、`scripts/migrate/cli.ts`。
- 食谱卡路里估算：`src/lib/recipe-nutrition.ts`。
- 数据库 schema：`supabase/schema.sql`。

核心数据流：

```text
Next.js route -> src/lib/* -> Supabase RPC/table query -> page render
Admin form -> app/api/admin/posts -> saveAdminPost -> Supabase posts/tags
Editor image upload -> app/api/uploads/image -> Vercel Blob -> content_html
Migration CLI -> Linode snapshot -> Vercel Blob + Supabase -> reports/state
Recipe calorie estimate -> AI Gateway or JSONL -> Supabase -> recipes list/detail
```

## Playwright 浏览器

- 默认使用用户本机已安装的 Chrome。
- Playwright 项目配置里设置 `channel: "chrome"`。
- 不要因为 Playwright 提示 bundled browser 缺失就要求下载浏览器。
- 如果报缺少 `chromium_headless_shell`，先切换系统 Chrome 再重跑。

## 文件与安全

- `refs/` 必须保持 git 忽略。
- `.env`、`refs/`、`.tmp/`、`.next/`、`test-results/` 都不要提交。
- 不要提交 `.env`、Supabase secret key、Blob token 或 APNs 密钥。
- 不要提交或记录 `AI_GATEWAY_API_KEY`。
- 用户上传不要写入项目文件系统。
- 运行时图片上传只使用 Vercel Blob。
- 数据库使用 Supabase Postgres。
- 删除文章必须是逻辑删除：只把 `posts.status` 改为 `draft`，不得物理删除 `posts` 行。
- 公开页面渲染 HTML 前必须经过 `sanitizePostHtml` 或等效白名单清洗。

## 开发纪律

- 按 vN 计划和 Req ID 追溯推进。
- 优先先写测试，再写实现。
- 声称代码完成前，至少运行 `npm test` 和 `npm run build`。
- TypeScript 变更后运行 `npx tsc --noEmit`。
- 涉及用户流程时运行 `npm run e2e`。
- 如果 E2E 因本地环境失败，要明确报告失败原因。
- 修改 Supabase schema 后，同步更新 `tests/foundation/schema.test.ts` 和环境/初始化文档。
- 修改公开查询、食谱、tags、后台保存或逻辑删除时，优先补 `tests/public/posts.test.ts`、`tests/admin/auth.test.ts` 或 `tests/e2e/public.spec.ts`。
- 修改迁移逻辑时，补 `tests/migration/migration.test.ts`，并至少跑 `npm test -- tests/migration/migration.test.ts`。
- 修改食谱卡路里估算时，必须覆盖 schema、env、后台保存、公开列表/详情和存量 JSONL 导入测试。

## 前端风格

参考 `E:\development\homestay`：

- 暖米色背景。
- 深墨色文字。
- 灰绿色强调色。
- serif 展示标题。
- 克制的表面、细线和柔和阴影。

博客首先要好读、耐看，不要做成营销首页。
