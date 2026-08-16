# Upstream Sync Runbook（Phase 6）

> Chimera 跟随 OpenCode 上游的标准流程与冲突预算检查。

## 流程

```bash
# 1. 拉取上游
git fetch upstream dev

# 2. 基于上游创建短分支（≤3 词，无斜杠）
git switch -c sync-$(date +%Y%m%d) upstream/dev

# 3. 把 Chimera 的 main 合并/变基进来（推荐 merge 以保留冲突现场）
git merge main

# 4. 解决冲突（按「预期冲突点」）
# 5. 验证
bun install
cd packages/core && bun typecheck && bun test
cd packages/opencode && bun typecheck && bun test test/provider
cd packages/app && bun typecheck && bun test --conditions=solid --preload ./happydom.ts ./src
cd packages/desktop && bun typecheck
cd packages/chimera-plugin && bun typecheck && bun test

# 6. 接入点契约检查（脚本：确认关键 slot/import 仍存在）
bun ./script/check-upstream-slots.ts   # 见下

# 7. 视觉回归（人工：深浅双主题 × 关键窗口）
# 8. 打包烟测
bun --cwd packages/desktop build
```

## 预期冲突点与处理

| 文件 | 冲突概率 | 处理 |
|---|---|---|
| `packages/opencode/src/provider/provider.ts` | 中 | 保留精简版 + reasoningVariants 分支，忽略上游新 provider |
| `packages/desktop/electron-builder.config.ts` | 低 | 保留 chimera 品牌值 |
| `packages/app/src/pages/session.tsx` | 中 | Turn Ledger/Ribbon 挂载块；上游改动大时先摘出再重挂 |
| `packages/app/src/components/chimera-*` | 低 | 纯新增/独立，冲突即保留 chimera 版本 |
| `packages/chimera-*`（brand/ui/plugin） | 零 | 永不冲突 |

## 接入点契约（check-upstream-slots）

脚本检查以下"上游文件中的 Chimera 接入点"仍存在：

1. `app/src/main.tsx` 的 `@chimera/ui` import
2. `opencode/src/plugin/index.ts` 的 `ChimeraPlugin`（internalPlugins）
3. `opencode/src/provider/provider.ts` 的 `ModelsDev.findModel` 调用
4. `desktop/src/main/windows.ts` 的 1440×900 默认窗口
5. `app/src/pages/layout(-new).tsx` 的 ChimeraRail/StatusBar 挂载
6. `app/src/pages/session.tsx` 的 ChimeraTurnLedger/ContextRibbon
7. `desktop/src/preload/types.ts` 的 keyVault（ElectronAPI）

任一缺失即 CI 报告失败，人工评估是"上游重构需适配"还是"接入点被意外删除"。

## 分叉登记（有意分叉清单）

| 文件/行为 | 原因 | 回滚路径 |
|---|---|---|
| `provider.test.ts` 2 个 opencode loader 测试 skip | opencode 托管 provider 已裁剪（commit-B） | 恢复 loader 时取消 skip |
| `enabled_providers` 供应商收敛（chimera-plugin） | 预置仅中转站 | 删除钩子行即恢复上游 |
| 测试层 disableDefaultPlugins | provider 测试豁免供应商收敛 | 移除 layer 覆盖 |
