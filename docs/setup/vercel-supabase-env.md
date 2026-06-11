# Vercel 与 Supabase 环境变量配置指南

这份指南按 `hsk_shop` 的 Supabase 命名习惯来写：用 `APP_ENV` 选择开发库或生产库，再用 `SUPABASE_DEV_*` / `SUPABASE_PROD_*` 分别保存两套 Supabase 配置。

## 为什么和之前看起来不一样

Supabase 现在推荐的新 key 名是：

- publishable key：前端可用的公开 key
- secret key：服务端使用的私钥

`hsk_shop` 已经使用这套新命名：

```text
SUPABASE_DEV_PUBLISHABLE_KEY
SUPABASE_DEV_SECRET_KEY
SUPABASE_PROD_PUBLISHABLE_KEY
SUPABASE_PROD_SECRET_KEY
```

我之前给的 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` 是更普通的单项目写法。为了和你已有项目保持一致，本项目现在优先使用 `hsk_shop` 这种分环境写法，同时保留旧写法兼容。

## 本项目推荐变量

| 变量名 | 来源 | 必填 | 用途 |
|---|---|---:|---|
| `APP_ENV` | 自己设置 | 是 | `development` 或 `production` |
| `SUPABASE_DEV_URL` | Supabase | 开发环境必填 | 开发 Supabase 项目地址 |
| `SUPABASE_DEV_PUBLISHABLE_KEY` | Supabase | 开发环境必填 | 开发库 publishable key |
| `SUPABASE_DEV_SECRET_KEY` | Supabase | 开发环境必填 | 开发库服务端 secret key |
| `SUPABASE_PROD_URL` | Supabase | 生产环境必填 | 生产 Supabase 项目地址 |
| `SUPABASE_PROD_PUBLISHABLE_KEY` | Supabase | 生产环境必填 | 生产库 publishable key |
| `SUPABASE_PROD_SECRET_KEY` | Supabase | 生产环境必填 | 生产库服务端 secret key |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | 是 | 服务端上传图片到 Vercel Blob |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway | 在线估算必填 | 服务端调用 `openai/gpt-5.2` 估算食谱卡路里 |
| `ADMIN_PASSWORD` | 自己设置 | 是 | 单人后台登录密码 |
| `AUTH_COOKIE_SECRET` | 自己生成 | 是 | 后台登录 cookie 的签名密钥 |
| `USE_FIXTURE_DATA` | 本地/E2E 测试 | 否 | 使用内置测试文章，不连真实 Supabase |

如果你现在只有一个 Supabase 项目，可以先把同一套值填到 `SUPABASE_DEV_*`。等之后有生产库，再补 `SUPABASE_PROD_*`。

兼容变量名仍然可用，但不推荐作为主写法：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 在 Supabase 获取项目地址和密钥

1. 打开 `https://supabase.com/dashboard`。
2. 进入你为这个博客新建的 Supabase 项目。
3. 点击左侧边栏的 **Project Settings**。
4. 打开 **API** 页面。
5. 复制项目地址：
   - 开发库填到 `SUPABASE_DEV_URL`。
   - 生产库填到 `SUPABASE_PROD_URL`。
   - 通常长这样：`https://<project-ref>.supabase.co`。
6. 复制 publishable key：
   - 开发库填到 `SUPABASE_DEV_PUBLISHABLE_KEY`。
   - 生产库填到 `SUPABASE_PROD_PUBLISHABLE_KEY`。
7. 复制 secret key：
   - 开发库填到 `SUPABASE_DEV_SECRET_KEY`。
   - 生产库填到 `SUPABASE_PROD_SECRET_KEY`。
   - 这个 key 只能服务端使用，不能提交到仓库，也不能写进前端代码。

如果 Supabase 页面显示旧名字：

- `anon` key 对应 publishable key。
- `service_role` key 对应 secret key。

## 在 Supabase 创建空表

1. 在 Supabase 项目里打开 **SQL Editor**。
2. 点击 **New query**。
3. 打开本仓库文件：

```text
supabase/schema.sql
```

4. 把 SQL 全部复制到 Supabase SQL Editor。
5. 点击 **Run**。
6. 在 **Table Editor** 确认有这些表：
   - `posts`
   - `assets`
   - `post_assets`
   - `tags`
   - `post_tags`
7. 在数据库函数里确认有：
   - `search_posts(q text)`
   - `save_post_tags(...)`
   - `save_post_tags_for_post(...)`
   - `list_recipe_tags()`
   - `list_recipe_posts_by_tag(tag_slug text)`
   - `list_recipe_posts_by_tags(tag_slugs text[])`
   - `search_recipe_posts_by_tags(q text, tag_slugs text[])`
   - `list_tags_for_post(target_post_id uuid)`

