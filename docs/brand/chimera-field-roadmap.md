# Chimera Field 2.0：品牌重构与上游友好实施路线图

> 状态：提案，待评审  
> 适用仓库：`chimera-code`  
> 基线日期：2026-08-16  
> 基线上游：`upstream/dev`  
> 文档目的：在不牺牲 OpenCode 上游跟进能力的前提下，让 Chimera 从“品牌换肤的 OpenCode”演进为具有独立产品心智、交互语言和视觉系统的开发工作场。

---

## 1. 为什么需要这份新路线图

现有 `PLAN.md` 记录了 Chimera 从品牌替换、网关接入到首个桌面版本发布的完整历史，适合作为项目日志，但不再适合作为下一阶段的执行规格：

1. 计划中的部分状态已经过期。例如旧文档仍将 CI 自动发布列为 Phase 3 待办，但仓库已经存在 `.github/workflows/release-desktop.yml`，支持 Windows、macOS、Linux 多平台构建和 GitHub Release。
2. “品牌代码与上游代码基本隔离”的目标尚未真正实现。以 2026-08-16 的提交基线比较 `upstream/dev...HEAD`：
   - 423 个文件发生变化；
   - 8,016 行新增、1,784 行删除；
   - 283 个上游已有文件被修改，140 个文件为新增；
   - `packages/app` 涉及 70 个文件，`packages/ui` 12 个，`packages/session-ui` 3 个；
   - `packages/desktop` 的 176 个文件中包含大量品牌资产，但仍会扩大上游同步审查面。
3. 现有品牌化主要依赖颜色、字体、文案、全局 CSS 覆盖和局部结构改造，用户仍可一眼识别其 OpenCode 来源，说明“独立品牌心智”尚未建立。
4. 当前实现与最新 Pencil 方向之间存在 Token、字体和组件语言不一致：
   - 代码使用 Noto Sans SC、JetBrains Mono、Space Grotesk；
   - 最新设计探索使用 Geist、Inter、IBM Plex Mono；
   - 颜色命名与部分具体色值也存在分叉。
5. Provider、模型目录、凭据切换和思考强度属于产品能力事实，但一部分展示逻辑曾与供应商类型、缓存生命周期或 UI 条件绑定，导致“切换密钥后需要重启”“非中转站不显示思考强度”等体验问题。
6. 目前设计源文件分散。仓库中的 `design/chimera-field-v2.pen` 不是本轮 Pencil MCP 原生稿；本轮原生设计仍位于 Pencil 文档目录，尚未形成正式的、可追踪的仓库交付物。
7. 当前大量体验改动是多轮局部打磨累积而成，缺少统一的验收矩阵、视觉回归基线、窗口尺寸规范和上游升级冲突预算。

因此，本路线图不是继续追加“第十四轮、第十五轮视觉微调”，而是建立一条能够收敛架构、形成独立产品特征并持续跟随上游的实施路径。

---

## 2. 目标与非目标

### 2.1 产品目标

Chimera Field 2.0 需要让用户在不看应用名称的情况下，也能通过以下特征识别产品：

1. **Chimera Spine**：稳定的产品导航骨架，而不是 OpenCode 左栏换色。
2. **Workspace Strip**：清晰呈现工作区、分支、环境和执行状态。
3. **Context Ribbon / Context Field**：持续显示当前模型将获得哪些上下文、上下文来源和容量。
4. **Turn Ledger**：以“意图 → 计划 → 工具 → 变更 → 验证”的连续执行账本组织会话，而不是只显示聊天消息气泡。
5. **Fusion Composer**：把意图、上下文配方、供应商、模型、思考强度、Agent 和权限统一成一份可解释的执行配方。
6. **Capability Signal**：界面忠实展示当前供应商、凭据和模型共同声明的能力，禁止把不存在的能力伪装成固定选项。
7. **Amber Intent × Viridian Execution**：熔金表达意图、进行中和注意；青金表达执行完成、连接和能力确认。

### 2.2 工程目标

1. 品牌表达层与 OpenCode 业务状态解耦。
2. 上游已有文件的品牌相关修改收敛到少数、命名清晰的接入点。
3. Provider/模型能力事实由领域层提供，UI 只消费，不自行推断。
4. Dark/Light、窗口尺寸、DPI、键盘和无障碍行为都有可重复验证。
5. 每个 Phase 都可独立交付、独立回滚，不要求一次性重写整个客户端。
6. 上游升级可以量化：有冲突预算、升级清单和视觉回归报告。

### 2.3 非目标

1. 不重写 OpenCode 的会话执行引擎、终端、文件树和 Diff 引擎。
2. 不为了“看起来不同”而引入游戏化、3D、大面积玻璃拟态或高成本动画。
3. 不把所有上游组件复制到 Chimera 包中长期分叉。
4. 不在 UI 中硬编码供应商类别、模型能力或思考强度档位。
5. 不在品牌重构阶段同时改造无关的办公插件、Prompt 策略或网关协议。
6. 不把最新 Pencil 草稿直接视为最终批准方案。用户已明确表示当前稿件“不太满意”，因此它只能作为概念输入。

---

## 3. 当前基线审计

### 3.1 已有优势

