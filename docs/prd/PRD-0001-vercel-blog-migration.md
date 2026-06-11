# PRD-0001: Vercel Blog Migration

## Vision

把柠檬叔现有的个人博客从 Linode/Python/SQLite/本地图片目录迁移为 Vercel 友好的现代博客系统。新系统必须保留历史文章和图片资产的可迁移性，提供更好的公开阅读体验，保留单人后台写作和富文本图片上传能力，并把数据库、图片、构建、部署都改成适合 Vercel serverless/edge 环境的架构。

成功状态：

- 旧文章可以从真实生产数据源迁移到新系统，不以 `refs/` 快照作为全量事实来源。
- 历史正文中的图片引用可以被发现、上传、重写、校验，并能重复运行迁移流程。
- 新博客部署在 Vercel，图片存储在对象存储，数据库使用 Supabase Postgres。
- 后台富文本编辑器支持图片上传，上传路径不依赖 Vercel 本地可写文件系统。
- 公开页面在桌面和移动端有现代、可读、稳定的视觉体验。
- 公开页面支持基础全文搜索，使用 Supabase Postgres 的 `ILIKE` 查询即可。
- 食谱类文章可以形成独立频道，并通过 tags 云按菜系、食材、做法等维度浏览；多个 tags 同时选择时使用 AND 交集筛选。[ECN-0007]

## Context

旧项目位于 `refs/lemon_blog`，是 2023 年左右的 Flask-AppBuilder 项目。当前观察到的旧快照事实：

- 业务模型只有 `Notes`：`id`、`title`、`content`，并继承 AppBuilder `AuditMixin`。
- SQLite 表 `notes` 实际包含：`created_on`、`changed_on`、`id`、`title`、`content`、`created_by_fk`、`changed_by_fk`。
- `content` 保存 HTML 富文本。
- 旧编辑器为 wangEditor 本地打包文件，图片上传接口返回 `/static/uploads/<filename>`。
- 当前快照中 `app/static/uploads` 有 2847 个文件，约 393 MB。
- 当前快照中 SQLite 有 369 篇文章，333 篇包含图片。
- 以上只作为结构参考，不代表真实生产全量。Linode 上存在更多图片和可能更新的数据库。

## Architecture Decision

采用方案 A：

- Web 框架：Next.js App Router + TypeScript。
- 部署：Vercel。
- 数据库：Supabase Postgres。
- ORM/查询层：Drizzle 或 Prisma，实施时按项目复杂度和迁移脚本 ergonomics 决定。
- 图片存储：Vercel Blob，历史图片和新上传图片都不进入 Git 仓库或 Vercel 构建产物。
- 编辑器：TipTap React 富文本编辑器，正文继续保存 HTML，降低历史迁移风险。
- 认证：单人后台认证，优先 Auth.js 或同等 serverless 兼容方案。

## Requirements

### REQ-0001-001: Vercel Friendly Architecture

动机：旧项目依赖 Flask 长进程、SQLite 文件、本地上传目录，不适合 Vercel serverless 部署。

范围：

- 新应用必须能在 Vercel 上构建和运行。
- 运行时不得依赖本地持久化文件写入。
- 图片上传不得写入项目目录。
- 数据库连接方式必须适配 serverless 环境。

非目标：

- 不要求兼容 Flask-AppBuilder。
- 不要求保留旧后台 UI。

验收：

- `npm run build` 成功。
- 无代码路径把用户上传文件写入项目内 `public/`、`app/`、`src/` 或临时持久目录。
- 数据库连接配置全部来自环境变量。

### REQ-0001-002: Database Migration Compatibility

动机：旧 SQLite 数据必须能平行迁移到新数据库，且保留历史 ID 和时间信息。

范围：

- 新库必须有 `posts` 表保存文章。
- 必须保存 `legacy_id`、标题、HTML 正文、创建时间、更新时间。
- 旧 AppBuilder 用户/权限表默认不迁移为业务数据。
- 迁移脚本必须支持从真实生产 SQLite 文件导入，而不是固定读取 `refs/` 快照。

非目标：

- 不迁移 Flask-AppBuilder 的角色、菜单、权限结构。
- 不要求旧 URL 与新后台 URL 一致。

验收：

- 给定 SQLite 输入文件，迁移脚本可导入全部 `notes` 行。
- 重复运行同一 SQLite 输入不会产生重复文章。
- 每篇文章可通过 `legacy_id` 回查来源。