注意：不要用旧 `refs/lemon_blog/app.db` 做迁移验收。真实迁移输入源是 `refs/lemon_blog_sync_latest`，执行前先确认 Blob token 和 Supabase secret key 已配置。

也可以用 Supabase CLI 应用同一个 schema：

```powershell
supabase login
supabase link --project-ref zlscvciucppvsrorwzjt
supabase db query --linked --file supabase/schema.sql
```

`.env` 里的 Supabase secret key 只给应用服务端 API 使用，不能执行 `create table` / `create function` 这类 DDL。schema 变更必须使用 SQL Editor、数据库连接串，或已登录并 link 到项目的 Supabase CLI。

## 本地 .env 配置

复制示例文件：

```powershell
Copy-Item .env.example .env
```

本地开发示例：

```text
APP_ENV=development
SUPABASE_DEV_URL=https://<project-ref>.supabase.co
SUPABASE_DEV_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_DEV_SECRET_KEY=<secret-key>
SUPABASE_PROD_URL=
SUPABASE_PROD_PUBLISHABLE_KEY=
SUPABASE_PROD_SECRET_KEY=
BLOB_READ_WRITE_TOKEN=<blob-read-write-token>
AI_GATEWAY_API_KEY=<ai-gateway-api-key>
ADMIN_PASSWORD=<你自己设置的后台长密码>
AUTH_COOKIE_SECRET=<随机生成的 cookie 密钥>
```

如果你要在 Vercel Production 使用生产库：

```text
APP_ENV=production
SUPABASE_PROD_URL=https://<prod-project-ref>.supabase.co
SUPABASE_PROD_PUBLISHABLE_KEY=<prod-publishable-key>
SUPABASE_PROD_SECRET_KEY=<prod-secret-key>
```

生成 `AUTH_COOKIE_SECRET`：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

E2E 测试不用手动配置 `USE_FIXTURE_DATA=1`，Playwright 配置会自动注入。

## 在 Vercel 配置环境变量

1. 打开 `https://vercel.com/dashboard`。
2. 进入这个博客对应的 Vercel 项目。
3. 打开 **Settings**。
4. 打开 **Environment Variables**。
5. 逐个添加变量。
6. 建议这样配：
   - Vercel Development / Preview：`APP_ENV=development`，填 `SUPABASE_DEV_*`。
   - Vercel Production：`APP_ENV=production`，填 `SUPABASE_PROD_*`。
7. 保存。
8. 如果修改的是生产环境变量，保存后重新部署一次。

如果你目前只有一个 Supabase 项目，也可以在 Vercel Production 里暂时把同一套值填到 `SUPABASE_PROD_*`。

## 获取 Vercel AI Gateway Key

v6 食谱卡路里在线估算使用 Vercel AI Gateway：

```text
AI_GATEWAY_API_KEY=<Vercel AI Gateway API key>
```

约束：

- 只在服务端使用，不要加 `NEXT_PUBLIC_` 前缀。
- 默认模型固定为普通 `openai/gpt-5.2`，不使用 `openai/gpt-5.2-pro`。
- 后台只有在文章类型为食谱并主动选择估算时才调用。
- 存量食谱批量估算使用本地 JSONL 导入，不消耗 Vercel AI Gateway tokens。

## 获取 Vercel Blob Token

推荐流程：

1. 打开 Vercel 项目。
2. 进入 **Storage**。
3. 创建或连接一个 **Blob** 存储。
4. 把 Blob 存储连接到当前项目。
5. Vercel 可能会自动给项目加上 `BLOB_READ_WRITE_TOKEN`。
6. 如果没有自动生成，就进入 Blob 存储的设置或 token 页面，创建或复制 read-write token。
7. 在 Vercel 项目的环境变量里添加：

```text
BLOB_READ_WRITE_TOKEN=<复制到的 token>
```

这个 token 只能服务端使用，不要加 `NEXT_PUBLIC_` 前缀。

## 本地验证

填好 `.env` 并在 Supabase 执行 schema 后，运行：

```powershell
npm test
npm run build
npm run dev
```

打开后台：

```text
http://localhost:3000/admin
```

用 `ADMIN_PASSWORD` 登录，创建一篇文章，再到公开页确认能读到。

## 安全注意事项

- 不要提交 `.env`。
- 不要暴露 `SUPABASE_DEV_SECRET_KEY` / `SUPABASE_PROD_SECRET_KEY`。
- 不要暴露 `BLOB_READ_WRITE_TOKEN`。
- 不要暴露 `AI_GATEWAY_API_KEY`。
- publishable key 可以在浏览器使用，但仍然应该通过环境变量管理。
- 如果 secret 被贴到聊天、日志、git 或公开 issue 里，立刻去 Supabase/Vercel 轮换。
