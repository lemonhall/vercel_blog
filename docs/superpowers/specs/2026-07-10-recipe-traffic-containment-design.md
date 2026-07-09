# v8 食谱流量扇出治理设计

## 背景与证据

生产日志显示，私有门禁部署前约 32 秒内出现 1000 次 `/recipes` Serverless 200 请求。当前食谱列表每页最多展示 10 篇，但会执行 1 次列表查询、1 次 tag 云查询，以及每篇各 1 次 tags 和 nutrition 查询，满页约 22 次 Supabase HTTP/RPC 调用。

本地标注数据包含 57 个食谱 tag。现有页面在每个筛选结果中继续输出全部 tag 的切换链接，并保留选择顺序，因此爬虫可发现 57 个一层 URL、3192 个有序二层 URL、175560 个有序三层 URL。生产 Supabase 已返回 `exceed_egress_quota`。

## 目标

- 未登录爬虫不能通过登录重定向继续放大 Vercel 动态请求。
- 私有站点明确通过 `robots.txt` 禁止抓取。
- 页面不再输出可枚举的多 tag 组合链接；同一 tag 集合只有一个规范参数表示。
- 一次食谱列表渲染最多执行 2 次 Supabase 请求：1 次分页列表 RPC 和 1 次可缓存 tag 云 RPC。
- 列表查询不返回 `content_html`、食材明细或原始 AI JSON。
- 多 tag 和搜索筛选在数据库内分页，不把全部匹配正文传到 Vercel 后再切片。
- 公共读取数据使用显式缓存；后台保存和逻辑删除后主动失效。
- 单元、schema、E2E、构建和生产访问边界都有可重复证据。

## 非目标

- 不解除 v7 私有访问门禁。
- 不改变后台密码和 `admin_session` 的凭据格式。
- 不改变食谱正文、tag 关联或 nutrition 的持久化结构。
- 不引入新的搜索引擎、队列或付费防火墙产品。
- 不依赖 User-Agent 识别作为唯一安全边界；它只是 robots 和私有门禁之外的止血层。

## 方案比较

### 方案 A：只使用 Vercel/Cloudflare 防火墙

优点是上线快，不需要改数据库。缺点是 N+1、全量 RPC 和组合 URL 仍留在代码中，规则失效或站点重新公开后会复发，也无法由仓库测试完整验证。

### 方案 B：只优化数据库与缓存

优点是正常访问成本最低。缺点是爬虫仍可枚举大量 URL，缓存键空间会被污染；登录重定向和 Vercel 请求量也不会停止。

### 方案 C：入口、URL、数据、缓存四层治理（采用）

入口层阻止已识别爬虫并发布 robots；URL 层去除多 tag 可发现链接；数据层把列表收敛到分页投影 RPC；缓存层复用稳定结果并由后台写操作失效。该方案同时修复根因和防护边界，且每层都能独立测试。

## 架构设计

### 1. 入口访问边界

新增 `app/robots.ts`。私有站点固定返回 `Disallow: /`，避免合规爬虫继续发现页面。

`SiteAccessDecisionInput` 增加 User-Agent。匹配已知自动抓取客户端时，受保护页面直接返回 `403`，不再重定向 `/admin?next=...`。普通浏览器未登录访问仍保留现有登录重定向，后台登录流程不变。

识别结果不授予权限，只决定“403 还是登录重定向”，因此伪造 User-Agent 不会绕过门禁。

### 2. URL 与抓取空间

所有 tag slug 先解码、去重并按字典序排序，再生成 `tags` 参数。服务端接受旧的逗号格式，并兼容表单产生的重复 `tags` 参数。

tag 云改为 GET 表单复选框。多 tag 组合只有用户提交表单时才产生，不再为每个 tag 输出“在当前集合上增加一个 tag”的链接。文章上的 tag 只链接到单 tag 规范页面。

索引策略：

- `/recipes` 可作为规范入口。
- 单 tag 结果的 canonical 使用排序后的单 tag 查询 URL。
- 多 tag、搜索词和非首页分页设置 `noindex,follow`。
- 多 tag 表单和清除操作不制造顺序不同的等价 URL。

### 3. 分页列表协议

