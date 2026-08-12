# Chimera Code — 品牌定制化改造计划

> 基于 OpenCode（sst/opencode）做品牌定制，目标：最小化 diff、快速同步上游。

---

## 项目背景

OpenCode 是一个开源 AI 编程工具（Electron + Bun monorepo）。
Chimera 在其基础上做品牌定制，通过自有 AI 网关（`https://api.chimerahub.org/`）提供服务，
面向企业用户发布桌面客户端。

网关同时支持 **OpenAI 协议**和 **Anthropic 协议**，客户端两套 SDK 均保留。

**核心约束：** 上游 OpenCode 持续迭代，我们需要能快速跟进新版本，
因此所有改动必须保持最小 diff、易于 rebase。

---

## 仓库结构

```
chimera-code/                     ← 本仓库（Duojiyi/chimera-code）
├── packages/
│   ├── chimera-brand/            ← 【新增】品牌常量包 @chimera/brand（纯新增，永不冲突）
│   ├── chimera-plugin/           ← 【新增】Chimera 后端功能（纯新增，永不冲突）
│   ├── chimera-ui/               ← 【新增】Chimera UI 组件（纯新增）
│   ├── opencode/                 ← 继承自 OpenCode，仅改 provider 层 + 插件接入点
│   ├── desktop/                  ← Electron 桌面端（品牌 + 遥测改动）
│   ├── app/                      ← Web renderer（加一行 chimera-ui 接入）
│   └── ...                       ← 其余包原样继承
```

### 远程配置

```bash
origin   → https://github.com/Duojiyi/chimera-code   # 我们的仓库
upstream → https://github.com/sst/opencode            # OpenCode 上游（只读，默认分支 dev）
```

---

## 核心原则

1. **Chimera 自有代码永远不写进现有 OpenCode 文件。** 所有功能代码在新建的包/文件里。
2. **上游文件的改动只有接入点（import 语句）和少数配置项。** rebase 时冲突面极小。
3. **插件系统是后端扩展的首选，UI 改动走独立包。**

---

## 改动分层（按 commit 组织）

所有定制分为 5 个原子 commit，rebase 时每个独立处理。

### commit-A：品牌配置（零冲突）

新建 `packages/chimera-brand`（`@chimera/brand`，无构建步骤的 ESM + 手写类型），集中所有品牌常量：

```ts
export const BRAND = {
  name: "Chimera",
  nameLower: "chimera",
  appId: "io.chimera.desktop",
  scheme: "chimera",                       // URL protocol: chimera://
  gatewayUrl: "https://api.chimerahub.org/",
  github: { owner: "Duojiyi", repo: "chimera-code" },
} as const
```

消费方（改动量极小）：
- `packages/desktop/electron-builder.config.ts`
- `packages/desktop/src/main.ts`（窗口标题、scheme 注册）
- `packages/desktop/package.json`（name、homepage、author）

### commit-B：Provider 裁剪 + 系统插件接入（2 个文件）

**文件 1：** `packages/opencode/src/provider/provider.ts`

Chimera 网关（`https://api.chimerahub.org/`）同时支持 OpenAI 和 Anthropic 协议，
因此 `BUNDLED_PROVIDERS` 精简为仅保留这两个 SDK：

```ts
const BUNDLED_PROVIDERS = {
  "@ai-sdk/anthropic": () =>
    import("@ai-sdk/anthropic").then((m) => m.createAnthropic),
  "@ai-sdk/openai-compatible": () =>
    import("@ai-sdk/openai-compatible").then((m) => m.createOpenAICompatible),
}
```

移除 `custom()` 中 opencode 托管 provider 及其余所有内置 loader，
只保留 `chimera` custom loader（指向 `https://api.chimerahub.org/`，注入鉴权 token）。

**文件 2：** `packages/opencode/src/plugin/loader.ts`

在用户插件加载前强制注入系统插件（chimera-plugin），约 2-3 行改动：
```ts
// 系统插件在用户插件之前加载，用户无需手动配置
const SYSTEM_PLUGINS = ["@chimera/plugin"]
```

### commit-C：遥测移除（3–4 个文件）

移除 Sentry 用户端遥测：
- `packages/desktop/package.json`：删除 `@sentry/solid`、`@sentry/vite-plugin`
- `packages/desktop/electron.vite.config.ts`：删除 sentryVitePlugin
- renderer 入口文件：删除 `Sentry.init()` 调用

**保留：** Effect.js 内部 OpenTelemetry span（仅内部链路追踪，无用户数据）

**额外处理：移除/重定向 OpenCode 云服务**

