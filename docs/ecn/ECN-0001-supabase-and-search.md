# ECN-0001: Supabase And Basic Search

## 基本信息

- **ECN 编号**：ECN-0001
- **关联 PRD**：PRD-0001
- **关联 Req ID**：REQ-0001-001，REQ-0001-005，新增 REQ-0001-007
- **发现阶段**：v1 implementation start
- **日期**：2026-06-10

## 变更原因

用户明确要求：

- 数据库使用 Supabase。
- v1 要做全文搜索，但只使用数据库 `LIKE` / `ILIKE`，不引入外部搜索引擎。

## 变更内容

### 原设计

- 数据库写为“托管 Postgres，优先 Neon/Supabase 等 serverless 友好的 Postgres 服务”。
- v1 public site 非目标包含“不做全文搜索”。

### 新设计

- 数据库锁定为 Supabase Postgres。
- v1 加入基础搜索需求：按文章标题和 HTML 正文做数据库 `ILIKE` 查询。
- 不引入 Algolia、Meilisearch、ElasticSearch、向量检索或额外搜索服务。

## 影响范围

- 受影响的 Req ID：REQ-0001-001，REQ-0001-005，REQ-0001-007
- 受影响的 vN 计划：v1-foundation，v1-public-site，v1-index
- 受影响的测试：public search flow，post query tests
- 受影响的代码文件：后续 `lib/posts/**`、`app/search/**` 或等效路径

## 处置方式

- [x] PRD 已同步更新
- [x] v1 计划已同步更新
- [x] 追溯矩阵已同步更新
- [ ] 相关测试待实现时同步更新

