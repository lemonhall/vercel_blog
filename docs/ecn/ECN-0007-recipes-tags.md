# ECN-0007: 食谱频道与标签体系

## 基本信息

- **ECN 编号**：ECN-0007
- **关联 PRD**：PRD-0001
- **关联 Req ID**：新增 REQ-0001-008
- **发现阶段**：v5 食谱频道与标签体系
- **日期**：2026-06-11

## 变更原因

迁移后的博客不只是日记和技术笔记，其中有大量食谱。当前 `posts` 表只能表达“文章是否发布”，无法区分普通文章与食谱，也无法为食谱附加“意大利菜、海鲜、牛肉、法国菜、炖菜”等可组合标签。公开阅读页也缺少独立食谱入口和标签云，后台编辑器也不能手工维护 tags。

## 变更内容

### 原设计

PRD-0001 只要求公开首页、详情页、搜索和后台富文本编辑，没有定义文章类型、食谱频道或标签模型。

### 新设计

- `posts` 增加 `content_kind` 字段，取值为 `post` 或 `recipe`，默认 `post`。
- 新增 `tags` 表，保存标签名称、slug、类型和排序字段。
- 新增 `post_tags` 关联表，支持一篇文章拥有多个标签，一个标签对应多篇文章。
- 公开站点新增食谱频道，路径为 `/recipes`，只展示 `content_kind = 'recipe'` 且已发布的文章。
- 食谱频道展示 tags 云，可按标签过滤，例如 `/recipes/tags/beef`。
- 后台编辑页新增文章类型选择和 tags 手工编辑能力。
- 初始化标注不使用规则/关键词脚本替代判断；脚本只负责导出候选内容、导入审核后的结果，食谱识别与 tags 建议由 AI 逐批阅读标题和正文后给出。

## 影响范围

- 受影响的 Req ID：REQ-0001-008
- 受影响的 vN 计划：v5-index、v5-recipes-tags
- 受影响的测试：`tests/public/posts.test.ts`、`tests/admin/auth.test.ts`、`tests/e2e/public.spec.ts`
- 受影响的代码文件：`supabase/schema.sql`、`app/admin/page.tsx`、`app/page.tsx`、`app/recipes/**`、`src/lib/posts.ts`、`src/lib/admin-posts.ts`

## 处置方式

- [x] PRD 已同步更新
- [x] v5 计划已建立
- [ ] 相关测试已同步更新