| 领域 | 已有基础 | 结论 |
|---|---|---|
| 品牌身份 | `@chimera/brand`、独立 App ID、Scheme、图标和数据目录 | 应保留并强化为唯一品牌事实源 |
| UI Token | `@chimera/ui` 已有深浅色、字体和 CSS 变量挂载 | 可演进，不应推倒重来 |
| 产品骨架 | 已有 Chimera Rail、状态栏、会话轨道、密钥管理 | 可作为新 Shell 的迁移起点 |
| Provider 能力 | 已支持网关与自定义 Provider、动态模型同步 | 需统一生命周期和能力事实 |
| 发布 | 多平台 Electron Release 已存在 | Phase 重点转为签名、公证、更新与回滚 |
| 国际化 | 已有中英文 i18n 基础 | 需清除 CSS content 与散落硬编码 |
| 测试 | 密钥、Provider、桌面配置和部分会话 UI 已有测试 | 需补集成、视觉与窗口矩阵 |

### 3.2 主要不足

#### A. 产品识别仍依赖“换色和贴标”

- 信息架构、会话叙事和设置组织仍高度继承 OpenCode。
- 品牌头像、渐变、按钮颜色虽然可见，但不是独占的交互模型。
- 首页、会话、设置各自做了多轮微调，却没有统一的“工作场”概念贯穿。

#### B. 品牌层没有真正形成稳定边界

- `@chimera/ui` 主要负责 Token、字体和 CSS 覆盖；
- 多个 Chimera 组件仍直接位于 `packages/app/src/components`；
- 会话结构改造进入 `packages/session-ui` 和上游时间线文件；
- 全局 CSS 依赖 `data-component`、`data-slot` 和 DOM 结构，升级后容易静默失效；
- 旧计划中的“仅一行 import”与当前现实不一致。

#### C. Token 与设计源存在漂移

- 同一个语义在 TS Token、CSS 变量、Solid 行内样式和 Pencil 中可能有不同值；
- 当前 Token 主要是原始色值，缺少语义层、组件层、间距、排版、圆角、动效和密度 Token；
- 行内使用 `var(--chimera-accent)` 的位置较多，不利于语义审计；
- 字体栈存在 Space Grotesk、Geist、Inter、Noto Sans SC、JetBrains Mono、IBM Plex Mono 多套候选，没有最终治理决策。

#### D. Provider 能力和 UI 生命周期曾发生错位

- 模型目录不能以“是否为中转站”决定展示；
- 思考强度不能固定写死，也不能仅依据模型名称猜测；
- 凭据切换必须使对应 Provider 的模型目录与能力快照失效；
- 工作区缓存、全局缓存和当前活动凭据必须有明确 key；
- UI 必须订阅活跃 Provider/凭据/模型的派生状态，而不是等待应用重启重新初始化。

#### E. 桌面窗口缺少正式规格

此前已经出现 dev 全屏或缩放后布局不匹配的问题。当前需要明确：

- dev 与 release 使用同一组窗口约束；
- 默认窗口、最小窗口、记忆窗口和全屏行为的优先级；
- Windows 100%/125%/150% DPI；
- 1280×800、1440×900、1920×1080 和窄窗口；
- File Tree、Terminal、Review Panel 同时开启时的压缩策略。

#### F. 质量门槛不完整

- 有人工截图，但没有稳定的视觉回归基线和容差；
- 没有针对品牌 CSS 选择器的契约测试；
- 无障碍、键盘路径、Reduced Motion 和色彩对比没有成为发布门槛；
- Release 已自动化，但 macOS 公证、更新回滚、版本兼容和发布验收仍需补齐；
- 本地 `main` 与仓库默认 `dev` 的协作约定不一致，容易误用分支。

#### G. 多密钥当前存在高优先级安全债务

当前 `packages/app/src/components/chimera-keys.tsx` 会把 `{ name, key }` 列表直接序列化到 renderer 的 `localStorage("chimera-keys")`。这意味着：

- 多条 API Key 以可逆明文形式持久化；
- Renderer 中任意获得同源脚本执行能力的代码都可能读取全部密钥；
- “界面掩码显示”并不等于“安全存储”；
- 活动密钥虽会写入服务端 auth，但非活动密钥仍保存在 Renderer；
- 这是安全问题，不应被归类为普通 UI 技术债。

目标状态：

- Renderer 只持有密钥 ID、名称、掩码、指纹和状态；
- 秘密值存入 Electron Main/本地 Server 所有的凭据保险库；
- Windows/macOS 优先使用 OS 凭据能力或 Electron `safeStorage`；Linux 明确能力与降级策略；
- Web 运行形态通过本地 Server 凭据仓库处理，不把秘密写入浏览器存储；
- 提供一次性、幂等的旧 `localStorage` 迁移，成功后立即清除明文；
- 密钥不得进入日志、错误上报、事件 payload、缓存 key 或截图。

该项应作为 Phase 4 上线前的安全阻断项。

---

## 4. 目标架构

### 4.1 分层原则

```text
Brand Facts
  @chimera/brand
      ↓
Design System
  @chimera/ui: semantic tokens, primitives, motion, themes
      ↓
Product Presentation
  Chimera Spine / Context Ribbon / Turn Ledger / Fusion Composer
      ↓
App Adapters
  packages/app/src/chimera/*: map OpenCode state to Chimera props
      ↓
Minimal Upstream Slots
  existing OpenCode files: import + named slot only
```

