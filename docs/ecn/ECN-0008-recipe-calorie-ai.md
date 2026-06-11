# ECN-0008: 食谱卡路里 AI 估算

## 基本信息

- **ECN 编号**：ECN-0008
- **关联 PRD**：PRD-0001
- **关联 Req ID**：新增 REQ-0001-009
- **发现阶段**：v6 Vercel AI Gateway 食谱营养估算
- **日期**：2026-06-11

## 变更原因

v5 已经把食谱文章、tags 和食谱频道建立起来，但食谱仍缺少读者常用的能量信息。后台新增或更新食谱时，应该能通过 AI 读取标题、正文和 tags 自动估算卡路里；存量食谱也需要先批量估算并导入。估算结果必须持久化，避免只停留在一次性提示词或正文手写备注里。

## 变更内容

### 原设计

PRD-0001 的 REQ-0001-008 明确 v5 不做营养数据、菜谱步骤结构化或购物清单。后台只维护文章类型与 tags。

### 新设计

- 新增 REQ-0001-009：食谱卡路里 AI 估算。
- AI 接入使用 Vercel AI Gateway，服务端环境变量为 `AI_GATEWAY_API_KEY`。
- 模型固定为普通 `openai/gpt-5.5`，不使用 `openai/gpt-5.5-pro`。
- 后台文章表单在文章类型为食谱时提供明确的“AI 估算卡路里”动作；普通文章不触发 AI。
- AI 输出必须是结构化 JSON，并经过服务端校验后再写入数据库。
- 估算结果持久化到 `recipe_nutrition_estimates`，每篇食谱保留一条最新估算记录，同时记录总 kcal、每份 kcal、食材明细 JSON、模型、prompt 版本、输入 hash、原始 JSON、置信度和复核状态。
- 存量食谱回填使用本地 JSONL 文件导入，不消耗 Vercel AI Gateway tokens；导入逻辑负责校验、幂等 upsert 和报告。
- `/recipes` 列表只展示最终卡路里值；单篇食谱详情页展示食材明细和加总依据。
- AI 失败不得破坏文章保存；后台必须给出可诊断错误。

## 影响范围

- 受影响的 Req ID：REQ-0001-009
- 受影响的 vN 计划：v6-index、v6-recipe-calorie-ai
- 受影响的测试：`tests/foundation/schema.test.ts`、`tests/admin/auth.test.ts`、`tests/public/posts.test.ts`、`tests/migration/migration.test.ts`、`tests/e2e/public.spec.ts`
- 受影响的代码文件：`supabase/schema.sql`、`app/admin/page.tsx`、`app/api/admin/posts/route.ts`、`app/recipes/page.tsx`、`app/posts/[slug]/page.tsx`、`src/lib/admin-posts.ts`、`src/lib/env.ts`、`src/lib/posts.ts`、`src/lib/recipe-nutrition.ts`、`src/lib/migration/**`

## 处置方式

- [x] PRD 已同步更新
- [x] v6 计划已建立
- [ ] schema 与测试待实现
- [ ] 后台 AI 估算链路待实现
- [ ] 存量 JSONL 估算导入待实现
