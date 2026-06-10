# ECN-0006: 富文本编辑器能力升级与移动端友好

## 基本信息

- **ECN 编号**：ECN-0006
- **关联 PRD**：PRD-0001
- **关联 Req ID**：REQ-0001-004、REQ-0001-005
- **发现阶段**：v4 富文本编辑器升级
- **日期**：2026-06-10

## 变更原因

v1 的 TipTap 编辑器只有粗体、斜体和图片上传，和旧项目 wangEditor 的默认能力差距明显。旧项目通过 wangEditor default mode 提供标题、引用、基础样式、列表、对齐、链接、图片、表格、代码块、撤销重做等能力，并通过 `/api/v1/uploadapi/upload_image` 支持图片上传。迁移到 Vercel 后仍需要保留适合个人博客写作的主要编辑能力，同时保证 iOS Safari 和窄屏手机可用。

## 变更内容

### 原设计

PRD-0001 要求后台富文本编辑器支持创建、编辑、保存富文本文章，并支持图片上传到 Vercel Blob。

### 新设计

- 编辑器工具栏升级为多组 controls：标题、段落、粗体、斜体、下划线、删除线、行内代码、引用、无序列表、有序列表、代码块、分割线、链接、图片、表格、撤销、重做。
- 图片支持按钮选择文件、粘贴图片和拖拽图片上传。
- 表格支持插入 3x3 表格、增加行、增加列、删除表格。
- 工具栏自动换行，移动端不得把页面撑出横向滚动，按钮触控面积不小于 44px。
- 工具栏在长文编辑时随页面滚动保持顶部悬浮，不让长文章编辑失去格式按钮。
- 每个工具按钮提供鼠标悬浮提示，并保留可访问名称。
- iOS 输入区域字号不小于 16px，避免聚焦时自动放大。
- 编辑器区域使用 `-webkit-overflow-scrolling: touch`，适配 iOS 惯性滚动。

## 影响范围

- 受影响的 Req ID：REQ-0001-004、REQ-0001-005
- 受影响的 vN 计划：v4-index、v4-rich-text-editor
- 受影响的测试：`tests/e2e/public.spec.ts`、`tests/public/posts.test.ts`
- 受影响的代码文件：`src/components/RichTextEditor.tsx`、`app/globals.css`、`package.json`、`package-lock.json`

## 处置方式

- [x] PRD 已同步更新
- [x] v4 计划已同步更新
- [x] 相关测试已同步更新
