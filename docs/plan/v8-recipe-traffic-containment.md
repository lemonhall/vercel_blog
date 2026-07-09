# v8 食谱流量扇出治理执行计划

## Goal

在保持 v7 私有门禁的前提下，把 `/recipes` 从可枚举、多 RPC、全量数据、无缓存的动态路径改造成 URL 有界、查询有界、投影有界且可主动失效的读取链路。

## PRD Trace

- `REQ-0001-008`：多 tag AND 筛选必须保留。
- `REQ-0001-009`：列表只展示最终 kcal，详情保留完整明细。
- `REQ-0001-010`：普通浏览器私有登录流程不回归。
- `REQ-0001-011`：抓取、URL、RPC、字段和缓存上限。

## Scope

做：robots、crawler 403、tag 规范化与表单、metadata、分页列表 RPC、有限字段、缓存和后台失效、单元/schema/E2E/生产边界验证。

不做：解除门禁、取消多 tag、替换 Supabase、引入 Redis/搜索引擎、用旧 N+1 回退、在配额限制期间反复探测生产数据库。

## Acceptance

1. 已知 crawler 的未登录 `/recipes` 请求返回 403；普通浏览器未登录请求保持 303 到 `/admin`。
2. `robots.txt` 返回 `User-agent: *` 和 `Disallow: /`。
3. tag 参数去重排序；HTML 没有把新 tag 追加到当前 tag 集合的链接；多 tag 由 GET 复选表单提交。
4. 多 tag、搜索和非首页分页 metadata 为 `noindex,follow`；canonical 稳定。
5. `listRecipePostsPage` 的数据库路径只调用 `list_recipe_posts_page` 一次，满页不调用逐篇 tags/nutrition RPC。
6. SQL RPC 在数据库内过滤、排序、分页并返回总数；返回定义不含正文、食材明细和原始 AI JSON。
7. 首页列表使用明确字段而非 `*`。
8. 公开读取包装器使用稳定缓存；后台保存/删除成功失效，错误路径不失效。
9. 全量单测、类型、构建和 Playwright 退出 0；Review 无未处置 BLOCKER。

## Files

- Create: `app/robots.ts`
- Create: `src/lib/cache-invalidation.ts`
- Modify: `middleware.ts`
- Modify: `src/lib/site-access.ts`
- Modify: `app/recipes/page.tsx`
- Modify: `src/lib/posts.ts`
- Modify: `app/page.tsx`
- Modify: `app/posts/[slug]/page.tsx`
- Modify: `app/api/admin/posts/route.ts`
- Modify: `app/api/admin/posts/delete/route.ts`
- Modify: `supabase/schema.sql`
- Test: `tests/admin/auth.test.ts`
- Test: `tests/foundation/schema.test.ts`
- Test: `tests/public/posts.test.ts`
- Test: `tests/e2e/public.spec.ts`

## Steps

### 1. 抓取入口红绿循环

1. 在 `tests/admin/auth.test.ts` 写失败测试：crawler 访问页面返回 `forbidden`，普通浏览器仍 redirect，合法 session 仍 allow。
2. 运行 `npm test -- tests/admin/auth.test.ts`，预期因 `userAgent`/`forbidden` 未实现而失败。
3. 在 `src/lib/site-access.ts` 增加纯函数 crawler 判断和新 decision；`middleware.ts` 将其映射为 403。
4. 新增 `app/robots.ts`，返回全站 Disallow。
5. 运行相关单测到绿，并由 E2E API request 断言真实 403/robots 响应。

### 2. URL 边界红绿循环

1. 在 `tests/public/posts.test.ts` 增加 tag 解码、去重、排序和重复参数测试。
2. 在 `tests/e2e/public.spec.ts` 先把旧“点击链接递归追加 tag”断言改为复选框提交、canonical/noindex 和无组合链接断言，确认红灯。
3. 从 `app/recipes/page.tsx` 抽出可测试的 canonical tags 逻辑；tag 云使用 GET form checkbox，不在链接中保留已有集合。
4. 文章 tag 链接只生成单 tag URL；多 tag/search/page metadata 使用 robots noindex。
5. 运行 public 单测和 recipes E2E 到绿。

### 3. 有界 RPC 红绿循环

1. 在 `tests/foundation/schema.test.ts` 写失败断言：新 RPC、窗口总数、limit 上限、有限返回字段，且函数定义中没有禁止字段。
2. 在 `tests/public/posts.test.ts` 写失败测试：数据库路径只收到一次 `list_recipe_posts_page` RPC，参数包含 q/tags/offset/limit/sort，返回行映射为 `PostWithTags`。
3. 在 `supabase/schema.sql` 实现分页投影 RPC；在 `src/lib/posts.ts` 用一个底层函数替换食谱列表的 N+1 分支。
4. 首页分页 `select` 改为明确列表字段。
5. 运行 schema/public 测试到绿，执行 `npx tsc --noEmit`。

### 4. 缓存失效红绿循环

1. 对缓存包装器和失效函数写失败测试，使用可注入 adapter 避免 Vitest 依赖 Next 运行时全局状态。
2. 实现 `src/lib/cache-invalidation.ts`，统一失效 `posts`、`recipes`、首页、食谱页和相关 slug。
3. 无 client 的页面读取路径进入 Next 数据缓存；注入 client 和 fixture 路径保持直接调用。
4. 后台保存和逻辑删除仅在成功后调用失效函数。
5. 运行 admin/public 测试到绿，并验证失败路径没有失效调用。

### 5. 全量验证与发布

1. 运行 `npm test`，预期全部通过。
2. 运行 `npx tsc --noEmit`，预期退出 0。
3. 运行 `npm run build`，预期 Next production build 成功。
4. 运行 `npm run e2e`，预期 Desktop Chrome 和 mobile 项目全部通过。
5. 独立 reviewer 对照 PRD/ECN/计划/diff/测试证据执行最多 3 轮 Review。
6. Supabase 服务恢复后先执行 `supabase db query --linked --file supabase/schema.sql`，确认成功后才允许应用生产部署。
7. 生产 smoke 验证 crawler 403、普通登录 303、robots 200；登录后验证食谱列表/筛选/详情。
8. 回写 v8-index 证据、差异、Review 和 Trigger Audit，提交并推送。

## Risks

- 新 SQL RPC 的聚合和窗口计数可能出现重复行：schema 测试和 fixture RPC 映射测试覆盖，生产前用小 limit smoke。
- Next cache API 在测试环境不可直接观察：把失效决策放在纯 adapter，框架绑定保持薄层。
- 多 tag UI 从链接改为表单可能影响移动端：Playwright desktop/mobile 同时覆盖。
- Supabase 配额限制可能阻止 schema 发布：保持门禁，不发布依赖新 RPC 的应用，不输出 fully done 信号。
- crawler User-Agent 可伪造：它不参与认证，只用于把未登录响应从 redirect 收敛为 403。
