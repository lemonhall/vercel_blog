# ECN-0011: 公开缓存并发回填隔离

## 基本信息

- **ECN 编号**：ECN-0011
- **关联 PRD**：PRD-0001
- **关联 Req ID**：REQ-0001-011
- **发现阶段**：v8 Review Round 1 的缓存一致性复查
- **日期**：2026-07-10

## 变更原因

仅在后台写入后调用 Next `revalidateTag`，不能证明已经开始的旧读取不会在失效后完成并重新写入旧数据。3600 秒 TTL 会放大这类并发回填的影响。原计划的“满页最多 2 次 Supabase 调用”也没有为强一致缓存键预留版本读取。

## 变更内容

### 原设计

- 首页、食谱列表、tag 云和详情使用固定 `unstable_cache` 键。
- 后台保存或逻辑删除后调用 tag/path 失效。
- 满页食谱列表和 tag 云合计最多 2 次 Supabase 调用。

### 新设计

- 数据库维护单行 `public_content_versions`；`posts`、`tags`、`post_tags` 和 `recipe_nutrition_estimates` 的 statement trigger 在同一事务内递增版本。
- 每个公开页面请求先读取一次标量版本，并把版本放入 `unstable_cache` 调用参数。旧 in-flight 读取只能回填旧版本键，不能覆盖新版本键。
- 食谱页面级包装器复用一次版本读取，再并行读取食谱列表缓存和 tag 云缓存。
- 热缓存食谱页最多 1 次 Supabase 调用，即标量版本 RPC；冷缓存最多 3 次，即版本、分页列表和 tag 云各 1 次。内容 RPC 仍最多 2 次，且不存在逐篇调用。
- tag/path 主动失效继续保留，用于及时清理和刷新；版本键负责并发隔离。

## 影响范围

- 受影响的 Req ID：REQ-0001-011
- 受影响的 vN 计划：`v8-index`、`v8-recipe-traffic-containment`
- 受影响的测试：`tests/foundation/schema.test.ts`、`tests/public/cache.test.ts`、`tests/public/posts.test.ts`
- 受影响的代码：`src/lib/posts.ts`、`src/lib/public-posts.ts`、`app/recipes/page.tsx`、`supabase/schema.sql`

## 处置方式

- [x] PRD 已同步更新并标注 ECN-0011
- [x] v8 计划与追溯矩阵已同步更新
- [x] schema、标量版本读取和并发回填测试已补充
- [x] 生产 schema、全量回归和 Review Round 2 已闭合
- [ ] 应用生产部署和 live smoke 已闭合