OpenCode 内置了调用 `opencode.ai` 后端的功能，品牌替换后这些入口会静默报错：
- `packages/opencode/src/share` — 会话分享
- `packages/opencode/src/sync` — 同步
- `packages/opencode/src/account` — 账号系统
- `packages/opencode/src/auth`（OAuth 指向 opencode.ai）

处理方式：在 UI 层隐藏对应入口，或将 API 域名改为 Chimera 服务域名（如果我们提供同等功能）。

### commit-D：桌面定制（资产 + 配置）

| 改动点 | 原值 | 目标值 |
|--------|------|--------|
| App ID | `ai.opencode.desktop` | `io.chimera.desktop` |
| 产品名 | `OpenCode` | `Chimera` |
| URL Scheme | `opencode://` | `chimera://` |
| 自动更新源 | `anomalyco/opencode` | `Duojiyi/chimera-code` |
| 安装包名（Linux）| `opencode` | `chimera` |
| 图标 | OpenCode 图标 | Chimera 品牌图标 |
| 官网链接 | `opencode.ai` | 待确认域名 |

UI 内可见的 "opencode" 文字（TUI 提示、设置页等）通过 chimera-ui 覆盖或在构建时替换。

### commit-E：chimera-ui 接入点（低冲突）

在 `packages/app/src/main.tsx`（或 renderer 入口）加一行：
```ts
import "@chimera/ui"   // 挂载 Chimera 自定义 UI 组件
```

`packages/chimera-ui/` 本身是纯新增，不影响 rebase。

---

## 自有功能扩展架构

OpenCode 插件系统 `Hooks` 覆盖完整的后端生命周期，但**无 UI hook**。
因此正确的扩展策略是四层叠加：

```
┌─────────────────────────────────────────────────────────┐
│  Layer 4: Skills（零冲突）                               │
│  预置 agent 工作流，放入 desktop/resources/skills/       │
├─────────────────────────────────────────────────────────┤
│  Layer 3: MCP servers（零冲突）                          │
│  打包进桌面端的预配置 MCP，对接 Chimera 自有 API         │
├─────────────────────────────────────────────────────────┤
│  Layer 2: packages/chimera-plugin/（零冲突，纯新增）     │
│  · auth：中转站账号密码登录 → 同步账号下全部密钥        │
│  · 多密钥管理：本地保存多条密钥，快速切换当前密钥        │
│  · 自定义 agent tools（调用 Chimera 服务）               │
│  · chat.headers 注入当前密钥鉴权                        │
│  · 事件上报到 Chimera 自有分析（替代 Sentry）            │
│  · permission.ask 企业权限策略                          │
├─────────────────────────────────────────────────────────┤
│  Layer 1: packages/chimera-ui/（零冲突，纯新增）         │
│  · 企业登录 / SSO 页面                                   │
│  · 团队 / 工作区管理界面                                 │
│  · 自定义侧边栏、设置页、品牌样式覆盖                    │
│  接入点：packages/app 里一行 import（唯一冲突风险点）    │
└─────────────────────────────────────────────────────────┘
```

### 决策树：功能加在哪一层

```
要加的功能是…
│
├─ 调外部 API / 数据源？          → MCP server
├─ 自定义 provider / 模型认证？   → chimera-plugin (auth + provider hook)
├─ 给 agent 新增工具能力？        → chimera-plugin (tool hook)
├─ 拦截 / 修改 LLM 请求参数？    → chimera-plugin (chat.params / chat.headers)
├─ 企业权限 / 审计日志？         → chimera-plugin (permission.ask + event hook)
├─ 预置 agent 工作流模板？        → Skills
└─ UI 界面 / 用户交互流程？       → chimera-ui 包
```

### chimera-plugin 可用 Hooks（OpenCode 插件 API）

```ts
interface Hooks {
  tool?                     // 注册自定义 agent 工具
  auth?                     // 自定义认证方式（OAuth / API Key）
  provider?                 // 注册自定义模型提供商
  "chat.params"?            // 修改发给 LLM 的参数（temperature 等）
  "chat.headers"?           // 注入请求头（鉴权 token）
  "chat.message"?           // 拦截消息
  "tool.execute.before"?    // 工具调用前钩子（审计、权限）
  "tool.execute.after"?     // 工具调用后钩子（日志）
  "permission.ask"?         // 企业权限策略覆盖
  "shell.env"?              // 注入环境变量
  event?                    // 监听所有事件（用于分析上报）
  config?                   // 配置加载钩子
}
```

---

## 版本策略

- Chimera 版本号独立维护，不跟随 OpenCode 版本
- 对用户只展示 Chimera 版本号，不暴露基于 OpenCode 的信息
- 内部以 git tag 记录对应的上游 commit（`upstream/opencode@1.18.15`），便于追溯和同步

