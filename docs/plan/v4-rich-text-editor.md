# v4-rich-text-editor: TipTap 富文本编辑器升级

## Goal

让后台编辑器覆盖个人博客写作的主要格式能力，并在 iOS/手机上保持可触控、可滚动、可输入。

## PRD Trace

- REQ-0001-004：后台富文本编辑器支持图片上传和保存 HTML。
- REQ-0001-005：公开页面和移动端布局稳定，编辑产生的 HTML 可以被公开页安全渲染。

## Scope

做：

- 增加 TipTap 扩展：链接、下划线、文本对齐、表格、表格行、表格头、表格单元格。
- 工具栏增加标题、段落、粗体、斜体、下划线、删除线、行内代码、引用、列表、代码块、分割线、链接、图片、表格、撤销、重做。
- 图片支持按钮上传、粘贴上传、拖拽上传，继续调用 `/api/uploads/image`。
- 表格支持插入 3x3、加行、加列、删表。
- 编辑器工具栏自动换行，不通过横向拖动隐藏按钮，并适配窄屏与 iOS Safari。
- 编辑器工具栏在长文页面滚动时保持 sticky 悬浮。
- 编辑器每个工具按钮提供 `title` 悬浮提示和 `aria-label`。

不做：

- v4 不做视频上传。
- v4 不做字体族、字号、颜色、背景色、全屏模式。
- v4 不做复杂图片裁剪或媒体库。

## Acceptance

- `npm run e2e` 通过，后台登录后能看到 H1、项目符号、链接、图片、表格、代码块、撤销、重做按钮。
- `npm run e2e` 通过，移动端 admin 页面无水平滚动，工具栏无横向滚动，滚动时保持 sticky，按钮高度不小于 44px，按钮有 `title` 提示。
- `npm test -- tests/public/posts.test.ts` 通过，公开页清洗允许编辑器生成的链接、表格、代码块、图片 HTML。
- `npm run build` 通过。
- 反作弊条款：不能只渲染静态按钮；按钮必须调用 TipTap command 或图片上传流程，隐藏 textarea 必须随编辑器内容变化。

## Files

- `src/components/RichTextEditor.tsx`
- `app/globals.css`
- `tests/e2e/public.spec.ts`
- `tests/public/posts.test.ts`
- `package.json`
- `package-lock.json`
- `docs/prd/PRD-0001-vercel-blog-migration.md`
- `docs/ecn/ECN-0006-rich-text-editor-upgrade.md`
- `docs/plan/v4-index.md`

## Steps

1. 写失败测试：后台编辑器 toolbar 和移动端断言、公开 HTML 清洗断言。
2. 跑到红：确认失败来自按钮/移动端能力缺失。
3. 安装并接入 TipTap 扩展。
4. 实现工具栏、图片粘贴/拖拽上传、链接和表格命令。
5. 实现 iOS/移动端样式。
6. 跑相关测试到绿。
7. 全量验证并回填 v4-index。

## Risks

- 表格扩展会增加编辑器复杂度。v4 只提供基础表格命令，避免过度设计。
- iOS Safari 对文件选择和粘贴图片支持受系统限制。v4 同时保留文件选择按钮作为稳定入口。
- 旧 wangEditor 的颜色、字体、视频、全屏能力不进入 v4，避免把编辑器变成大型排版系统。
