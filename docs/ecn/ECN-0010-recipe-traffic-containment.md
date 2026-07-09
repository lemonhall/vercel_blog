# ECN-0010: 食谱抓取流量与查询扇出治理

## 基本信息

- **ECN 编号**：ECN-0010
- **关联 PRD**：PRD-0001
- **关联 Req ID**：新增 REQ-0001-011；补齐 REQ-0001-010 文档追溯
- **发现阶段**：v7 私有门禁上线后的生产流量根因审计
- **日期**：2026-07-10

## 变更原因

生产日志证实 `/recipes` 在约 32 秒内出现 1000 次动态请求。现有食谱列表存在 tag 组合 URL 可枚举、逐篇 tags/nutrition N+1、列表读取完整正文、多 tag RPC 全量返回后在应用层分页、公开读取无跨请求缓存等问题。生产 Supabase 已因 `exceed_egress_quota` 被限制服务。

v7 私有门禁已经阻止未登录请求进入页面数据查询，但普通页面重定向会让爬虫继续访问动态 `/admin`，且门禁未来解除后代码内生扇出仍会复发。因此必须在保持门禁的同时治理入口、URL、查询协议和缓存失效。

## 变更内容

### 原设计

- 所有未登录页面访问统一重定向到 `/admin?next=...`。
- `/recipes` 为动态页面，tag 云的每个链接都会切换当前 tag 集合。
- 食谱分页查询文章后，再逐篇查询 tags 和 nutrition。
- 多 tag RPC 返回全部匹配文章，由 Next.js 排序和分页。
- 列表使用 `posts.*`，包含完整正文；公开读取无显式跨请求缓存。

### 新设计

- 私有站点发布 `robots.txt` 全站禁止抓取；已识别 crawler 访问受保护页面直接返回 403，普通浏览器仍走登录重定向。
- tag 参数统一解码、去重和排序；多 tag 选择使用 GET 表单，不再输出可递归追加 tag 的链接。
- 多 tag、搜索和非首页分页页面使用 `noindex,follow` 与规范 canonical。
- 新增单个分页 RPC，在数据库内完成搜索、AND tag 过滤、排序、分页、tags 聚合、精简 nutrition 和总数计算。
- 列表投影禁止返回正文、食材明细和原始 AI JSON。
- 首页、食谱列表、tag 云和文章详情使用显式数据缓存；后台保存和逻辑删除成功后主动失效。
- 新 RPC 不提供旧 N+1 回退；生产 schema 未应用前继续保持私有门禁。

## 影响范围

- 受影响的 Req ID：REQ-0001-008、REQ-0001-009、REQ-0001-010、新增 REQ-0001-011
- 受影响的 vN 计划：v8-index、v8-recipe-traffic-containment
- 受影响的测试：`tests/public/posts.test.ts`、`tests/admin/auth.test.ts`、`tests/foundation/schema.test.ts`、`tests/e2e/public.spec.ts`
- 受影响的代码：`middleware.ts`、`app/robots.ts`、`app/recipes/page.tsx`、`src/lib/site-access.ts`、`src/lib/posts.ts`、后台 API、`supabase/schema.sql`

## 处置方式

- [x] ECN 已建立
- [x] PRD 已补齐 REQ-0001-010 并新增 REQ-0001-011
- [x] v8 计划和追溯矩阵已建立
- [ ] TDD、E2E、Review Loop 和发布证据已闭合