---

## 上游同步流程

### 日常同步

```bash
# 1. 拉取上游最新
git fetch upstream

# 2. 在 main 上 rebase（原子 commit 依次 replay；上游默认分支为 dev）
git rebase upstream/dev

# 3. 处理冲突（主要集中在 provider.ts，偶发 electron-builder.config.ts）
git rebase --continue

# 4. 验证
bun install && bun typecheck && bun run dev:desktop
```

### 预期冲突点

| 文件 | 冲突概率 | 处理方式 |
|------|----------|----------|
| `packages/opencode/src/provider/provider.ts` | 中 | 保留精简版，忽略上游新增 provider |
| `packages/desktop/electron-builder.config.ts` | 低 | 手动合并，保留 chimera 品牌值 |
| `packages/app/src/main.tsx`（接入点）| 低 | 保留 chimera-ui import，接受上游变更 |
| `chimera.brand.ts` | 零 | 纯新增文件，永不冲突 |
| `packages/chimera-plugin/`、`packages/chimera-ui/` | 零 | 纯新增包，永不冲突 |

---

## 待确认事项

- [x] Chimera 网关 API 协议 — OpenAI-compatible + Anthropic，网关 `https://api.chimerahub.org/`
- [x] 登录方式 — **不做企业 SSO**。采用中转站账号密码登录（登录后自动同步该账号全部密钥），
      同一中转站支持多条密钥快速切换（`⌘⇧K` / 设置·密钥页 / 命令面板），用量按密钥独立统计。
      设计稿见 S5（连接网关）、S6（设置·密钥）。
- [ ] OpenCode 云服务（share、sync、account）：移除还是接入 Chimera 自有服务？
- [ ] 桌面版品牌图标素材
- [ ] 自动更新发布渠道（GitHub Releases？私有分发？需要代码签名证书）
- [ ] 是否保留 `packages/console`、`packages/stats`、`packages/slack` 等 SST 后端包
- [ ] 官网域名（对外展示用）

---

## Phase 0：UI 设计（先于所有编码工作）

在动任何代码之前，先用 **Pencil + MCP** 把完整的前端样式设计稿做出来。
设计稿作为 chimera-ui 实现阶段的直接参照，避免边写边改。

### OpenCode 现有屏幕清单（设计基准）

通过阅读 `packages/app/src/` 整理，OpenCode 桌面端共有以下主要界面：

| 屏幕 | 路径/组件 | 说明 |
|------|-----------|------|
| 首页 | `pages/home.tsx` | 会话列表、历史记录 |
| 新建会话 | `pages/new-session.tsx` | 项目选择、模型选择 |
| 会话主界面 | `pages/session.tsx` | 核心：对话区 + 文件树 + 终端 tabs |
| 设置 — 通用 | `components/settings-v2/general.tsx` | 行为、快捷键等 |
| 设置 — 模型 | `components/settings-v2/models.tsx` | 模型列表管理 |
| 设置 — Providers | `components/settings-v2/providers.tsx` | API key 配置 |
| 设置 — MCP 服务 | `components/settings-v2/servers.tsx` | MCP server 管理 |
| 命令面板 | `components/dialog-command-palette-v2.tsx` | ⌘K 全局搜索 |
| 连接 Provider 弹窗 | `components/dialog-connect-provider.tsx` | 首次引导 |
| 管理模型弹窗 | `components/dialog-manage-models.tsx` | 启用/禁用模型 |

### 设计工作范围

1. **设计语言**：定义 Chimera 品牌色板、字体、圆角、间距规范
2. **组件库**：Button、Input、Card、Tag、Tabs、Modal 等基础组件的 Chimera 样式
3. **屏幕设计**（按优先级）：
   - P0：会话主界面（用户时间最长的地方）
   - P0：首页（第一印象）
   - P1：新建会话流程
   - P1：Provider 连接 / 首次引导
   - P2：设置各 tab
   - P2：命令面板
4. **交互细节**：loading 态、空状态、错误态

### 设计工具链

- **Pencil**：UI 设计主工具，通过 MCP 驱动，便于 AI 直接生成和调整设计稿
- 设计预览图输出到 `design/` 目录（`.pen` 源文件在 Pencil 文档中，token 命名空间 `ch-*`）
- 设计完成后导出标注图，作为 chimera-ui 开发的规格文档

### 设计阶段成果（2026-08-12）

已完成 6 个屏幕 × 深浅双主题（同一套 `ch-*` 变量按 `mode` 主题轴取值）：

