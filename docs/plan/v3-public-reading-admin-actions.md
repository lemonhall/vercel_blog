# v3-public-reading-admin-actions: 阅读控制与前台管理入口

## Goal

把首页、详情页和后台动作串成可用闭环：读者能分页、排序、切宽模式；管理员能从前台文章进入编辑或删除。

## PRD Trace

- REQ-0001-004：后台编辑与图片上传能力，v3 扩展为前台编辑入口与文章删除动作。
- REQ-0001-005：公开阅读体验，v3 扩展为品牌、宽模式、分页、排序、footer。

## Scope

做：

- 站点 header 品牌增加柠檬 emoji，并增加柠檬 favicon。
- 首页增加 `page`、`sort`、`wide` 查询参数。
- 首页显示分页控件、时间正序/逆序切换、宽模式切换。
- 已登录管理员在列表卡片和详情页末尾看到编辑/逻辑删除按钮，访客不显示这些按钮。
- 逻辑删除按钮提交前必须弹窗确认。
- 后台页支持 `?edit=<slug>` 预填编辑表单。
- 后台页提供草稿管理列表，能把草稿重新打开编辑或发布。
- 后台文章 API 支持创建、编辑和逻辑删除。
- 全站增加 footer。

不做：

- 不做批量删除。
- 不做物理删除和回收站清空。
- 不做复杂媒体库。
- 不改变 v2 迁移状态文件和迁移策略。

## Acceptance

- `npm test -- tests/public/posts.test.ts` 通过，覆盖分页参数、排序参数、encoded slug 查询、草稿查询。
- `npm test -- tests/admin/auth.test.ts` 通过，覆盖未登录删除跳后台、已登录降为草稿隐藏、编辑保存成功。
- `npm run e2e` 通过，覆盖首页分页、排序、宽模式、footer、访客隐藏管理按钮、管理员前台动作、删除确认、后台草稿管理。
- `npm run build` 通过。
- 反作弊条款：不能只添加静态按钮；访客不能看到前台编辑/删除按钮；删除必须有浏览器确认和服务端认证检查，且只能更新 `posts.status = "draft"`，不得物理删除数据库行；草稿必须能从后台找回。

## Files

- `app/layout.tsx`
- `app/globals.css`
- `app/page.tsx`
- `app/posts/[slug]/page.tsx`
- `app/admin/page.tsx`
- `app/api/admin/posts/route.ts`
- `app/api/admin/posts/delete/route.ts`
- `src/lib/posts.ts`
- `src/lib/fixture-data.ts`
- `supabase/schema.sql`
- `tests/public/posts.test.ts`
- `tests/admin/auth.test.ts`
- `tests/e2e/public.spec.ts`

## Steps

1. 写失败测试：文章分页/排序查询、删除权限、编辑保存、E2E 用户流程。
2. 跑到红：确认失败来自功能缺失，而不是测试拼写错误。
3. 实现阅读控制：分页、排序、宽模式、品牌和 footer。
4. 实现管理动作：编辑预填、更新保存、逻辑删除路由、访客隐藏按钮、删除确认。
5. 实现草稿管理：后台读取 `status=draft` 的文章，按更新时间倒序列出并链接回编辑器。
6. 跑到绿：相关单测与 E2E 通过。
7. 全量验证：`npm test`、`npx tsc --noEmit`、`npm run build`、`npm run e2e`。
8. 更新 v3-index 状态和证据。

## Risks

- 逻辑删除会把文章降为草稿，隐藏公开文章但保留数据库行。后台草稿管理是恢复入口，重新编辑后把状态改为发布即可恢复公开访问。
- 宽模式可能影响移动端。CSS 必须在移动端保持单列和不溢出。
- 分页和排序要保留查询参数，避免切换模式时丢失当前上下文。
