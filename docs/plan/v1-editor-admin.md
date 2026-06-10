# v1 Editor Admin Plan

## Goal

提供单人后台写作能力，用现代富文本编辑器替换旧 wangEditor，并支持认证后的图片上传到 Vercel Blob。

## PRD Trace

- REQ-0001-004
- REQ-0001-001

## Scope

做：

- 实现单人登录保护。
- 实现文章列表、创建、编辑、保存。
- 集成 TipTap React 编辑器。
- 图片上传走认证后的 Blob 上传流程。
- 保存 `content_html`。

不做：

- 不做多人权限管理。
- 不做评论审核后台。
- 不做复杂媒体库。
- 不保留 Flask-AppBuilder 后台界面。

## Acceptance

- 未登录用户访问后台会被拒绝或重定向。
- 登录用户可创建文章，保存后数据库有记录。
- 登录用户可上传图片，图片进入 Blob，正文插入新图片地址。
- 编辑已有文章后 `updated_at` 更新。
- Playwright 覆盖登录、创建文章、上传图片、保存文章流程。

## Files

- `app/admin/**`
- `app/api/**`
- `components/editor/**`
- `lib/auth/**`
- `lib/blob/**`
- `tests/e2e/**`

## Steps

1. TDD Red：写后台鉴权和文章保存 API 测试，写 Playwright 草稿流程预期。
2. Run Red：预期后台路由和 API 不存在失败。
3. Green：实现认证、文章表单、TipTap 编辑器、保存 API。
4. Run Green：API 测试通过。
5. Refactor：把 editor、upload、post service 边界拆清楚。
6. E2E：运行 Playwright 后台写作流程，预期 exit code 0。

## Risks

- TipTap 输出 HTML 与历史 HTML 风格不完全一致。
- Blob 直传授权流程如果做复杂，会影响 v1。
- 后台鉴权过重会拖慢核心迁移目标。

## Anti Cheat

不能只做一个 textarea 保存正文；必须集成富文本编辑器并完成图片上传闭环。

