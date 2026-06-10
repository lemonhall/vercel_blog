# v4-index: 富文本编辑器升级

## 愿景

关联 `PRD-0001` 与 `ECN-0006`。v4 的目标是把后台编辑器从“能录入 HTML”提升到“适合长期写博客”：常用格式一屏可达，图片上传符合 Vercel Blob 架构，表格和代码块可编辑，iOS/手机上不因为工具栏挤压或输入框缩放而难用。

## 旧编辑器能力摘要

旧项目使用 wangEditor default mode。默认 toolbar 包含：标题、引用、粗体、下划线、斜体、删除线、颜色、背景色、字号、字体、行高、无序列表、有序列表、todo、对齐、缩进、链接、图片、视频、表格、代码块、分割线、撤销、重做、全屏。项目自定义上传接口为 `/api/v1/uploadapi/upload_image`，字段名为 `image`。

v4 不照搬旧编辑器的所有菜单，优先恢复博客写作高频能力：标题、文字样式、列表、引用、链接、图片、表格、代码块、分割线、撤销重做。

## 里程碑

| 里程碑 | 范围 | DoD | 验证 | 状态 |
|---|---|---|---|---|
| M1 文档与追溯 | ECN-0006、v4-index、v4 执行计划 | 文档存在；旧编辑器能力有摘要；验收可二元判定；无乱码 | 乱码扫描无命中 | done |
| M2 编辑器能力 | TipTap 工具栏和扩展升级 | 工具栏存在标题、列表、链接、图片、表格、代码块、撤销重做；隐藏 textarea 保存 HTML | `npm run e2e` 6 passed；`npm test -- tests/public/posts.test.ts` 8 passed | done |
| M3 iOS/移动端 | 手机和 iOS 友好样式 | 移动端工具栏自动换行且无横向滚动；工具栏滚动时 sticky 悬浮；按钮最小 44px；按钮有悬浮提示；编辑区 16px 字号；页面无水平溢出 | `npm run e2e` 6 passed | done |
| M4 发布验证 | 全量验证与文档回填 | 单测、类型、构建、E2E 全绿；提交并推送 | `npm test` 25 passed；`npx tsc --noEmit` 通过；`npm run build` 通过；`npm run e2e` 6 passed | done |

## 计划索引

- [v4-rich-text-editor.md](./v4-rich-text-editor.md)

## 追溯矩阵

| Req ID | ECN | v4 Plan | 测试/命令 | 状态 |
|---|---|---|---|---|
| REQ-0001-004 | ECN-0006 | v4-rich-text-editor | `tests/e2e/public.spec.ts` | done |
| REQ-0001-005 | ECN-0006 | v4-rich-text-editor | `tests/e2e/public.spec.ts`、`tests/public/posts.test.ts` | done |

## ECN 索引

- ECN-0006：富文本编辑器能力升级与移动端友好。

## 差异列表

- 当前 v4 范围已完成。旧 wangEditor 的颜色、字体、视频、全屏未进入 v4，保留为后续可选增强。