| 屏幕 | 预览图（深/浅） | 要点 |
|------|----------------|------|
| S1 会话主界面 | `s1-session-main-*.png` | 任务清单卡 + 活动时间线（工具调用生命周期）与对话分离；模型选择器在输入区（跟随上游 composer 模式） |
| S0 首页 | `s0-home-*.png` | 进行中会话卡 + 按日分组历史 |
| S2 新建会话 | `s2-new-session-*.png` | 指令优先 + 项目选择 |
| S3 设置·模型 | `s3-settings-models-*.png` | 网关模型表 + 启用开关 |
| S4 命令面板 | `s4-command-palette-*.png` | 行式列表（图标+名称+行内描述），含"切换密钥 ⌘⇧K" |
| S5 连接网关 | `s5-connect-gateway-*.png` | 账号密码（默认）/ 企业令牌 双页签登录 |
| S6 设置·密钥 | `s6-settings-keys-*.png` | 多密钥管理：掩码、独立用量、当前标记、一键切换 |

**设计语言**：墨青画布 + 熔金主强调色 + 青金完成色；奇美拉渐变线（熔金→青金）仅用于品牌标、
流式输出进度与上下文用量条；发丝线分层代替阴影；数据一律 JetBrains Mono；中文 Noto Sans SC。

---

## 实施顺序

### Phase 0（已完成 2026-08-12）
1. ✅ 确认 provider 协议和网关域名
2. ✅ 在 Pencil 中完成全套 UI 设计稿（S0–S6，深浅双主题）

### Phase 1（已完成 2026-08-12）
3. ✅ 配置 upstream remote（默认分支 dev），main = 上游完整历史 + Chimera 原子提交
4. ✅ commit-A：`packages/chimera-brand` 品牌常量包 + 桌面端品牌接入
5. ✅ commit-B：provider 裁剪（仅 anthropic + openai-compatible）+ 系统插件注入
6. ✅ commit-C：移除 Sentry（桌面 + Web 渲染层）
7. ✅ commit-D：品牌图标全套（gen-icons 管线，147 PNG + ico/icns）+ builder 配置
8. ✅ commit-F：数据目录与本机已装 opencode 完全隔离（叶子目录 chimera + CLI XDG 圈定）

### Phase 2（Chimera 自有层，主体完成）
9. ✅ commit-E/G/H：chimera-ui（设计 token、chimera 默认主题、品牌字体、文案构建时替换）
10. ✅ 供应商收敛：预置仅中转站一个，用户自定义 provider 自动放行
11. ✅ S5 连接界面（账号密码/API 密钥双页签）+ 服务端 api-authorize 链路
12. ✅ 中转站模型动态同步（provider.models 钩子拉取 /v1/models）
13. ✅ 端到端验证：真实密钥 → 模型入列 → 会话往返 → 工具调用（写/读文件）
14. ✅ 界面对齐：S2 新建会话布局、S0 首页 CTA/分组、S1 用户消息卡片/工具行/AI 头部
15. ✅ 打包验证：`chimera-desktop-win-x64.exe`（NSIS）构建成功、
    打包版可运行、exe 内嵌图标为奇美拉标（任务栏图标随之正确）
16. ✅ S1 应用骨架（左侧图标栏 + 状态栏）、多密钥管理器（设置·提供商·配置 /
    图标栏头像 / Ctrl+Shift+K 全局命令）
17. ✅ S1 元信息行（模型·耗时·tokens·费用，轮次聚合，常驻显示）、活动卡
    （工具/探索分组发丝线卡片，AI 头像仅轮首）
18. ✅ S6 设置·密钥页（表格化：名称/掩码/用量占位/操作，当前徽章 + 使用中渐变点，
    添加即切换实测全通）；S3 模型页每行"协议 · 上下文"元信息
19. ✅ 状态栏实时数据：platform 版本、路由目录 git 分支、当前密钥名
    （chimera:keys-changed 事件同步）、网关主机
20. ✅ 图标栏接线上游会话命令（fileTree/review/terminal toggle），
    按钮可用态跟随命令注册（会话内激活、首页灰置），终端面板实测开合；
    设置·主题移除 opencode.ai 外链
21. ✅ 深浅双主题全景验证（S0 首页 / S1 会话 / S6 密钥页截图比对设计稿）
22. ⏳ 遗留：密钥"本月用量"列待网关统计接口、chimera 组件 i18n 键补全、
    CI 自动打包发布（Phase 3）、中转站上游身份透传（需网关侧渠道配置）、
    网关对话接口延迟波动（15s~120s+）、fileTree.toggle 为上游条件注册
    （缺席时按钮如实灰置）

### Phase 3（发布）
12. 配置 CI（GitHub Actions）自动构建 + 发布

---

*最后更新：2026-08-12*
