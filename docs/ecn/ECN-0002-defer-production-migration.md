# ECN-0002: Defer Production Migration

## 基本信息

- **ECN 编号**：ECN-0002
- **关联 PRD**：PRD-0001
- **关联 Req ID**：REQ-0001-002，REQ-0001-003，REQ-0001-006
- **发现阶段**：v1 implementation
- **日期**：2026-06-10

## 变更原因

用户明确说明当前 `refs/lemon_blog/app.db` 和图片不全面，Linode 数据尚未拉取到本地。真实迁移工作必须等 Linode 数据完整落地后再做。

## 变更内容

### 原设计

v1 计划包含 SQLite 文章和图片迁移管线，并尝试用 `refs/` 快照作为 fixture 跑 dry-run。

### 新设计

- 当前开发阶段只建立 Supabase 空表/schema、应用骨架、后台、公开站点和搜索。
- 不再执行 `refs/lemon_blog/app.db` 的迁移 dry-run 作为验收依据。
- 迁移脚本和迁移完整验证延后到 Linode 数据拉取完成后执行。
- `refs/` 保持为结构参考，不作为迁移输入事实来源。

## 影响范围

- 受影响的 Req ID：REQ-0001-002，REQ-0001-003，REQ-0001-006
- 受影响的 vN 计划：v1-index；后续由 ECN-0003 移交到 v2-data-migration
- 受影响的测试：迁移 E2E 暂缓，保留纯函数测试
- 受影响的代码文件：迁移 CLI 后续按真实数据源补全

## 处置方式

- [x] PRD 约束保持不变：`refs/` 非权威
- [x] v1 计划已同步更新
- [x] 追溯矩阵已同步更新
- [ ] Linode 数据拉取后新建或更新迁移计划