新增 SQL RPC `list_recipe_posts_page`，输入：

- `query_text text`
- `tag_slugs text[]`
- `page_offset integer`
- `page_limit integer`
- `sort_ascending boolean`

输出每篇列表所需的固定投影：文章基础字段（不含 `content_html`）、聚合后的 tags、精简 nutrition 最终值，以及窗口总数 `total_count`。

SQL 在数据库内完成：已发布食谱过滤、搜索、AND tag 交集、排序、分页、tags 聚合和 nutrition 左连接。`page_limit` 在 SQL 内限制为 1..50，负 offset 归零。

应用层所有食谱列表和筛选统一调用这一协议，不再逐篇调用 `list_tags_for_post` 或 `list_recipe_nutrition_estimate`。详情页仍使用完整正文和 nutrition 明细查询。

### 4. 查询投影与数据边界

首页列表也改用明确字段投影，不读取 `content_html`。食谱列表 RPC 不返回：

- `content_html`
- `ingredient_estimates_json`
- `raw_estimate_json`
- `source_hash`
- prompt/model 审计字段

这些字段只在详情或后台编辑路径读取。

### 5. 缓存与失效

建立公开读取缓存边界：

- 首页分页、食谱分页、tag 云和文章详情分别使用稳定缓存键。
- 缓存统一绑定 `posts` tag；食谱相关数据额外绑定 `recipes` tag。
- 后台保存和逻辑删除成功后调用 `revalidateTag("posts")` 和 `revalidateTag("recipes")`，并按 slug 调用 `revalidatePath`。
- 页面可以继续保持 `force-dynamic` 以读取 admin cookie，但 Supabase 数据读取必须命中跨请求数据缓存。

fixture 测试和注入 client 的底层查询函数保持无缓存，保证单元测试可观察调用次数；只有生产页面使用的无 client 包装器进入 Next 数据缓存。

### 6. 错误处理与兼容

- RPC 错误继续抛出明确错误，由食谱页面显示数据库未就绪状态。
- 非法 page、超大 pageSize、重复/空 tag 在进入 RPC 前归一化。
- 新 RPC 是 schema 的部署前置条件；在生产 schema 应用前保持私有门禁，不提供旧 N+1 回退，以免静默恢复高流量路径。
- Supabase 配额受限期间只做本地 schema 测试，不反复请求生产 API。

## 测试设计

### 单元与集成

- 入口：已知 crawler 访问受保护页得到 403；普通浏览器仍得到登录重定向；静态资源和登录入口不回归。
- URL：tag 去重排序；多 tag 页面不包含组合增长链接；旧参数与重复参数得到同一结果。
- 数据：满页食谱列表只调用一个列表 RPC；RPC 参数包含规范 tags、offset、limit 和 sort。
- 投影：schema RPC 不选择正文和原始 nutrition JSON；SQL 内存在 limit 上限、AND tag 和窗口总数。
- 缓存失效：保存和逻辑删除成功后触发正确 cache tags/path；失败时不错误失效。

### E2E

- 未登录普通浏览器仍可进入登录页并登录。
- crawler User-Agent 请求 `/recipes` 得到 403 且不跟随到 `/admin`。
- `robots.txt` 返回全站 Disallow。
- 登录后食谱单 tag、多 tag、搜索、分页、详情和后台修改流程保持可用。
- 多 tag URL 顺序规范化，页面 metadata 为 noindex。

## 发布与回滚

发布顺序：先应用 Supabase schema，再部署应用代码，最后执行生产 smoke。整个过程中 v7 门禁保持开启。

回滚应用时保留新增 RPC 无副作用。若 schema 应用失败，不部署依赖新 RPC 的应用版本。若应用 smoke 失败，回滚 Vercel 部署，门禁继续阻断公开数据库流量。

## 验收上限

- 满页食谱列表底层 Supabase 调用数不超过 2。
- HTML 中不存在从已选 tag 集合继续追加 tag 的链接。
- 食谱列表 RPC 的返回定义不含正文和原始 nutrition JSON。
- `npm test`、`npx tsc --noEmit`、`npm run build`、`npm run e2e` 全部退出 0。
- Review Loop 无未处置 BLOCKER；所有 MAJOR 有明确处置。