Provider 能力链路独立于视觉链路：

```text
Credential identity
  + Provider catalog revision
  + Model identity
      ↓
Capability snapshot
      ↓
Reactive active-model projection
      ↓
Fusion Composer / Model Picker / Thinking Strength
```

### 4.2 推荐所有权

| 内容 | 推荐位置 | 允许依赖 | 禁止内容 |
|---|---|---|---|
| 品牌名称、域名、App ID、版本显示策略 | `packages/chimera-brand` | 无运行时 UI 依赖 | DOM、Solid 状态、Provider 逻辑 |
| Token、字体、图标语义、基础组件 | `packages/chimera-ui` | brand、ui primitives | Session Store、Provider Store |
| Chimera 展示组件 | 优先 `packages/chimera-ui` | 纯 props、事件回调 | 直接读取 app context |
| App 适配器 | `packages/app/src/chimera` | app context、chimera-ui | 复制上游核心实现 |
| Provider 能力与缓存 | Provider/Core 对应领域层 | Schema/Protocol 规则 | UI 条件、品牌判断 |
| Electron 窗口与发布 | `packages/desktop` | brand 配置 | UI 能力推断 |
| 凭据秘密 | Electron Main / 本地 Server 凭据保险库 | IPC、auth API | Renderer localStorage、明文事件 |
| 品牌 Prompt 与技能 | `packages/chimera-plugin` | plugin API | 视觉 Token |

### 4.3 上游修改预算

品牌重构完成后的目标，而非立即强制：

- 品牌视觉直接修改的上游已有文件：**不超过 12 个**；
- 每个修改点必须是具名 Slot、Adapter import 或主题入口；
- 不能依赖 `:nth-child`、文本内容或深层 DOM 偶然结构定位；
- 单个接入点应尽量少于 20 行；
- Provider 功能修复与品牌视觉提交分开；
- 每次上游同步必须生成“接入点仍存在”的自动检查报告；
- 无法收敛的改动必须登记为“有意分叉”，说明收益、冲突成本和回滚路径。

这比“零冲突”更真实。目标是可测量、可治理的冲突面，而不是口头保证所有修改都不会冲突。

---

## 5. 设计系统决策

### 5.1 推荐字体收敛

为降低资源体积和维护复杂度，推荐最终只保留三层：

| 角色 | 推荐 | 说明 |
|---|---|---|
| Display / Latin UI | Geist | 标题、英文 UI、品牌层级 |
| CJK UI fallback | Noto Sans SC | 中文正文和控件 |
| Mono / Data | JetBrains Mono | 路径、模型 ID、Token、时间、日志 |

建议移除 Space Grotesk、Inter 和 IBM Plex Mono 的运行时依赖，除非 Phase 0 的盲测能证明其不可替代。Pencil 中可以继续使用近似字体探索，但代码只保留批准后的生产字体。

### 5.2 Token 三层模型

1. **Primitive**：原始颜色和尺寸，不直接在组件中使用。
2. **Semantic**：`bg.canvas`、`bg.shell`、`text.primary`、`signal.intent`、`signal.execute`。
3. **Component**：`composer.border.live`、`ledger.rail.complete`、`spine.item.active`。

Token 至少覆盖：

- Dark / Light 色彩；
- 字体家族、字号、行高、字重；
- 4/8 基础间距；
- 控件、面板、功能表面的三档圆角；
- 发丝线与强调边框；
- 密度模式；
- Motion duration/easing；
- Z-index 和 Overlay；
- Focus ring；
- Reduced Motion 降级。

禁止在新组件中直接写品牌 Hex；旧行内样式在 Phase 6 逐步迁移。

### 5.3 动效规则

允许：

- 1–2px 执行轨迹；
- 输入框在真实执行期间的低频流动；
- Context 容量变化；
- 状态切换和焦点过渡；
- 150–220ms 的轻量进入/按压反馈。

禁止：

- 空闲状态持续抢眼动画；
- 大面积渐变背景；
- 不可关闭的粒子和 3D；
- 仅用于“显得高级”的高成本模糊；
- 在 Reduced Motion 下继续流动。

### 5.4 官方设计源

Phase 0 完成前必须解决设计源治理：

- 正式 Pencil 源文件应保存到仓库约定位置，例如 `design/chimera-field.pen`；
- 只能通过 Pencil MCP 修改 `.pen`；
- 当前 `design/chimera-field-v2.pen` 不自动视为正式源；
- 本轮 MCP 草稿须在批准后另存为正式源，不能只留在用户目录；
- 预览图统一输出到 `design/previews/chimera-field/`；
- 每次设计评审记录版本号、日期、批准项和未批准项；
- 代码 Token 与 Pencil Token 必须有一份映射表。

---

## 6. 分阶段实施计划

## Phase 0 — 基线冻结与方向批准

**目标：** 在继续写 UI 代码前，先解决“做成什么”和“哪些现状必须保留”。

**预计工作量：** 2–4 工程日。  
**准入条件：** 无。  
**退出门槛：** 用户明确批准产品方向、字体方案、四个识别组件和至少两个关键屏幕。

### 工作项

