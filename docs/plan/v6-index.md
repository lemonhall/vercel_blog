# v6-index: Vercel AI Gateway 食谱卡路里估算

## 愿景

关联 `PRD-0001`、`ECN-0008` 和 `REQ-0001-009`。v6 的目标是在后台新增或更新食谱时，通过 Vercel AI Gateway 调用普通 `openai/gpt-5.2` 估算卡路里，并把结果持久化到 Supabase；存量食谱先用本地 JSONL 批量估算导入，不消耗 Vercel tokens。公开食谱列表只展示最终卡路里值，单篇详情页展示食材明细和加总依据。

## 当前版本判断

- v1：基础架构、公开页、后台编辑。
- v2：真实 Linode 数据迁移。
- v3：公开阅读控制、分页、排序、前台管理动作。
- v4：富文本编辑器升级与移动端友好。
- v5：食谱频道、tags、AI JSONL 初标导入和 tags 多选 AND 筛选。
- v6：Vercel AI Gateway 食谱卡路里估算与持久化。

## 里程碑

| 里程碑 | 范围 | DoD | 验证 | 状态 |
|---|---|---|---|---|
| M1 文档与追溯 | ECN-0008、PRD-0001、v6-index、v6 执行计划 | 新 Req ID 存在；AI Gateway、模型、鉴权、持久化、失败边界清晰；无乱码 | `git diff --text`；乱码扫描无命中 | done |
| M2 Schema 与配置 | `recipe_nutrition_estimates`、`AI_GATEWAY_API_KEY` 环境变量 | schema 有 `post_id` 唯一当前估算约束和食材明细 JSON 字段；env 文档和 `.env.example` 有变量；secret 不进前端 | `npm test -- tests/foundation/schema.test.ts tests/foundation/env.test.ts` | done |
| M3 AI 服务层 | Vercel AI Gateway 调用、prompt、结构化 JSON 校验 | 使用 `AI_GATEWAY_API_KEY` 和 `openai/gpt-5.2`；非法 JSON/缺字段失败；普通文章不调用 AI；返回食材明细数组 | `npm test -- tests/admin/auth.test.ts` | done |
| M4 后台编辑体验 | 食谱表单触发估算并展示结果 | 食谱可主动触发估算；结果保存后回显；失败提示可诊断；普通文章无估算入口 | `npm run e2e` | done |
| M5 公开展示 | `/recipes` 和单篇详情页展示估算 | 列表只展示最终 kcal；详情展示每项食材 kcal 与加总说明；无估算不显示假值 | `npm test -- tests/public/posts.test.ts`；`npm run e2e` | done |
| M6 存量回填 | 导出/导入存量食谱卡路里 JSONL | 以生产库实际食谱数量为准；JSONL 留档；导入幂等；报告成功/跳过/需复核 | `npm test -- tests/migration/migration.test.ts`；生产导入验证 | done |
| M7 发布验证 | 全量验证与回顾 | 单测、类型、构建、E2E 全绿；远端 schema 已应用；文档差异闭合 | `npm test`；`npx tsc --noEmit`；`npm run build`；`npm run e2e` | done |

## 计划索引

- [v6-recipe-calorie-ai.md](./v6-recipe-calorie-ai.md)

## 追溯矩阵

| Req ID | ECN | v6 Plan | 测试/命令 | 状态 |
|---|---|---|---|---|
| REQ-0001-009 | ECN-0008 | v6-recipe-calorie-ai | `tests/foundation/schema.test.ts`、`tests/foundation/env.test.ts`、`tests/admin/auth.test.ts`、`tests/public/posts.test.ts`、`tests/migration/migration.test.ts`、`tests/e2e/public.spec.ts` | done |

## ECN 索引

- ECN-0008：食谱卡路里 AI 估算。

## 差异列表

- 无未闭合实现差异。
- live AI smoke 仍需要真实 `AI_GATEWAY_API_KEY`。自动化测试默认 mock AI Gateway，未消耗真实模型 token。
- 存量食谱数量按生产库实际查询为 287 篇；本地回填导入 287 条，跳过 0 条，需复核 276 条。
- 存量 JSONL 文件保存在 `.tmp/recipe-calorie-candidates.jsonl` 和 `.tmp/recipe-calorie-estimates.jsonl`，按 `.gitignore` 不提交。

## 验证证据

- `supabase db query --linked --file supabase/schema.sql`：远端 schema 应用成功。
- 生产库验证：`recipe_count=287`、`nutrition_count=287`、`needs_review_count=276`。
- `npm test`：5 个测试文件，46 条测试通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：Next.js 生产构建通过。
- `npm run e2e`：Playwright 14 条通过。
