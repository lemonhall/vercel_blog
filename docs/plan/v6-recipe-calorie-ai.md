# v6-recipe-calorie-ai: 食谱卡路里 AI 估算与持久化

## Goal

后台新增或更新食谱时，管理员可以主动触发 Vercel AI Gateway 估算卡路里。估算使用普通 `openai/gpt-5.2`，结果持久化到 Supabase，并在后续编辑该食谱时回显。存量食谱通过本地 JSONL 估算导入，避免消耗 Vercel AI Gateway tokens。

## PRD Trace

- REQ-0001-009：Recipe Calorie Estimation Through Vercel AI Gateway。

## Scope

做：

- 新增 `recipe_nutrition_estimates` 表，用 `post_id` 关联 `posts`，每篇食谱保存一条最新估算。
- 新增 `AI_GATEWAY_API_KEY` 环境变量，服务端读取，不暴露到前端。
- 新增 AI 服务层，调用 Vercel AI Gateway 的 OpenAI 兼容接口，模型固定 `openai/gpt-5.2`。
- AI prompt 要求结构化 JSON 输出，服务端校验字段、食材明细数组、数值范围和置信度。
- 后台表单在食谱类型下提供“AI 估算卡路里”选项或动作。
- 保存食谱且选择估算时，先保存文章和 tags，再调用 AI 并 upsert 卡路里估算。
- 编辑已有食谱时回显最新卡路里估算，包括每份卡路里、总卡路里、份数、置信度、复核状态和说明。
- `/recipes` 列表只展示最终卡路里值。
- 单篇食谱详情页展示食材明细、每项 kcal 和加总说明。
- 存量食谱走本地 JSONL 批量估算导入，导入时幂等 upsert 并输出报告；本地估算脚本允许用可审计规则生成初始估算，在线生产路径不得用规则伪造 AI 估算。
- 测试默认 mock AI Gateway；只有显式手动 smoke 才允许真实调用。

不做：

- 不接入 `openai/gpt-5.2-pro`。
- 不使用 Vercel OIDC 作为本项目的默认鉴权方式。
- 不给普通文章提供卡路里估算。
- 不做宏量营养素、微量元素或购物清单。
- 不把卡路里估算写进正文 HTML。

## Acceptance

- `supabase/schema.sql` 包含 `recipe_nutrition_estimates`，字段至少包括 `post_id`、`servings`、`calories_total_kcal`、`calories_per_serving_kcal`、`confidence`、`needs_review`、`summary`、`ingredient_estimates_json`、`model`、`prompt_version`、`source_hash`、`raw_estimate_json`、`created_at`、`updated_at`，并有 `post_id` 唯一约束。
- `.env.example` 和 `docs/setup/vercel-supabase-env.md` 包含 `AI_GATEWAY_API_KEY`，且安全注意事项明确不能提交或暴露。
- `tests/foundation/schema.test.ts` 覆盖新表、唯一约束和字段。
- `tests/foundation/env.test.ts` 覆盖 AI Gateway key 只作为可选服务端 secret 读取。
- `tests/admin/auth.test.ts` 覆盖：普通文章保存不调用 AI；食谱保存且选择估算时调用 `openai/gpt-5.2`；AI 返回合法 JSON 后 upsert；非法 JSON 或调用失败返回明确错误。
- `tests/public/posts.test.ts` 覆盖：食谱列表查询返回最终 kcal；单篇详情查询返回食材明细；无估算不显示假值。
- `tests/migration/migration.test.ts` 覆盖：存量卡路里 JSONL 导入幂等、非法行报告、低置信度标记复核。
- `tests/e2e/public.spec.ts` 覆盖：管理员编辑食谱并选择估算；食谱列表显示最终 kcal；详情页显示食材明细。
- 反作弊条款：不得用固定常量、关键词规则或前端 mock 伪造卡路里估算；生产路径必须通过服务端 AI Gateway 客户端，测试路径必须显式注入 mock。
- `npm test`、`npx tsc --noEmit`、`npm run build`、`npm run e2e` 全部通过。

## Files

- `.env.example`
- `README.md`
- `AGENTS.md`
- `docs/setup/vercel-supabase-env.md`
- `docs/prd/PRD-0001-vercel-blog-migration.md`
- `docs/ecn/ECN-0008-recipe-calorie-ai.md`
- `docs/plan/v6-index.md`
- `docs/plan/v6-recipe-calorie-ai.md`
- `supabase/schema.sql`
- `src/lib/env.ts`
- `src/lib/admin-posts.ts`
- `src/lib/posts.ts`
- `src/lib/recipe-nutrition.ts`
- `app/admin/page.tsx`
- `app/api/admin/posts/route.ts`
- `app/recipes/page.tsx`
- `app/posts/[slug]/page.tsx`
- `scripts/migrate/recipe-calories.ts`
- `tests/foundation/schema.test.ts`
- `tests/foundation/env.test.ts`
- `tests/admin/auth.test.ts`
- `tests/public/posts.test.ts`
- `tests/migration/migration.test.ts`
- `tests/e2e/public.spec.ts`