1. 将现有实现按“保留、重构、删除、暂缓”分类：
   - 密钥管理；
   - Provider 连接；
   - Rail / Status Bar；
   - 会话轨道；
   - Prompt 输入；
   - 首页；
   - 设置；
   - 主题和字体；
   - 发布链路。
2. 对当前 Pencil 草稿进行第二轮方向探索，而不是像素微调：
   - 方向 A：安静、专业的工作场；
   - 方向 B：更强的技术蓝图与执行轨迹；
   - 两个方向都必须保持低游戏化。
3. 为 Home 与 Session 各制作一张高保真 Dark 稿；批准后再补 Light。
4. 明确哪些结构真正区别于 OpenCode：
   - Turn Ledger 是否成为默认会话叙事；
   - Context Ribbon 是否常驻；
   - Fusion Composer 是常驻还是渐进展开；
   - Spine 是否替代现有 Rail；
   - 状态栏是否保留。
5. 完成窗口布局规格：
   - 默认 1280×800；
   - 最小建议 960×640；
   - 1440×900 标准工作尺寸；
   - 全屏和高 DPI；
   - Side Panel 同开策略。
6. 冻结 V1 Token 和字体。
7. 建立差异清单：设计稿中的每个结构对应现有代码位置、实现难度和上游冲突风险。

### 交付物

- 正式 Pencil 源文件；
- Home / Session 深色高保真稿；
- Light 色彩样张；
- Token V1；
- 窗口响应矩阵；
- 结构差异清单；
- 决策记录 ADR：为什么选择该方向。

### 验收标准

- 不显示 Logo 时，5 秒内仍能通过至少三个结构特征识别 Chimera；
- 不是依赖主色、圆角或渐变来证明“不同”；
- Home、Session、Composer 的主任务路径清晰；
- 1280×800 无裁切，960×640 有明确降级；
- 用户明确批准后才进入 Phase 1。

### 回滚

本 Phase 不改生产 UI。若方向未批准，只迭代设计稿和 ADR，不积累代码债务。

---

## Phase 1 — 品牌基础与 Token 收敛

**目标：** 建立唯一、可测试、可被设计稿映射的品牌基础层。

**预计工作量：** 3–5 工程日。  
**依赖：** Phase 0 批准。

### 工作项

1. 扩展 `@chimera/ui` Token：
   - Primitive → Semantic → Component；
   - Dark/Light；
   - Typography、Spacing、Radius、Motion、Focus。
2. 清理重复 CSS 变量和行内品牌颜色。
3. 将字体收敛到批准后的三层字体栈。
4. 提供基础视觉原语：
   - `FieldSurface`；
   - `SignalBadge`；
   - `HairlineDivider`；
   - `CapabilityTag`；
   - `FieldMeter`；
   - `ChimeraMark`。
5. 为组件建立 Storybook 或最小展示页。
6. 添加 Token 测试：
   - Dark/Light key 完整一致；
   - 禁止无语义 Hex；
   - 对比度检查；
   - Reduced Motion Token 存在。
7. 将品牌名称、链接、版本显示继续集中在 `@chimera/brand`。

### 交付物

- Token V1 代码；
- 字体决策和资源清单；
- 基础组件展示页；
- Token/Pencil 映射；
- 迁移指南。

### 验收标准

- 新品牌组件不直接引用 Hex；
- Dark/Light Token 键完全对齐；
- 文字与交互控件满足 WCAG AA；
- 生产字体不超过三套；
- `@chimera/ui` 不读取 App Store、Session Store 或 Provider Store。

### 回滚

保留旧变量别名一个发布周期，新旧 Token 可并存；出现问题时切回旧 Theme 映射，不回滚业务功能。

---

## Phase 2 — Chimera Shell 与窗口系统

**目标：** 先改变产品骨架和第一印象，再进入会话细节。

**预计工作量：** 5–8 工程日。  
**依赖：** Phase 1。

### 工作项

1. 实现 Chimera Spine：
   - 工作场、任务、资产、连接；
   - 会话内 File Tree / Review / Terminal；
   - 当前项目和不可用状态；
   - 设置和账户。
2. 实现 Workspace Strip：
   - 工作区、路径、分支；
   - Provider/网关连接；
   - 执行状态；
   - 搜索、窗口操作。
3. 建立 App Adapter：
   - 所有 OpenCode Context 读取集中到 `packages/app/src/chimera`；
   - 展示组件仅接收 props；
   - 现有 layout 文件只挂载一个具名 Shell Slot。
4. 统一 dev/release 窗口选项：
   - 默认尺寸；
   - 最小尺寸；
   - Remember Bounds；
   - 全屏；
   - Titlebar；
   - Windows DPI；
   - macOS/Linux 差异。
5. 设计窄窗口降级：
   - Spine 保留图标；
   - Workspace Strip 折叠低优先信息；
   - Context Ribbon 变为可展开摘要；
   - Side Panel 不得把 Composer 挤出视口。
6. 去除与新 Shell 冲突的旧 Rail/Status Bar 重复信息。

### 交付物

- 新 Shell；
- Window spec；
- dev/release 窗口一致性测试；
- Shell Adapter；
- 响应式截图矩阵。

### 验收标准

