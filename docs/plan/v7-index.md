# v7-index: 全站私有访问门禁

## 愿景

关联 `PRD-0001`、`ECN-0009` 和 `REQ-0001-010`。v7 的目标是把博客从公开阅读临时切换为私有访问：只有输入现有后台密码并拿到 `admin_session` cookie 的访问者才能进入公开页面、搜索、食谱和文章详情，从而在页面查询 Supabase 前拦截爬虫流量。

## 里程碑

| 里程碑 | 范围 | DoD | 验证 | 状态 |
|---|---|---|---|---|
| M1 文档与追溯 | ECN-0009、v7-index | 变更原因、门禁边界、测试范围清晰 | `git diff --text`；乱码扫描无命中 | done |
| M2 Middleware 门禁 | `middleware.ts`、Edge-safe token 校验 | 未登录页面访问重定向到 `/admin?next=...`；登录页和登录 API 放行；静态资源放行；受保护 API 未登录返回 401 | `npm test -- tests/admin/auth.test.ts` | done |
| M3 E2E 回归 | Playwright 公共流程改为先登录 | 登录后可浏览文章、搜索、食谱和后台；未登录入口会被拦截 | `npm run e2e` | done |
| M4 发布验证 | 全量验证与回顾 | 单测、类型、构建、E2E 通过；文档差异闭合 | `npm test`；`npx tsc --noEmit`；`npm run build`；`npm run e2e` | done |

## 追溯矩阵

| Req ID | ECN | v7 Plan | 测试/命令 | 状态 |
|---|---|---|---|---|
| REQ-0001-010 | ECN-0009 | v7-index | `tests/admin/auth.test.ts`、`tests/e2e/public.spec.ts` | done |

## ECN 索引

- ECN-0009：全站私有访问门禁。

## 差异列表

- 暂无未闭合实现差异。

## 验证证据

- `npm test`：5 个测试文件，55 条测试通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：Next.js 生产构建通过，包含 Middleware。
- `npm run e2e`：Playwright 14 条通过。