### REQ-0001-003: Asset Migration And URL Rewriting

动机：旧正文中图片路径可能来自本地 `/static/uploads/...`、豆瓣远程 URL、Linode 远程目录或其他历史路径。

范围：

- 建立 `assets` 表记录旧路径、来源 URL、Blob URL、校验值、大小、迁移状态。
- 迁移脚本必须扫描 HTML 中的图片引用。
- 迁移脚本必须支持本地目录源、远程 URL 源、Linode 清单源。
- 正文导入时必须把旧图片地址重写为新可访问地址。
- 输出 missing、orphan、failed、rewritten 迁移报告。

非目标：

- v1 不做图片内容智能压缩或 AI 增强。
- v1 不强制删除未引用历史图片。

验收：

- 对同一图片重复迁移是幂等的。
- 每个被重写的图片 URL 都能追溯到一条 `assets` 记录。
- 迁移报告列出所有无法下载或无法匹配的资源。

### REQ-0001-004: Rich Text Editing With Image Upload

动机：旧 wangEditor 依赖本地静态文件和本地上传接口，维护性与 Vercel 兼容性不足。

范围：

- 后台编辑器支持创建、编辑、保存富文本文章。
- 编辑器支持上传图片到 Vercel Blob。
- 上传结果插入正文 HTML。
- 图片上传必须经过后台认证。
- 编辑器支持博客写作常用格式：标题、引用、基础文字样式、列表、链接、图片、表格、代码块、分割线、撤销重做。[ECN-0006]
- 编辑器工具栏在长文编辑时保持 sticky 悬浮，并适配 iOS/手机触控。[ECN-0006]
- 前台文章列表和详情页可以提供管理员编辑入口。[ECN-0005]
- 前台删除动作必须是逻辑删除，只把文章降为草稿隐藏，不得物理删除文章行。[ECN-0005]

非目标：

- v1 不实现多人协作编辑。
- v1 不实现复杂媒体库管理。

验收：

- 已登录用户可以上传图片并在编辑器中看到图片。
- 保存文章后，公开页可正常渲染该图片。
- 未登录请求不能上传图片。
- Playwright E2E 覆盖后台编辑器增强工具栏、移动端无水平溢出和 sticky toolbar。[ECN-0006]

### REQ-0001-005: Public Blog Reading Experience

动机：迁移目标之一是让前端更好看，并改善阅读体验。

范围：

- 公开首页展示文章列表。
- 文章详情页渲染 HTML 正文。
- 搜索页或搜索入口支持按关键词查询文章标题和正文。
- 首页支持分页和按发布时间正序/逆序切换。[ECN-0005]
- 首页和详情页支持宽模式，便于阅读宽内容。[ECN-0005]
- 全站包含柠檬品牌标识、favicon 和 footer。[ECN-0005]
- 图片自适应容器宽度。
- 代码块有可读样式。
- 桌面和移动端布局稳定。

非目标：

- v1 不做评论系统。
- v1 不做多主题切换。

验收：

- Playwright E2E 覆盖首页到文章详情的阅读流程。
- Playwright E2E 覆盖搜索关键词并进入搜索结果文章的流程。
- Playwright E2E 覆盖分页、排序、宽模式、footer 和前台管理入口。[ECN-0005]
- 移动端宽度下正文、图片、标题不溢出。
- 文章 HTML 渲染经过白名单清洗或等效安全处理。

### REQ-0001-006: Operational Safety

动机：迁移历史内容和图片有数据丢失风险，必须可观察、可恢复、可重跑。

范围：

- 所有迁移命令支持 dry-run。
- 迁移日志包含输入源、数量、成功、失败、跳过。
- 迁移脚本不得默认删除源数据或远程资源。
- 环境变量和密钥不得进入仓库。

非目标：

- v1 不自动修改 Linode 生产环境。

验收：

- dry-run 不写目标数据库和 Blob。
- 失败报告可定位到具体文章或图片。
- 仓库中无 `.env`、密钥、Blob token、数据库密码。

### REQ-0001-007: Basic Database Search

动机：个人博客需要能按关键词查找历史文章，但 v1 不需要引入独立搜索基础设施。

范围：

- 支持按关键词搜索 `posts.title` 和 `posts.content_html`。
- 搜索使用 Supabase Postgres 的 `ILIKE` 或等效 LIKE 查询。
- 搜索结果展示标题、摘要、时间，并可进入文章详情。
- 空关键词不执行全表搜索请求，返回默认提示或重定向到文章列表。

