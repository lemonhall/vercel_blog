# v1 Foundation Plan

## Goal

建立 Vercel 友好的 Next.js 应用基础、Supabase Postgres 数据模型、环境变量边界和构建验证，为后续迁移、后台和公开站点提供稳定底座。

## PRD Trace

- REQ-0001-001
- REQ-0001-006

## Scope

做：

- 初始化 Next.js App Router + TypeScript 项目。
- 配置 lint/build/test 脚本。
- 建立 Supabase Postgres 数据模型：`posts`、`assets`、`post_assets`。
- 建立 Blob、数据库、认证相关环境变量说明。
- 加入基础安全约束：密钥不进仓库，上传不写本地持久目录。

不做：

- 不实现完整后台编辑器。
- 不执行真实 Linode 迁移。
- 不提交真实 `.env`。

## Acceptance

- `npm run build` exit code 0。
- 数据库 schema 能通过本地测试数据库或 mock migration 校验。
- 仓库中没有真实密钥文件。
- 上传相关代码没有写入项目目录的路径。

## Files

- `package.json`
- `next.config.*`
- `src/**` 或 `app/**`
- `db/**`
- `.env.example`
- `tests/**`

## Steps

1. TDD Red：为环境变量解析和 schema 定义写失败测试。
2. Run Red：运行测试，预期因模块不存在或 schema 不存在失败。
3. Green：初始化 Next.js 和数据库层，实现最小 schema。
4. Run Green：运行 `npm test` 和 `npm run build`，预期 exit code 0。
5. Refactor：整理配置命名和目录边界，保持测试通过。
6. E2E：启动本地应用，验证首页或健康页可访问。

## Risks

- Supabase Postgres 驱动在 Vercel serverless 下连接配置错误。
- ORM 选择影响迁移脚本 ergonomics。
- 过早搭复杂后台会拖慢 foundation。

## Anti Cheat

不能只创建空 Next.js 项目就标记完成；必须有 schema、环境变量验证、构建验证和至少一个自动化测试。
