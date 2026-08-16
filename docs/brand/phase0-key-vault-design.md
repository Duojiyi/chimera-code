# Phase 0 设计：多密钥安全存储迁移（上线阻断项）

> 状态：设计提案（待评审）
> 关联：路线图 3.2.G（安全债务）、Phase 4 前置
> 基线：2026-08-16 审计结果

## 1. 现状审计（已确认）

`packages/app/src/components/chimera-keys.tsx`：

- `{ name, key }` 列表**明文序列化**进 renderer 的 `localStorage("chimera-keys")`（28-56 行）
- 切换/注册/删除全部基于 localStorage 明文读写
- 活动密钥会经 `integration.connect.key` 写入本地 Server auth（仅活动密钥）
- `chimera-account` 键同样存明文账号信息

**风险评级：高（上线阻断）**
- 任意获得 renderer 同源脚本执行能力的代码可读取全部密钥
- `界面掩码显示`不等于`安全存储`（掩码只是 UI 呈现）
- 非活动密钥长期明文驻留浏览器存储

## 2. 威胁模型

| 威胁 | 现状暴露 | 迁移后 |
|---|---|---|
| XSS / 恶意扩展 / 同源脚本 | 读取全部明文密钥 | 只能看到元数据（id/名称/掩码/指纹） |
| 磁盘文件被拷贝（userData） | 明文密钥随 localStorage 落盘 | 密钥加密（OS 凭据/safeStorage） |
| 日志/崩溃报告 | 可能含密钥 | 明文永不入日志/事件/缓存 key |
| 旧数据残留 | — | 迁移成功后立即清除并幂等 |

## 3. 目标架构

```text
Renderer（浏览器存储）          Electron Main / 本地 Server
┌─────────────────────┐        ┌──────────────────────────┐
│ 密钥元数据（明文OK） │  IPC   │ 凭据保险库（加密）        │
│ id / name / mask    │◄──────►│  - 秘密值（safeStorage/   │
│ fingerprint / state │  keyID │    OS 凭据/DPAPI）        │
└─────────────────────┘        │  - 仅按 keyID 操作        │
        │                      └──────────────────────────┘
        │ integration.connect.key（活动密钥，现有链路不动）
        ▼
   本地 Server auth
```

### 3.1 数据模型

```ts
// Renderer 存储（localStorage，可明文）
type KeyMeta = {
  id: string              // uuid，保险库的查找键
  name: string
  fingerprint: string     // sha256(key) 前 12 位，用于展示/校验
  createdAt: number
  lastUsedAt?: number
}
type KeyVaultState = { keys: KeyMeta[]; active: string /* keyID */ }

// Main 凭据保险库（加密落盘，桌面端）
// userData/vault/chimera-keys.json（safeStorage.encryptString 后写入）
type VaultEntry = { id: string; secret: string }  // secret = 加密后的密钥
```

### 3.2 存储后端（按运行形态）

| 形态 | 保险库实现 | 说明 |
|---|---|---|
| Electron 桌面 | Main 进程 `safeStorage`（Windows DPAPI / macOS Keychain） | 密钥仅主进程可见；renderer 走 IPC |
| Linux 桌面 | `safeStorage` 若为 basic_text 则明确降级：提示 + 可选明文标记 | 无 keyring 时如实告知风险 |
| Web / 内嵌 | 本地 Server 凭据仓库（data 目录，权限 0600，服务端加密可选） | 不写浏览器存储 |

### 3.3 IPC 面（preload 扩展）

```ts
type KeyVaultAPI = {
  list(): Promise<KeyMeta[]>                      // 元数据
  create(name: string, secret: string): Promise<KeyMeta>
  rename(id: string, name: string): Promise<void>
  remove(id: string): Promise<void>
  switch(id: string): Promise<void>               // 解密 → integration.connect → 通知 renderer
  copySecret(id: string): Promise<string>         // 复制时临时解密，回写剪贴板
}
```

### 3.4 主进程校验

- IPC 来源校验：`webContents === mainFrame`（复用 chimera-gateway 的加固模式）
- 密钥值仅存在于 Main 内存中解密窗口；switch/copy 完成后立即清除局部引用
- 日志/错误对象/事件 payload 一律不含 secret

## 4. 迁移流程（幂等、可恢复）

```text
启动时（renderer init）：
1. 检查 localStorage("chimera-keys") 是否存在
2. 存在 → 逐条读 {name, key}：
   a. 调 vault.create(name, key)（走 IPC，Main 加密落盘）
   b. 计算 fingerprint 写入 KeyMeta
3. 全部导入成功 → 写入 KeyVaultState（localStorage 新结构）→ 删除旧键
4. 任一条失败 → 保留旧数据 + 提示可恢复（不破坏）
5. 迁移幂等：已迁移（旧键不存在）则跳过
```

## 5. 验收标准

1. `localStorage / sessionStorage / IndexedDB` 中不存在明文密钥
2. 密钥不出现在日志、错误上报、事件 payload、缓存 key
3. 切换密钥 = 按 keyID 调 vault，无需 renderer 持有明文
4. 旧数据迁移成功后 `chimera-keys` 明文键被清除
5. 复制功能走解密 IPC，不经过 localStorage
6. Windows/macOS 用 OS 凭据；Linux 无 keyring 时如实降级提示
7. 迁移失败不破坏旧数据，可重试

## 6. 影响面与工作量

| 改动 | 文件 |
|---|---|
| 保险库服务（Main） | `packages/desktop/src/main/key-vault.ts`（新增） |
| IPC 注册 + 校验 | `packages/desktop/src/main/ipc.ts`、`preload/index.ts`、`preload/types.ts` |
| renderer 状态迁移 | `packages/app/src/components/chimera-keys.tsx`（重构为元数据 + IPC） |
| Web/Server 端保险库 | `packages/opencode/src/...`（本地凭据仓库，视发布形态） |
| 测试 | key-vault 单测 + 迁移幂等测试 + IPC 校验测试 |

**估算：3-5 工程日**（不含 Server 端凭据仓库则 2-3 日）。
实施建议：作为独立提交/分支（`key-vault`），不与视觉改版混合；桌面端先行，Web 端随发布形态跟进。