非目标：

- v1 不接入 Algolia、Meilisearch、ElasticSearch。
- v1 不做中文分词、排序权重、拼写纠错。
- v1 不做向量搜索。

验收：

- 给定标题命中的关键词，搜索结果包含对应文章。
- 给定正文命中的关键词，搜索结果包含对应文章。
- 给定无结果关键词，搜索页显示空状态。
- 搜索查询使用参数化 SQL 或 ORM 参数绑定，不拼接用户输入。

### REQ-0001-008: Recipe Channel And Tags

动机：历史博客中有大量食谱，混在普通日记和技术笔记中不利于阅读和复用。食谱需要独立频道，也需要通过 tags 云按菜系、食材、做法、场景等维度浏览。

范围：

- `posts` 必须能区分普通文章和食谱。
- 食谱文章必须能关联多个 tags。
- tags 必须支持稳定 slug，方便公开 URL 和未来迁移。
- 公开页面新增 `/recipes` 食谱频道，只展示已发布食谱。
- 公开页面新增按 tag 过滤食谱的路径，例如 `/recipes/tags/<tagSlug>`。
- 公开页面支持在 `/recipes?tags=<slug1>,<slug2>` 多选 tags，筛选结果必须同时拥有所有已选 tags；点击已选 tag 可取消该 tag，并提供全部取消入口。
- 食谱频道展示 tags 云，标签数量来自已发布食谱。
- 后台编辑器支持手工编辑文章类型和 tags。
- 初始化识别必须由 AI 阅读标题和正文内容后给出“是否食谱”和 tags 建议，程序脚本只能负责导出待识别文本、导入审核后的结构化结果、校验 slug 和引用关系。

非目标：

- v5 不做复杂分类层级、营养数据、菜谱步骤结构化、购物清单或评论系统。
- v5 不用关键词规则、正则或纯程序化分类来替代 AI 对正文内容的判断。
- v5 不要求一次性完成所有历史文章的最终人工审校，但导入流程必须支持断点续跑和重复导入。

验收：

- Supabase schema 包含 `posts.content_kind`、`tags`、`post_tags`，并有必要唯一约束和索引。
- 后台新建/编辑文章时可以选择普通文章或食谱，并保存 tags。
- `/recipes` 只展示已发布食谱，不展示普通文章或草稿。
- `/recipes/tags/<tagSlug>` 只展示带该 tag 的已发布食谱。
- `/recipes?tags=<slug1>,<slug2>` 只展示同时带有所有已选 tags 的已发布食谱，并支持取消单个 tag 或全部取消。
- 食谱频道 tags 云显示每个 tag 的使用数量。
- 初始化导入同一批 AI 标注结果重复运行不会产生重复 tags 或重复关联。
- AI 标注结果必须以人类可读 JSON/JSONL 文件留档，便于抽查、修正和重跑。

## Proposed Data Model

```text
posts
- id
- legacy_id
- title
- slug
- content_html
- excerpt
- status
- content_kind
- created_at
- updated_at
- published_at

assets
- id
- legacy_path
- source_url
- blob_url
- blob_pathname
- sha256
- size
- content_type
- status
- migrated_at

post_assets
- post_id
- asset_id

tags
- id
- name
- slug
- tag_type
- sort_order
- created_at

post_tags
- post_id
- tag_id
- created_at
```

## Constraints

- `refs/lemon_blog/app.db` 和 `refs/lemon_blog/app/static/uploads` 只用于结构分析和脚本样本测试，不作为真实全量数据源。
- Linode 上的真实数据源必须在执行迁移前通过配置或清单显式声明。
- 数据库使用 Supabase Postgres。
- Vercel Blob 用于图片，不把历史图片提交进 Git。
- 正文 v1 继续保存 HTML，不在迁移阶段强制转 Markdown 或 TipTap JSON。
- 所有迁移逻辑必须幂等。

## Risks

- 真实 Linode 图片路径可能与 SQLite HTML 引用不完全一致。
- 历史 HTML 可能包含不规范标签，需要安全清洗但不能破坏正文。
- Vercel Blob 访问流量成本取决于真实访问量。
- 后台认证如果设计过重，会拖慢 v1 交付。
- `ILIKE` 搜索在数据量变大后可能变慢；v1 接受该取舍，后续可通过索引或 ECN 引入更强搜索。
