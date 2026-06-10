# ECN-0003: Migration Moved To v2

## 基本信息

- **ECN 编号**：ECN-0003
- **关联 PRD**：PRD-0001
- **关联 Req ID**：REQ-0001-002，REQ-0001-003，REQ-0001-006
- **发现阶段**：v1 implementation
- **日期**：2026-06-10

## 变更原因

用户明确要求把所有迁移相关工作移动到 v2。v1 只先建立空表和应用骨架。

## 变更内容

### 原设计

ECN-0002 将真实迁移延期，但 v1 仍保留迁移辅助函数和迁移准备计划。

### 新设计

- v1 移除迁移计划、迁移脚本、迁移辅助函数和迁移测试。
- v1 只保留 Supabase schema 空表。
- v2 新增迁移计划，等待 Linode 数据拉取完成后再执行。

## 影响范围

- 受影响的 Req ID：REQ-0001-002，REQ-0001-003，REQ-0001-006
- 受影响的 vN 计划：v1-index，v2-index，v2-data-migration
- 受影响的测试：迁移测试移出 v1
- 受影响的代码文件：`scripts/migrate/**`、`src/lib/migration.ts`、`tests/migration/**`

## 处置方式

- [x] v1 计划已移除迁移工作
- [x] v2 计划已接收迁移工作
- [x] v1 迁移代码和测试已删除
- [ ] Linode 数据拉取后启动 v2

