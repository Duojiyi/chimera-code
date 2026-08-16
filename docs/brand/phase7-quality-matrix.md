# Phase 7 质量矩阵（发布门槛）

> 状态：基线文档。P0 项在最终预览前逐项核对。

## 功能 P0

- [ ] Provider 添加/编辑/删除；凭据切换无需重启（已实现：refreshProviders 链路）
- [ ] 密钥保险库：localStorage 无明文（已实现，验收见 phase0-key-vault-design.md）
- [ ] 会话创建/恢复/取消/重试；工具调用/Diff/终端/文件树
- [ ] Turn Ledger 投影：历史会话可正确显示回合
- [ ] 深链/更新（release-desktop 流程）

## 视觉矩阵

| 维度 | 检查 |
|---|---|
| 主题 | Dark / Light（默认深色） |
| 语言 | 中文 / 英文 |
| 尺寸 | 960×640 / 1280×800 / 1440×900 / 1920×1080 |
| DPI | Windows 100% / 125% / 150% |
| 状态 | 默认 / Loading / Empty / Error / Long Content |
| Reduced Motion | 动画降级（prefers-reduced-motion） |

## 无障碍

- [ ] 全键盘核心路径（新建 → 会话 → 输入 → 切换模型/密钥）
- [ ] Focus 可见；不只用颜色表达状态（CSS 中文标签已移除，状态用颜色+形态）
- [ ] 对比度 WCAG AA（Token 测试已覆盖 text1/text2）

## 性能

- [ ] 首屏启动无显著回退
- [ ] 长会话（1 万+ 行）Turn Ledger 投影不阻塞（纯派生 + 截断摘要）
- [ ] Context Ribbon 更新不触发全树重渲染（memo 派生）

## 发布补缺（release-desktop.yml 已有多平台构建）

- [ ] macOS 公证 / Windows 签名（凭据到位后）
- [ ] 自动更新元数据验证
- [ ] 升级/回滚烟测
