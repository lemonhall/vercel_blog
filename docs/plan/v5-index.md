# v5-index: 食谱频道与标签体系

## 愿景

关联 `PRD-0001` 与 `ECN-0007`。v5 的目标是把历史博客中的食谱从普通文章流里显式组织出来：数据库能表达“这篇是食谱”，每篇食谱能有多个 tags，公开站点有独立 `/recipes` 频道和 tags 云，后台能手工维护类型与 tags，历史食谱初始化标注由 AI 阅读正文后生成可审计结果。

## 当前版本判断

- v1：基础架构、公开页、后台编辑。
- v2：真实 Linode 数据迁移。
- v3：公开阅读控制、分页、排序、前台管理动作。
- v4：富文本编辑器升级与移动端友好。
- v4 后补丁：草稿管理、删除确认、移动端首页横向溢出修复。
- **当前下一版为 v5：食谱频道与标签体系。**

## 里程碑

| 里程碑 | 范围 | DoD | 验证 | 状态 |
|---|---|---|---|---|
| M1 文档与追溯 | ECN-0007、PRD-0001、v5-index、v5 执行计划 | 新 Req ID 存在；schema、前台、后台、AI 初始化边界清晰；无乱码 | `git diff --text`；乱码扫描无命中 | done |
| M2 Schema 与数据层 | `content_kind`、`tags`、`post_tags`；查询和保存 API | schema 有约束和索引；保存文章可写类型与 tags；重复保存不产生重复关联 | `npm test -- tests/public/posts.test.ts tests/admin/auth.test.ts tests/foundation/schema.test.ts` 20 passed | done |
| M3 后台编辑 | 管理员可编辑文章类型和 tags | 编辑页有类型选择、tags 输入；保存后再次编辑能回显 | `npm run e2e -- -g "recipe tags\|recipe tag pages"` 2 passed | done |
| M4 公开食谱频道 | `/recipes`、`/recipes/tags/<tag>`、tags 云 | 频道只显示已发布食谱；按 tag 过滤正确；普通文章和草稿不泄露 | `npm run e2e` 14 passed | done |
| M5 AI 初始化标注链路 | 导出待识别内容、AI JSONL 标注、导入标注结果 | 导出文件可读；导入幂等；支持断点续跑；不使用关键词规则替代 AI 判断；真实生产库已完成首轮标注导入 | `npm test -- tests/migration/migration.test.ts` 7 passed；生产验证 `recipePosts=287`、`tags=57`、`post_tags=945` | done |
| M6 发布验证 | 全量验证与回顾 | 单测、类型、构建、E2E 全绿；提交并推送 | `npm test` 32 passed；`npx tsc --noEmit` 通过；`npm run build` 通过；`npm run e2e` 14 passed | done |

## 计划索引

- [v5-recipes-tags.md](./v5-recipes-tags.md)

## 追溯矩阵

| Req ID | ECN | v5 Plan | 测试/命令 | 状态 |
|---|---|---|---|---|
| REQ-0001-008 | ECN-0007 | v5-recipes-tags | `tests/public/posts.test.ts`、`tests/admin/auth.test.ts`、`tests/e2e/public.spec.ts`、`tests/migration/migration.test.ts` | done |

## ECN 索引

- ECN-0007：食谱频道与标签体系。

## 差异列表

- v5 代码链路已实现：schema、后台编辑、公开食谱频道、tag 云、AI JSONL 导出/导入均有自动化测试覆盖。
- 真实生产库已完成首轮 AI 初标导入：从 669 篇当前文章中标出 287 篇食谱，写入 `posts.content_kind='recipe'`，生成 57 个 tags 与 945 条 `post_tags` 关联。线上 `/recipes` 与 `/recipes/tags/beef` 返回 HTTP 200。
- 仍需人工抽查的不是链路缺口，而是内容质量工作：后续可以在后台逐篇修正 tags，或修正 JSONL 后重跑导入。
