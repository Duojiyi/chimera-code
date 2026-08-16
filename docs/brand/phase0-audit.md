# Phase 0 审计：上游差异分类报告

> 状态：基线报告（2026-08-16 后更新）
> 基线：`upstream/dev...HEAD`（已 fetch 最新）
> 用途：路线图 Phase 6（上游友好收敛）的输入，Phase 0 先建立基线

## 1. 差异总览

```text
442 files changed, 16204 insertions(+), 1829 deletions(-)
- 修改上游已有文件：293
- 新增文件：149
```

## 2. 按包分布（改动文件数）

| 包 | 文件数 | 说明 |
|---|---|---|
| packages/desktop | 178 | 大量为品牌资产/构建产物，代码改动集中在 main/preload/ipc |
| design | 102 | 设计稿预览图（Phase 0 需治理：仅 .pen 源文件入库） |
| packages/app | 73 | **主要审查对象**（见下） |
| .github | 20 | CI 发布链路 |
| packages/chimera-plugin | 19 | 纯新增包 |
| packages/ui | 12 | 上游 UI 组件改动（需收敛） |
| packages/chimera-ui | 10 | 纯新增包 |
| packages/core | 7 | config/plugin/variant 等 |
| packages/opencode | 7 | provider 层 |
| packages/session-ui | 3 | 会话 UI（ChimeraEffortControl 等） |
| packages/chimera-brand | 4 | 纯新增包 |

## 3. packages/app 73 个文件分类

### 3.1 chimera-* 组件（品牌，5）
`chimera-avatar / chimera-chrome / chimera-connect / chimera-keys(.test)`

### 3.2 设置/对话框（品牌定制，14）
`dialog-command-palette-v2(.css/.tsx) / dialog-connect-provider / dialog-custom-provider /
dialog-select-model-unpaid-v2 / dialog-settings / settings-general / settings-providers /
settings-v2/(dialog-settings-v2, general-controllers, general, keys, models, providers)`

### 3.3 上下文/状态（品牌逻辑，10）
`global-sync/(queue, queue.test) / highlights / language / layout / local / models /
server-sync / settings(.test)`

### 3.4 hooks/工具（1）
`use-providers`

### 3.5 页面布局（品牌结构，25）
`error / home(.tsx, home-projects-controller, home-sessions-view) / layout(-new) /
deep-links / helpers(.test) / new-session-view / session(.tsx, composer/session-composer-state(.test),
helpers(.test), session-panel-width(.test), session-side-panel, session-turn-rail(.test),
timeline/(message-timeline, rows(.test)), usage-exceeded-dialogs, use-session-commands)`

### 3.6 主题/样式（1）
`public/oc-theme-preload.js`

### 3.7 i18n（3）
`desktop-native / en / zh`

### 3.8 其他（13）
`package.json / app.tsx / prompt-input-v2 / session-header / status-popover-body /
windows-app-menu / desktop-menu / entry / server-compat / server-errors / wsl/(settings-model(.test), settings) / vite.config`

## 4. 关键结构发现（Phase 2/3 的输入）

| 文件 | 改动 | 与路线图的关系 |
|---|---|---|
| `session-turn-rail.tsx` | **新增 184 行** | Turn Ledger 的雏形（0.1.6），Phase 3 的基础 |
| `timeline/message-timeline.tsx` | 修改 57+/2- | 路线图要求"避免修改核心时间线算法"，已被品牌化改动触碰，Phase 6 需审查 |
| `pages/session.tsx` | 修改 68+/39- | 会话主界面深度定制，Turn Ledger/Context Ribbon 的挂载点 |
| `layout.tsx / layout-new.tsx` | 小改（2+/1-, 9+/3-） | **良好**：布局改动保持很小，Phase 2 Shell 的低冲突基础 |
| `context/layout.tsx` | 修改 9+/8- | 布局状态逻辑，Shell 改造的适配层候选 |

## 5. 结论与建议

1. **好消息**：layout 层改动小（2-9 行），说明 Phase 2（Shell）可以低冲突接入；Turn Rail 已存在，Turn Ledger 有地基。
2. **需收敛**：timeline/message-timeline.tsx 被改 57 行（路线图 Phase 3 明确避免改核心时间线），Phase 6 应逐行审查——优先迁移为投影适配层。
3. **设计资产治理**：design/ 102 个文件多为预览图，正式 Pencil 源仅 .pen（已入库 1 个），预览图应移入 `design/previews/` 并治理命名。
4. **下一批分析**：多密钥安全迁移设计（阻断项）、Home+Session 结构标注、Token V1 草案。