- dev 和 release 在同一尺寸/DPI 下布局一致；
- 1280×800、1440×900、1920×1080、全屏通过；
- 960×640 无关键功能裁切；
- 键盘可遍历所有 Shell 入口；
- 不出现两套导航、两套状态或重复上下文条；
- Shell 接入最多修改少量上游 layout 文件。

### 回滚

通过 `chimeraFieldShell` Feature Flag 切回旧布局；窗口配置独立提交，可单独回滚。

---

## Phase 3 — Turn Ledger 与 Context Field

**目标：** 建立 Chimera 最核心的独立交互模型。

**预计工作量：** 8–12 工程日。  
**依赖：** Phase 2。

### 工作项

1. 定义 Turn View Model：
   - User Intent；
   - Plan；
   - Tool Activity；
   - Diff；
   - Verification；
   - Error / Retry；
   - Completion。
2. View Model 只投影既有 Session 数据，不改变会话执行语义。
3. 实现 Turn Ledger：
   - 连续执行轨迹；
   - 当前节点；
   - 已完成/进行中/等待；
   - 长任务折叠；
   - 虚拟化兼容；
   - 键盘定位和屏幕阅读器标签。
4. 实现 Context Ribbon：
   - 工作区文件；
   - 显式选择；
   - Memory；
   - Policy；
   - Provider/模型；
   - 容量。
5. 实现 Context Field 详情：
   - 每项来源；
   - 为什么进入上下文；
   - Token 权重；
   - 可移除/锁定状态；
   - 自动裁剪阈值。
6. 处理异常：
   - 工具长时间运行；
   - 多次重试；
   - 流式中断；
   - 取消；
   - Session 恢复；
   - 无 Diff；
   - 无计划；
   - 多 Agent。
7. 避免修改核心时间线算法：
   - 优先建立投影适配层；
   - 若必须新增 Slot，单独提交；
   - 不复制整份上游 Timeline。

### 交付物

- Turn View Model；
- Turn Ledger；
- Context Ribbon；
- Context Field；
- 状态/错误/恢复 Story；
- 单元与交互测试。

### 验收标准

- 任一 Turn 都能回答“用户要什么、做了什么、改了什么、验证了吗”；
- 现有 Session 历史可正确投影；
- 10,000+ 行会话不因新 UI 显著退化；
- 虚拟列表滚动位置稳定；
- 流式、取消、重试、恢复均有明确状态；
- 关闭 Feature Flag 后原上游 Timeline 仍可使用。

### 回滚

保留原 Timeline 渲染器一个稳定版本，通过 Feature Flag 切换；Turn View Model 不写入持久化数据，因此可无数据迁移回滚。

---

## Phase 4 — Fusion Composer 与能力事实统一

**目标：** 统一意图、上下文和执行能力，同时彻底解决 Provider/凭据/模型切换后的陈旧状态。

**预计工作量：** 6–10 工程日。  
**依赖：** Phase 1；可与 Phase 3 后半段并行，但上线必须在 Phase 3 之后统一验收。

### 领域规则

思考强度不是 UI 固定档位。它必须由以下键共同决定：

```text
providerID
+ credential fingerprint
+ provider catalog revision
+ modelID
= capability snapshot
```

不得使用以下推断：

- “中转站一定有思考强度”；
- “第三方供应商一定没有”；
- 仅凭模型名称猜测；
- 沿用另一个凭据的能力快照；
- UI 启动时只计算一次。

### 工作项

1. 建立统一 Model Capability 数据结构：
   - reasoning supported；
   - 可用 effort 档位；
   - Tool、Vision、Attachment；
   - Context Window；
   - capability source；
   - fetchedAt/revision；
   - unknown/unavailable 状态。
2. 供应商适配器把原始返回值归一化到该结构。
3. 迁移多密钥安全存储：
   - Renderer 只保存密钥元数据；
   - Electron Main/本地 Server 保存秘密值；
   - IPC/API 只按密钥 ID 执行切换；
   - 使用 OS 凭据能力或 Electron `safeStorage`，明确 Linux 降级；
   - 一次性读取旧 `localStorage("chimera-keys")`，导入成功后清除；
   - 迁移幂等，失败时不破坏旧数据并给出可恢复提示；
   - 任何日志和错误对象都不包含明文。
4. Capability 缓存 key 包含 credential fingerprint，但不包含明文。
5. 凭据切换时：
   - 更新 Active Credential；
   - 使旧目录/能力快照失效；
   - 重新拉取或重算；
   - 原子发布新模型列表；
   - UI 不需要重启或 Ctrl+R。
6. Provider 与中转站走同一状态机。
7. Fusion Composer 展示：
   - Intent；
   - Context Recipe；
   - Provider；
   - Credential；
   - Model；
   - Thinking Strength；
   - Agent；
   - Permission；
   - 能力来源和刷新状态。
8. UI 状态：
   - loading；
   - unknown；
   - unsupported；
   - partial；
   - stale；
   - error；
   - capability changed。
9. 建立集成测试矩阵：

| 场景 | 预期 |
|---|---|
| 第三方 Provider，模型声明 reasoning | 显示真实档位 |
| 第三方 Provider，无 reasoning | 不显示伪选项，给出不支持说明 |
| 中转站，切换到另一密钥 | 立即失效并重算 |
| 同一模型、不同密钥能力不同 | 分别展示，不串缓存 |
| 切换工作区 | 使用正确 Active Credential |
| 拉取失败 | 保留明确 stale/error，不静默回退错误目录 |
| 快速连续切换密钥 | 最后一次选择获胜，不被慢请求覆盖 |
| 重启应用 | 与重启前能力事实一致，但不依赖重启刷新 |

