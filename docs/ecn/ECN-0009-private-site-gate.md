# ECN-0009: 全站私有访问门禁

## 基本信息

- **ECN 编号**：ECN-0009
- **关联 PRD**：PRD-0001
- **关联 Req ID**：新增 REQ-0001-010
- **发现阶段**：Supabase egress 异常增长后的访问控制加固
- **日期**：2026-07-09

## 变更原因

Supabase egress 在免费额度内明显异常增长，疑似公开页面被爬虫持续访问。当前博客主要供站主本人访问，短期目标是先阻断未授权公开访问，避免页面渲染触发 Supabase 查询继续产生外发流量。

## 变更内容

### 原设计

公开阅读页、搜索页、食谱页和单篇详情页无需登录即可访问；只有后台编辑页和后台 API 依赖 `ADMIN_PASSWORD` 登录。

### 新设计

- 复用现有 `ADMIN_PASSWORD` 和 `admin_session` cookie 作为全站访问凭据。
- 未登录访问公开页面时，在进入页面查询前由 Next middleware 重定向到 `/admin?next=<原路径>`。
- `/admin` 和 `/api/admin/login` 保持未登录可访问，用于输入密码。
- 已登录后继续使用现有后台登录 cookie 访问全站，不新增第二套密码。
- 静态资源和 Next 内部资源不走门禁，避免页面样式、图标和脚本加载失败。
- 其他受保护 API 在未登录时返回 401，避免非页面请求被重定向成 HTML。

## 影响范围

- 受影响的 Req ID：REQ-0001-010
- 受影响的 vN 计划：v7-index
- 受影响的测试：`tests/admin/auth.test.ts`、`tests/e2e/public.spec.ts`
- 受影响的代码文件：`middleware.ts`、`src/lib/site-access.ts`

## 处置方式

- [x] ECN 已建立
- [x] v7 计划已建立
- [x] middleware 与测试已实现
