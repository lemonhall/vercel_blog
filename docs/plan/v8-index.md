# v8-index: 食谱流量扇出治理

## 愿景

关联 `PRD-0001`、`ECN-0010`、`ECN-0011`、`REQ-0001-008`、`REQ-0001-009`、`REQ-0001-010` 和 `REQ-0001-011`。v8 的目标是在保持 v7 私有门禁的同时，消除 `/recipes` 的 crawler URL 组合陷阱、N+1 查询、全量正文出站和无缓存动态读取，使抓取入口、URL 空间、单请求 Supabase 调用数和返回字段都有可测试上限。

设计依据：`docs/superpowers/specs/2026-07-10-recipe-traffic-containment-design.md`。

## 成本档位

- `strict`：生产 Supabase 已触发 `exceed_egress_quota`，改动涉及访问控制、数据库协议、缓存失效和公开用户流程。
- Review 上限：3 轮；至少一次 fresh-context 独立 reviewer。
- 发布顺序：schema -> application -> live smoke；任一步失败都保持 v7 私有门禁。

## 里程碑

| 里程碑 | 范围 | DoD | 验证 | 状态 |
|---|---|---|---|---|
| M1 文档与追溯 | PRD、ECN、设计、v8 计划 | REQ/ECN/计划/测试命令无断链；DoD 全部可二元判定；乱码扫描无命中 | doc hygiene；`git diff --check`；乱码扫描 | doing |
| M2 抓取与 URL 边界 | robots、crawler 403、tag 参数和表单、metadata | crawler `/recipes`=403；普通未登录=303；robots 全站 Disallow；页面不输出递归追加 tag 链接；多 tag noindex | `npm test -- tests/admin/auth.test.ts tests/public/posts.test.ts`；Playwright crawler/recipes 用例 | todo |
| M3 有界数据协议 | 分页 RPC、有限投影、去除 N+1、首页投影 | 食谱内容 RPC<=2；SQL 内分页/AND/总数；列表协议不含正文和原始 nutrition JSON | `npm test -- tests/foundation/schema.test.ts tests/public/posts.test.ts` | todo |
| M4 缓存与失效 | 版本化公开缓存、后台保存/删除失效 | 热缓存食谱页 Supabase 调用<=1，冷缓存<=3；旧 in-flight 读取不能污染新版本键；成功失效 `posts`/`recipes`/path | `npm test -- tests/admin/auth.test.ts tests/admin/posts-route.test.ts tests/public/cache.test.ts` | todo |
| M5 E2E、Review 与发布 | 全量回归、独立审查、schema/application/smoke | 全量命令 exit 0；Review 无 BLOCKER；MAJOR 全部处置；schema 先于应用；live 边界符合预期 | `npm test`；`npx tsc --noEmit`；`npm run build`；`npm run e2e`；production smoke | todo |

## 计划索引

- `docs/plan/v8-recipe-traffic-containment.md`
- `docs/superpowers/plans/2026-07-10-recipe-traffic-containment.md`

## 追溯矩阵

| Req ID | ECN | v8 Plan | 单元/集成测试 | E2E | 状态 |
|---|---|---|---|---|---|
| REQ-0001-008 | ECN-0007、ECN-0010 | M2、M3 | `tests/public/posts.test.ts` | `tests/e2e/public.spec.ts` 食谱筛选 | todo |
| REQ-0001-009 | ECN-0008、ECN-0010 | M3 | `tests/foundation/schema.test.ts`、`tests/public/posts.test.ts` | 食谱列表/详情 nutrition | todo |
| REQ-0001-010 | ECN-0009、ECN-0010 | M2 | `tests/admin/auth.test.ts` | 私有登录流程 | todo |
| REQ-0001-011 | ECN-0010、ECN-0011 | M2、M3、M4、M5 | `tests/admin/auth.test.ts`、`tests/admin/posts-route.test.ts`、`tests/foundation/schema.test.ts`、`tests/public/cache.test.ts`、`tests/public/posts.test.ts` | crawler、robots、筛选、后台失效后的读取 | todo |

## ECN 索引

- ECN-0007：食谱频道和 tags。
- ECN-0008：食谱卡路里估算。
- ECN-0009：全站私有访问门禁。
- ECN-0010：食谱抓取流量与查询扇出治理。
- ECN-0011：公开缓存使用事务内容版本隔离并发回填。

## DoD 硬度自检

- [x] 每条里程碑 DoD 都有状态码、调用次数、字段集合或命令退出码等二元/量化条件。
- [x] 每条 DoD 都绑定具体测试文件或命令。
- [x] 反作弊：禁止以 robots、缓存或防火墙掩盖旧 N+1；测试必须断言 RPC 调用次数和 RPC 返回字段。
- [x] 反作弊：禁止用旧 RPC 回退；schema 未应用时保持门禁并阻止应用发布。
- [x] 非目标已写明：不解除门禁、不取消多 tag、不引入新服务、不反复请求受限生产库。

## Doc QA Gate

- [x] REQ-0001-010 已补回 PRD，修复 v7 的追溯漂移。
- [x] REQ-0001-011 包含动机、范围、非目标和二元验收。
- [x] ECN-0010 已同步 PRD、设计和 v8 计划。
- [x] ECN-0011 已同步 PRD、schema、缓存测试和 v8 计划。
- [x] 所有计划任务绑定 Req ID、文件、红绿命令和预期结果。
- [x] 术语统一使用 `crawler`、`canonical tags`、`recipe list RPC`、`posts`/`recipes` cache tag。

## 差异列表

- 当前实现仍包含组合 tag 链接、逐篇 RPC、列表 `select("*")`、应用层分页和无显式缓存；由 M2-M4 闭合。
- 生产 Supabase 处于 `exceed_egress_quota` 限制；schema 应用和真实数据 smoke 必须等服务恢复，但本地实现、测试、提交和应用发布前置检查继续推进。

## Review Loop

尚未执行。M2-M4 完成后进行 strict 独立 Review，记录 BLOCKER/MAJOR 签名和处置。

## Tashan Trigger Audit

- expected_review_triggers: M1、M2、M3、M4、M5、v8 完成、每次 push 前
- actual_review_runs: 0
- skipped_triggers: 0
- skip_reasons: 无
- mitigation: 使用 fresh-context reviewer；最终全量命令由 maker 重新执行，不采信摘要

## 验证证据

- 待执行阶段逐项回写命令、退出码、测试数量、Review verdict、提交和部署证据。