### 交付物

- Capability Schema；
- Provider 归一化；
- 凭据感知缓存；
- 安全凭据保险库与旧数据迁移；
- Fusion Composer；
- 集成测试；
- 状态诊断面板或开发日志。

### 验收标准

- 非中转站第三方供应商可正确显示思考强度；
- 中转站和第三方同时存在时，模型列表随当前凭据即时更新；
- 切换密钥不需要重启或强制刷新；
- UI 不包含固定写死的全局档位数组；
- 慢请求不能覆盖更新后的活动凭据；
- Renderer 的 localStorage、sessionStorage 和 IndexedDB 中不存在明文密钥；
- 明文密钥不进入日志、缓存 key、事件 payload 或遥测；
- 旧密钥迁移成功后，`chimera-keys` 明文数据被清除。

### 回滚

Capability Projection 可回退到原模型元数据，但凭据切换失效机制不得回滚；Fusion Composer 可通过 Feature Flag 退回原选择器。

---

## Phase 5 — 首页、设置、连接与完整状态体系

**目标：** 将品牌语言扩展到高频辅助流程，避免“主界面是 Chimera，设置页又回到 OpenCode”。

**预计工作量：** 6–9 工程日。  
**依赖：** Phase 2、Phase 4。

### 工作项

1. Home：
   - Active Workflows；
   - Recent Turn Ledger；
   - New Fusion Task；
   - Field Status；
   - 空项目、无历史、离线状态。
2. Provider/密钥：
   - 第一方中转站与第三方 Provider 平等展示；
   - 当前凭据；
   - 能力刷新；
   - 删除/重命名/切换；
   - 安全提示。
3. Models：
   - 目录来源；
   - 能力标签；
   - 默认模型；
   - 搜索；
   - stale/error 状态；
   - 禁止仅显示某一供应商。
4. Settings：
   - 保留弹窗还是全屏页，由 Phase 0 决定；
   - 不为了视觉差异重写全部设置；
   - 使用统一 Section、Table、Empty State。
5. Command Palette：
   - 统一图标、分组、快捷键和描述；
   - 不直接分叉整个 Registry。
6. 完整状态：
   - Loading；
   - Empty；
   - Offline；
   - Error；
   - Permission denied；
   - Capability changed；
   - Update available。
7. i18n：
   - 所有用户可见字符串进入字典；
   - 移除 CSS `content` 中文状态；
   - 中英文布局都通过截图。

### 交付物

- Home、Provider、Models、Settings、Command Palette；
- 状态清单；
- 中英文文案；
- 安全和隐私说明。

### 验收标准

- 不存在只有 OpenCode 风格的主要二级页面；
- 所有 Provider 类型都能被发现和管理；
- 设置页不重复展示同一能力；
- 无 CSS 硬编码中文；
- 空状态和错误状态可行动，不只显示报错文本；
- 所有危险操作有明确确认或可撤销路径。

### 回滚

各页面按路由或组件级 Feature Flag 切换；不一次替换所有设置页面。

---

## Phase 6 — 上游友好重构与冲突预算收敛

**目标：** 把已验证的产品表达从散落补丁整理成可长期维护的边界。

**预计工作量：** 8–12 工程日。  
**依赖：** Phase 2–5 已稳定。  
**说明：** 这是维护成本的核心 Phase，不能被当作“有空再做的清理”。

### 工作项

1. 建立 `packages/app/src/chimera` Adapter 目录。
2. 将纯展示组件迁往 `@chimera/ui`。
3. 将品牌 CSS 从深层 DOM 覆盖迁移为：
   - 语义 Token；
   - 稳定 data-slot；
   - 具名 Slot；
   - 显式组件 props。
4. 为仍需依赖的 data-slot 建立契约测试。
5. 按文件审查当前 70 个 `packages/app` 差异：
   - 品牌视觉；
   - Chimera 功能；
   - 上游 Bug 修复；
   - 可删除历史补丁；
   - 必须保留分叉。
6. 同样审查 `packages/ui` 和 `packages/session-ui`。
7. 清除已被上游吸收或已失效的旧补丁。
8. 调整提交结构：
   - brand；
   - provider capability；
   - shell；
   - ledger；
   - composer；
   - desktop；
   - release；
   - docs。
9. 建立上游同步脚本/清单：
   - fetch upstream；
   - 基于 `upstream/dev` 创建短分支；
   - replay/merge；
   - 类型检查；
   - 单测；
   - 接入点契约；
   - 视觉回归；
   - 打包烟测。
10. 统一默认分支约定：
   - 仓库默认 `dev`；
   - 本地工作分支不依赖 `main`；
   - 短分支名不超过三个词且不含斜杠；
   - 版本提交与功能提交分离。

### 交付物

- Adapter 层；
- 上游接入点清单；
- 差异分类报告；
- 冲突预算 Dashboard 或脚本输出；
- Upstream Sync Runbook；
- 删除补丁列表。

### 验收标准

