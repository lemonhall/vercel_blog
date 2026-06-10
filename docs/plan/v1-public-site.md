# v1 Public Site Plan

## Goal

实现现代、可读、响应式的公开博客首页、基础搜索和文章详情页，正确渲染历史 HTML 正文、图片和代码块。

## PRD Trace

- REQ-0001-005
- REQ-0001-001
- REQ-0001-007

## Scope

做：

- 首页文章列表。
- 基于 Supabase Postgres `ILIKE` 的基础搜索。
- 搜索结果页或搜索结果区域。
- 文章详情页。
- 响应式正文排版。
- HTML 安全清洗或等效可信渲染边界。
- 图片自适应宽度。
- 代码块样式。
- 基础 SEO metadata。

不做：

- 不做评论系统。
- 不做外部搜索服务、中文分词、向量搜索。
- 不做多主题切换。
- 不做营销式 landing page。

## Acceptance

- 首页显示已发布文章列表。
- 输入标题关键词，搜索结果显示匹配文章。
- 输入正文关键词，搜索结果显示匹配文章。
- 输入无结果关键词，搜索页显示空状态。
- 搜索查询使用参数绑定，不拼接用户输入。
- 点击文章进入详情页。
- 详情页标题、日期、正文、图片正常显示。
- 移动端 390px 宽度无横向溢出。
- Playwright public reading flow 通过。
- HTML 中危险标签或事件属性不会执行。

## Files

- `app/page.*`
- `app/posts/[slug]/page.*`
- `app/search/page.*` 或等效搜索路由
- `components/post/**`
- `styles/**`
- `tests/e2e/**`

## Steps

1. TDD Red：写文章查询、搜索查询和 HTML sanitization 测试，写 Playwright 阅读/搜索流程。
2. Run Red：预期页面和查询模块不存在失败。
3. Green：实现首页、详情页、正文渲染、样式。
4. Run Green：单元测试和构建通过。
5. Refactor：整理 post query、rendering、CSS 边界。
6. E2E：桌面和移动端跑阅读流程，保存失败截图。

## Risks

- 历史 HTML 标签不规范，清洗策略过严会丢内容，过松有 XSS 风险。
- `ILIKE` 在数据量变大后可能变慢，v1 先接受，后续再用索引或搜索服务升级。
- 大图可能影响首屏速度，需要后续优化策略。
- 旧文章 slug 生成可能碰撞，需要稳定冲突处理。

## Anti Cheat

不能只显示纯文本摘要；必须渲染 HTML 正文、图片、代码块，并通过移动端 E2E。搜索不能只做前端过滤，必须走数据库查询路径。
