# v3-index: 前台基础体验修整

## 愿景

关联 `PRD-0001` 与 `ECN-0005`。v3 的目标是在迁移完成、文章可显示之后，把公开阅读和单人管理入口补到可长期使用的状态：站点有明确柠檬品牌识别，宽屏阅读不浪费空间，文章列表可分页和排序，管理员能从前台快速进入编辑或删除动作，页面底部有稳定收尾。

## 里程碑

| 里程碑 | 范围 | DoD | 验证 | 状态 |
|---|---|---|---|---|
| M1 文档与追溯 | 建立 ECN-0005、v3-index、v3 执行计划 | v3 文档存在；每个需求点有验收命令；无乱码 | 乱码扫描无命中 | done |
| M2 阅读控制 | 柠檬品牌、favicon、宽模式、分页、排序、footer | 首页可分页；排序链接改变文章顺序；宽模式 class 生效；footer 可见 | `npm test -- tests/public/posts.test.ts` 7 passed；`npm run e2e` 4 passed | done |
| M3 管理动作 | 列表和详情页编辑/逻辑删除入口，未登录隐藏，已登录执行 | 访客看不到编辑/删除；已登录删除先确认再更新 `status=draft`；编辑页能按 slug 预填文章 | `npm test -- tests/admin/auth.test.ts` 4 passed；`npm run e2e` 10 passed | done |
| M4 发布验证 | 全量验证与文档回填 | 单测、类型、构建、E2E 全绿；差异列表更新 | `npm test` 26 passed；`npx tsc --noEmit` 通过；`npm run build` 通过；`npm run e2e` 10 passed | done |
| M5 草稿管理补齐 | 后台列出草稿，支持从草稿列表回到编辑器 | 草稿按更新时间倒序列出；逻辑删除降级后的文章可在后台重新编辑或发布 | `npm test -- tests/public/posts.test.ts` 9 passed；`npm run e2e` 10 passed | done |

## 计划索引

- [v3-public-reading-admin-actions.md](./v3-public-reading-admin-actions.md)

## 追溯矩阵

| Req ID | ECN | v3 Plan | 测试/命令 | 状态 |
|---|---|---|---|---|
| REQ-0001-004 | ECN-0005 | v3-public-reading-admin-actions | `tests/admin/auth.test.ts`、`tests/e2e/public.spec.ts` | done |
| REQ-0001-005 | ECN-0005 | v3-public-reading-admin-actions | `tests/public/posts.test.ts`、`tests/e2e/public.spec.ts` | done |

## ECN 索引

- ECN-0005：前台阅读控制与管理动作入口。

## 差异列表

- 当前 v3 范围已完成。逻辑删除使用现有 `draft` 状态隐藏公开文章，不需要修改生产库 check constraint。
- 已补齐草稿管理：后台登录后能看到草稿列表，访客前台不显示编辑/删除按钮，删除动作必须先经浏览器确认。