- 品牌视觉直接修改的上游已有文件不超过目标预算；
- 每个保留分叉都有 Owner、原因、测试和回滚；
- CSS 不依赖文本、`:nth-child` 或深层偶然结构；
- 完整执行一次真实 `upstream/dev` 同步演练；
- 同步后视觉回归和 Provider 测试通过；
- 文档不再宣称不符合事实的“零冲突”。

### 回滚

重构必须保持行为等价，按功能域分批迁移；任何域失败可回退到迁移前实现，不与视觉改版同一提交混合。

---

## Phase 7 — 质量门槛、发布和渐进上线

**目标：** 把设计完成转化为可安全发布、可观测、可回滚的产品版本。

**预计工作量：** 5–8 工程日。  
**依赖：** Phase 3–6。

### 测试矩阵

#### 功能

- Provider 添加、编辑、删除；
- 凭据添加、切换、重命名、删除；
- 模型列表和 Capability；
- Session 创建、恢复、取消、重试；
- 工具调用、Diff、Terminal、File Tree；
- 更新和深链。

#### 视觉

- Dark / Light；
- 中文 / 英文；
- 960×640、1280×800、1440×900、1920×1080；
- Windows 100%/125%/150% DPI；
- macOS、Linux；
- 默认、Loading、Empty、Error、Long Content；
- Reduced Motion。

#### 无障碍

- 全键盘完成核心任务；
- 焦点顺序；
- Focus 可见；
- 屏幕阅读器语义；
- 对比度；
- 不只用颜色表达状态；
- 动画可降级。

#### 性能

- 首屏启动时间无显著回退；
- Session 长列表滚动；
- Context Field 更新不触发全树重渲染；
- 字体和图标资源体积；
- 动画不造成持续高 CPU/GPU。

### 发布补缺

现有 `release-desktop.yml` 已完成多平台构建和 Release，后续重点是：

1. macOS 签名和公证；
2. Windows 签名；
3. 自动更新元数据验证；
4. Canary/Beta Channel；
5. 发布前 Smoke Test；
6. 升级与降级测试；
7. Release Notes 自动生成但允许人工编辑；
8. 紧急回滚和撤回更新；
9. 崩溃报告与隐私策略——若继续禁用遥测，至少保留用户主动导出的诊断包。

### 渐进上线

1. 内部使用；
2. 10% Canary；
3. 50% Beta；
4. 100% Stable；
5. 每阶段至少观察一个完整工作周期；
6. Capability 切换、崩溃、启动失败、窗口恢复异常达到阈值即停止推进。

### 验收标准

- 所有 P0 测试通过；
- 无高严重级无障碍问题；
- dev/release 视觉一致；
- Provider/凭据切换集成矩阵全绿；
- Upstream Sync 演练通过；
- 安装、升级、回滚通过；
- 发布说明明确标注已知限制。

---

## 7. Phase 依赖与推荐顺序

```text
Phase 0 方向批准
   ↓
Phase 1 Token 与基础层
   ↓
Phase 2 Shell
   ├──────────────┐
   ↓              ↓
Phase 3 Ledger   Phase 4 Capability + Composer
   └──────┬───────┘
          ↓
Phase 5 辅助页面与完整状态
          ↓
Phase 6 上游友好收敛
          ↓
Phase 7 质量与渐进发布
```

推荐不要并行展开 Phase 2、3、5 的所有页面。先用 Home + Session 证明方向，再扩展到设置和连接流程。

---

## 8. 提交与分支策略

### 8.1 分支

遵循仓库规则：

- 默认集成分支为 `dev`；
- 短分支不超过三个单词；
- 不使用 `feat/`、`fix/` 等斜杠前缀；
- 示例：`field-tokens`、`field-shell`、`turn-ledger`、`capability-cache`。

### 8.2 提交

使用 Conventional Commit：

- `feat(ui): add semantic field tokens`
- `feat(app): mount chimera shell adapter`
- `fix(core): invalidate model capabilities on credential switch`
- `test(app): cover provider capability projection`
- `docs: add upstream sync runbook`

### 8.3 禁止混合

以下内容不得放在同一提交：

- 视觉 Token 与 Provider 缓存修复；
- 上游同步与品牌重构；
- 大规模格式化与功能改动；
- 生成资产与逻辑改动；
- 发布版本号与未验证功能。

---

## 9. Definition of Done

任一 Phase 只有同时满足以下条件才能标记完成：

1. 交付物已进入版本库；
2. 有对应测试或明确说明为什么无法自动测试；
3. Dark/Light 和中英文均检查；
4. 关键窗口尺寸已检查；
5. 无新增未登记的上游分叉；
6. 无新增硬编码品牌色或 UI 文案；
7. Reduced Motion 可用；
8. 文档、截图和实现一致；
9. 回滚路径已经验证；
10. 用户完成视觉或产品验收；
11. `bun typecheck` 从受影响包目录执行并通过；
12. 测试从对应 package 目录执行，不从仓库根目录执行。

---

## 10. 风险登记