## Steps

1. TDD Red：更新 schema/env/admin/E2E 测试，先跑到失败，证明缺少表、env、AI 服务和 UI。
2. Green：更新 Supabase schema，新增 `recipe_nutrition_estimates` 和必要索引/约束。
3. Green：更新 env 读取、`.env.example` 和环境文档，加入 `AI_GATEWAY_API_KEY`。
4. Green：实现 `src/lib/recipe-nutrition.ts`，包含 prompt 构造、OpenAI 兼容请求、JSON 校验、source hash 和 upsert payload。
5. Green：接入后台保存 API，只有 `content_kind='recipe'` 且管理员选择估算时才调用 AI。
6. Green：后台页面展示估算入口和已保存估算结果。
7. Refactor：抽取错误类型，确保 AI 失败提示可诊断且不吞掉文章保存错误。
8. Green：公开列表展示最终 kcal，详情页展示食材明细。
9. Green：实现存量 JSONL 导入脚本和报告，以生产库实际食谱数量为准完成首轮导入。
10. E2E：用 fixture/mock 覆盖后台食谱估算、列表最终值和详情明细。
11. Review：回填 v6-index 证据和差异；如发现需求边界变化则写 ECN。
12. Ship：按 v6 提交并推送。

## AI Gateway 约定

- Base URL：Vercel AI Gateway 的 OpenAI 兼容接口。
- Auth：`Authorization: Bearer ${AI_GATEWAY_API_KEY}`。
- Model：`openai/gpt-5.2`。
- Prompt version：`recipe-calorie-v1`。
- 输出 JSON：

```json
{
  "servings": 4,
  "calories_total_kcal": 1800,
  "calories_per_serving_kcal": 450,
  "ingredient_estimates": [
    {
      "name": "牛肉",
      "amount": "500g",
      "calories_kcal": 1250,
      "note": "按普通牛肉约 250 kcal/100g 估算"
    },
    {
      "name": "番茄",
      "amount": "300g",
      "calories_kcal": 54,
      "note": "按番茄约 18 kcal/100g 估算"
    }
  ],
  "confidence": 0.72,
  "needs_review": false,
  "summary": "根据正文中的牛肉、番茄和油脂用量估算，每份约 450 kcal。"
}
```

## 存量 JSONL 格式

导出文件：`.tmp/recipe-calorie-candidates.jsonl`

```json
{"post_id":"uuid","title":"番茄炖牛肉","slug":"tomato-beef","tags":["牛肉","炖菜"],"content_text":"去 HTML 后正文"}
```

估算文件：`.tmp/recipe-calorie-estimates.jsonl`

```json
{"post_id":"uuid","servings":4,"calories_total_kcal":1800,"calories_per_serving_kcal":450,"ingredient_estimates":[{"name":"牛肉","amount":"500g","calories_kcal":1250,"note":"按普通牛肉约 250 kcal/100g 估算"}],"confidence":0.72,"needs_review":false,"summary":"每份约 450 kcal。"}
```

规则：

- 批量估算由本地脚本产出 JSONL，不调用 Vercel AI Gateway。
- 本地脚本的规则估算只用于存量回填初值，必须把每个食材、用量、kcal 和 note 写入 JSONL，方便人工复核。
- 在线后台保存路径不得使用本地规则估算；必须通过服务端 AI Gateway 客户端并显式由管理员触发。
- 同一 `post_id` 重复导入更新同一条估算。
- 低置信度、缺少份数或缺少主要食材的条目必须标记 `needs_review=true`。

## Execution Record

- 远端 schema：`supabase db query --linked --file supabase/schema.sql` 成功。
- 存量回填：`npx tsx scripts/migrate/recipe-calories.ts --phase backfill-local` 输出 `exported.count=287`、`estimated.count=287`、`imported.imported=287`、`skipped=0`、`needsReview=276`。
- 生产验证：`recipe_count=287`、`nutrition_count=287`、`needs_review_count=276`。
- 自动化验证：`npm test` 46 条通过；`npx tsc --noEmit` 通过；`npm run build` 通过；`npm run e2e` 14 条通过。

## Risks

- Vercel AI Gateway 文档和 AI SDK 版本可能继续变化。v6 先用 OpenAI 兼容 HTTP 接口隔离 SDK 变动。
- 正文缺少份数、克重或油脂用量时，AI 估算偏差可能较大。低置信度必须标记 `needs_review=true`。
- AI 调用费用不可忽略。必须由管理员显式选择估算，不能每次保存食谱都默认调用。
- 存量估算规模较大，必须分批写 JSONL 并保留中间文件，避免一次性长输出导致截断或编码风险。
- schema 需要应用到 Supabase 远端；使用 `supabase db query --linked --file supabase/schema.sql`。
