# v5-recipes-tags: 食谱频道、tags 与 AI 初始化标注

## Goal

让博客能把食谱从普通文章中独立出来，并支持按 tags 浏览。后台可以手工维护食谱属性和 tags；历史食谱初始化由 AI 阅读正文后给出结构化标注，脚本只负责搬运、校验和幂等导入。

## PRD Trace

- REQ-0001-008：食谱频道与 tags。

## Scope

做：

- Supabase schema 增加 `posts.content_kind`，取值 `post` / `recipe`。
- 新增 `tags`、`post_tags` 表，支持 tags 多对多关联。
- 数据层增加食谱列表、tag 云、按 tag 查询、多 tags AND 交集查询、后台文章 tags 读取与保存。
- 后台编辑页增加文章类型选择和 tags 手工输入。
- 公开站点新增 `/recipes` 和 `/recipes/tags/<tagSlug>`，主筛选状态使用 `/recipes?tags=<slug1>,<slug2>`。
- tags 云显示已发布食谱下每个 tag 的数量。
- tags 云支持多选 AND 筛选：点击未选 tag 加入筛选，点击已选 tag 取消筛选，“全部取消”清空所有 tag。
- 初始化标注链路使用 JSONL：导出候选文章摘要与正文片段，AI 逐批输出 `content_kind` 与 tags，导入脚本幂等写入数据库。
- AI 标注文件保留在可审计目录，便于人工抽查和修正。

不做：

- 不做营养成分、步骤、食材克重等结构化菜谱系统。
- 不做多级分类树，只做可组合 tags。
- 不做关键词/正则/标题规则自动判定食谱；程序不得替代 AI 读正文判断。
- 不在 v5 强制完成 600 多篇历史文章的全部最终审校；v5 交付的是可反复运行的标注与导入链路，并完成首批可验证导入。

## Acceptance

- `supabase/schema.sql` 包含：
  - `posts.content_kind text not null default 'post' check (content_kind in ('post', 'recipe'))`
  - `tags.slug unique`
  - `post_tags primary key (post_id, tag_id)`
  - 面向食谱列表和 tag 查询的索引。
- `npm test -- tests/public/posts.test.ts` 通过，覆盖食谱列表、tag 云、按 tag 查询、多 tags AND 查询，并确保草稿和普通文章不泄露。
- `npm test -- tests/admin/auth.test.ts` 通过，覆盖后台保存文章类型与 tags，重复保存不会产生重复关联。
- `npm run e2e` 通过，覆盖管理员编辑 tags、打开 `/recipes`、点击 tag 过滤食谱、多选 tag、取消已选 tag 和全部取消。
- `npm test -- tests/migration/migration.test.ts` 通过，覆盖 AI JSONL 标注导入幂等、断点续跑、未知 tag 自动 upsert。
- `npm run build` 通过。
- 反作弊条款：不得只在前端用字符串过滤食谱；公开食谱查询必须从数据库层按 `content_kind='recipe'` 和 `status='published'` 过滤；AI 初始化不得使用关键词规则冒充内容理解。

## Files

- `supabase/schema.sql`
- `app/admin/page.tsx`
- `app/api/admin/posts/route.ts`
- `app/recipes/page.tsx`
- `app/recipes/tags/[tag]/page.tsx`
- `app/globals.css`
- `src/lib/posts.ts`
- `src/lib/admin-posts.ts`
- `src/lib/fixture-data.ts`
- `src/lib/migration/**`
- `scripts/migrate/**`
- `tests/public/posts.test.ts`
- `tests/admin/auth.test.ts`
- `tests/e2e/public.spec.ts`
- `tests/migration/migration.test.ts`

## Steps

1. TDD Red：写 schema/data 层测试，期望存在食谱查询、tag 云、后台保存 tags。
2. TDD Red：写 E2E，覆盖后台维护 tags 与公开 `/recipes` / tag 过滤。
3. TDD Red：写 AI 标注导入测试，输入 JSONL 后幂等更新 `content_kind`、`tags`、`post_tags`。
4. Green：更新 Supabase schema、fixture 和数据层查询。
5. Green：更新后台编辑 UI 和保存 API。
6. Green：新增食谱公开页面和 tag 页面。
7. Green：实现 AI 标注导出/导入脚本；脚本只处理 JSONL，不做关键词判断。
8. Refactor：抽取 tags 解析、slug 规范化、upsert 公共逻辑。
9. E2E：运行完整 Playwright 流程。
10. Review：回填 v5-index 证据和差异，确认 PRD/ECN/plan 无断链。
11. Ship：提交并推送。

## AI 标注数据格式

导出文件：`data/ai-tagging/recipe-candidates.jsonl`

```json
{"post_id":"uuid","legacy_id":123,"title":"标题","slug":"slug","excerpt":"摘要","content_text":"去 HTML 后的正文片段"}
```

AI 输出文件：`data/ai-tagging/recipe-labels.jsonl`

```json
{"post_id":"uuid","content_kind":"recipe","tags":["牛肉","炖菜","法国家常菜"],"confidence":0.92,"reason":"正文包含明确食材、烹饪步骤和调味说明"}
```

规则：

- `content_kind` 只能是 `post` 或 `recipe`。
- tags 使用中文显示名，导入时生成稳定 slug。
- 每行必须保留 `reason`，方便抽查为什么这么标。
- 低置信度条目允许进入 `needs_review` 报告，不直接导入。

## 生产导入记录

- 时间：2026-06-11
- 输入：`.tmp/recipe-candidates.jsonl`，当前生产 Supabase 中 669 篇文章。
- 标注：`.tmp/recipe-labels.jsonl`，首轮 AI 初标 287 篇食谱。
- 导入：`.tmp/import-recipe-labels.mjs` 顺序写入 Supabase，结果 `imported=287`、`skipped=0`。
- 验证：`.tmp/verify-recipe-import.mjs` 读取生产库，结果 `recipePosts=287`、`tags=57`、`post_tags=945`；`list_recipe_tags` 返回 tags 云；线上 `/recipes` 与 `/recipes/tags/beef` 返回 HTTP 200。
- 断点续跑：同一 JSONL 可重复导入，`post_tags` 依赖 `(post_id, tag_id)` 主键和 `save_post_tags_for_post` RPC 清理后重写，重复运行不会制造重复关联。

## Risks

- 历史正文 HTML 可能很长，单批 AI 标注要限制 token 和批次大小。
- tags 容易失控。v5 先允许自由 tags，但导入报告要输出同义标签候选，例如“牛肉/牛腩”“意大利菜/意式”。
- 生产库更新 schema 需要手动在 Supabase 执行或走迁移命令，必须先在本地/fixture 测试通过。
- AI 标注可能误判。必须保留 JSONL 和 reason，后续可以人工修正后重跑导入。