| 风险 | 概率 | 影响 | 缓解 |
|---|---:|---:|---|
| 用户仍不认可设计方向 | 中 | 高 | Phase 0 只做两张核心屏，批准后再编码 |
| 上游重构 Layout/Timeline | 高 | 高 | Adapter + Slot + Feature Flag，避免复制实现 |
| Capability 数据源不完整 | 中 | 高 | unknown/stale 状态，不用名称猜测 |
| 凭据切换竞态 | 中 | 高 | 请求代次/Abort、最后一次选择获胜、集成测试 |
| Renderer 明文保存多条密钥 | 高 | 高 | Phase 4 前置安全迁移、Main/Server 保险库、清除 localStorage |
| Token 继续分叉 | 中 | 中 | 单一事实源、映射测试、禁止新 Hex |
| 字体资源膨胀 | 高 | 中 | 三字体上限、按字重裁剪 |
| 长会话性能下降 | 中 | 高 | View Model 缓存、虚拟化基准 |
| 窗口在高 DPI 下裁切 | 中 | 高 | dev/release DPI 矩阵 |
| CSS 覆盖随上游静默失效 | 高 | 高 | data-slot 契约测试、迁移到显式 Slot |
| 发布流程成功但安装不可用 | 中 | 高 | 安装/升级 Smoke Test、签名与公证 |
| 功能和品牌提交混杂 | 中 | 中 | 提交边界和 PR 模板 |
| 正式 Pencil 源丢失 | 中 | 中 | 保存到仓库，MCP-only 修改，版本化预览 |

---

## 11. 量化成功指标

### 产品识别

- 不显示产品名时，评审者仍能通过三个以上结构特征识别 Chimera；
- 用户对“像 OpenCode 换色版”的反馈显著下降；
- Home → 新任务、Session → 理解当前执行、切换模型/思考强度三个任务的完成路径更短。

### 工程维护

- 品牌视觉相关上游修改文件数逐 Phase 下降；
- 上游同步冲突数、解决时间和视觉回归失败数可记录；
- CSS 深层选择器数量下降；
- 重复 Token 和行内品牌颜色数量下降；
- Provider/凭据切换无需重启的测试保持稳定。

### 质量

- P0 视觉矩阵全通过；
- 无高严重级键盘/对比度问题；
- 长会话滚动和启动性能不超过批准阈值；
- Release 安装、升级、回滚均通过。

---

## 12. 本轮查漏补缺结论

在原有 Phase 思路上，本路线图补齐了以下此前缺失或描述不足的内容：

1. **设计批准门槛**：不再把“已经有设计稿”等同于“方向已批准”。
2. **独立产品结构**：从换色转为 Spine、Context、Ledger、Composer 四个识别组件。
3. **字体与 Token 治理**：解决代码和 Pencil 多套字体、色值分叉。
4. **Provider 能力事实**：把思考强度和模型目录从 UI 条件提升为凭据感知的领域事实。
5. **窗口规格**：补齐 dev/release、全屏、DPI 和窄窗口。
6. **上游冲突预算**：用数字管理，而不是笼统承诺“零冲突”。
7. **Adapter/Slot 架构**：明确哪些代码属于品牌层、App 适配层和领域层。
8. **视觉回归与契约测试**：防止 CSS 覆盖在上游更新后静默失效。
9. **无障碍、i18n、Reduced Motion**：从细节提升为发布门槛。
10. **性能与长会话**：为 Turn Ledger 引入明确性能验收。
11. **Feature Flag 和回滚**：每个结构性改造都能单独撤回。
12. **发布现状纠偏**：承认 CI 已存在，把工作重心转为签名、公证、更新和回滚。
13. **设计源治理**：正式 Pencil 源必须进入版本库并只通过 MCP 修改。
14. **分支规范纠偏**：默认 `dev`，避免继续依赖本地 `main`。
15. **实施顺序收敛**：先 Home + Session 证明方向，再扩展设置，不再多页面同时微调。
16. **功能与品牌解耦**：Provider 修复、品牌视觉、上游同步分别提交和验收。
17. **凭据安全**：识别并提升 Renderer 明文多密钥存储为上线阻断项，补充保险库和迁移方案。

---

## 13. 评审时需要用户确认的决策

进入 Phase 0 实施前，只需要确认以下高层决策，不需要逐像素确认：

1. 是否接受“Chimera Field / 融合工作场”作为产品概念；
2. Turn Ledger 是否作为默认 Session 叙事；
3. Context Ribbon 是否常驻；
4. Fusion Composer 是默认展开还是渐进展开；
5. 设置继续使用弹窗，还是改为全屏工作区；
6. 是否接受推荐字体收敛方案；
7. 默认窗口是否统一为 1280×800；
8. 是否接受通过 Feature Flag 渐进替换，而不是一次性重写；
9. 是否同意将“减少上游修改面”作为与视觉效果同等级的验收目标。

---

## 14. 推荐的第一批执行任务

文档批准后，第一批只做以下内容：

1. 将本轮 Pencil 草稿保存为新的候选源，不覆盖旧资产；
2. 基于用户反馈制作两个方向的 Home + Session Dark 稿；
3. 输出 Token V1 和字体盲测样张；
4. 建立窗口响应矩阵；
5. 审计多密钥存储并形成安全迁移设计；
6. 生成当前上游修改文件分类报告；
7. 给 Home + Session 标注每个结构对应的实现位置和冲突风险；
8. 用户批准方向后，再创建 `field-tokens` 和 `field-shell` 实施分支。

在这八项完成前，不继续追加零散的颜色、阴影、按钮和间距补丁。



