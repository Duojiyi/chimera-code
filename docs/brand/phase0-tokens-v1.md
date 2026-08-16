# Phase 0 规格：Token V1 草案（三层模型）

> 状态：草案（待 Phase 1 落地为代码 + 设计稿映射表）
> 设计语言：墨青画布 + 熔金意图（Amber Intent）× 青金执行（Viridian Execution）
> 字体：待盲测（Geist vs Space Grotesk 做 display；Noto Sans SC + JetBrains Mono 已定）

## 1. Primitive（原始层，组件禁止直接引用）

### 色彩（沿用现有 `tokens.ts` 色板，补命名）

| Token | Dark | Light | 语义 |
|---|---|---|---|
| `p.color.canvas` | #0C100F | #F4F6F4 | 墨青画布 |
| `p.color.surface.1` | #111615 | #FFFFFF | |
| `p.color.surface.2` | #161C1A | #EFF3F0 | |
| `p.color.surface.3` | #1D2422 | #E4EAE6 | |
| `p.color.hairline` | #FFFFFF12 | #00000012 | 发丝线 |
| `p.color.hairline.strong` | #FFFFFF1F | #00000021 | |
| `p.color.text.1` | #ECEFED | #1B211F | |
| `p.color.text.2` | #9AA4A0 | #5A655F | |
| `p.color.text.3` | #5F6A66 | #8C968F | |
| `p.color.amber` | #DEA54C | #9A681B | 意图/进行中/注意 |
| `p.color.viridian` | #46C39A | #1E8E6A | 完成/连接/能力确认 |
| `p.color.danger` | #D96A5B | #BE4936 | 破坏性/错误 |
| `p.color.on.accent` | #221703 | #FFFFFF | 强调色上的前景 |

### 尺寸/间距/圆角/动效

| 域 | Token | 值 |
|---|---|---|
| 间距 | `p.space.1..8` | 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 |
| 圆角 | `p.radius.control / panel / surface` | 6px / 10px / 12px（三档） |
| 字阶 | `p.type.10.5 / 11.5 / 13.5 / 16 / 20` | 数据/正文/标题等（见 §2） |
| 动效 | `p.motion.fast / base / slow` | 150ms / 220ms / 400ms（easing 统一 cubic-bezier(0.2, 0, 0, 1)） |
| 发丝线 | `p.border.hairline` | 0.5px |

## 2. Semantic（语义层，组件引用此层）

| Token | 值（映射 Primitive） | 用途 |
|---|---|---|
| `bg.canvas` | p.color.canvas | 应用底色 |
| `bg.shell` | p.color.surface.1 | Spine/状态栏 |
| `bg.panel` | p.color.surface.2 | 侧面板/卡片 |
| `bg.inset` | p.color.surface.3 | 输入区/代码块 |
| `text.primary / secondary / faint` | text.1/2/3 | 正文层级 |
| `border.hairline / hairline-strong` | hairline / hairline.strong | 分隔 |
| `signal.intent` | p.color.amber | 意图/进行中 |
| `signal.intent.dim` | amberDim | 意图底衬 |
| `signal.execute` | p.color.viridian | 完成/确认 |
| `signal.execute.dim` | viridianDim | 完成底衬 |
| `signal.danger` | p.color.danger | 危险 |
| `font.ui / font.mono / font.display` | Noto Sans SC / JetBrains Mono / 待盲测 | 字体角色 |
| `motion.fast / base` | p.motion.* | 动效 |

## 3. Component（组件层，随 Phase 2/3 落地补充）

| Token | 映射 | 组件 |
|---|---|---|
| `spine.item.active` | signal.execute + surface.2 | Spine 当前项 |
| `strip.status.ok` | signal.execute | Workspace Strip 连接状态 |
| `ribbon.usage.low` | signal.execute | Context Ribbon 容量 |
| `ribbon.usage.high` | signal.intent | Context Ribbon 容量告警 |
| `ledger.rail.complete` | signal.execute.dim | Turn Ledger 完成节点 |
| `ledger.rail.active` | signal.intent | Turn Ledger 当前节点 |
| `composer.border.live` | signal.intent（呼吸光） | Composer 聚焦/执行态 |

## 4. 约束规则

1. 新组件禁止直接引用 Primitive Hex——一律走 Semantic/Component。
2. Dark/Light 键必须完整对齐（测试断言）。
3. 文字与交互控件满足 WCAG AA。
4. Reduced Motion 降级：`prefers-reduced-motion` 下 motion.* 归零/禁止循环。
5. `--chimera-accent` 等现有 CSS 变量在 Phase 1 迁移到 Semantic 层，保留别名一个发布周期。
6. 生产字体不超过三套（Geist/Noto Sans SC/JetBrains Mono 或盲测替代）。

## 5. 与设计稿的映射

- Phase 1 产出 `Token ↔ Pencil(ch-*) 映射表`，两份源必须一一对应。
- 现状漂移项：`tokens.ts` 的 font.display = Space Grotesk 与设计稿（Geist/Inter）不一致——盲测后统一。
