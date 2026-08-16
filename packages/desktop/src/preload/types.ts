import type { DesktopMenuAction } from "@opencode-ai/app/desktop-menu"
import type { WslServersPlatform } from "@opencode-ai/app/wsl/types"
import type { UpdaterState } from "@opencode-ai/app/updater"
import type { DesktopNativeBundle } from "@opencode-ai/app/i18n/desktop-native"
export type {
  WslDistroProbe,
  WslInstalledDistro,
  WslJob,
  WslOnlineDistro,
  WslOpencodeCheck,
  WslRuntimeCheck,
  WslServerConfig,
  WslServerItem,
  WslServerRuntime,
  WslServersEvent,
  WslServersState,
} from "@opencode-ai/app/wsl/types"

export type ServerReadyData = {
  url: string
  username: string | null
  password: string | null
}

export type WslServersAPI = WslServersPlatform
export type UpdaterAPI = {
  subscribe: (cb: (state: UpdaterState) => void) => Promise<() => void>
  check: () => Promise<UpdaterState>
  install: () => Promise<void>
}

export type LinuxDisplayBackend = "wayland" | "auto"
export type TitlebarTheme = {
  mode: "light" | "dark"
  scheme?: "system" | "light" | "dark"
}
export type FatalRendererError = {
  error: string
  url: string
  version?: string
  platform: string
  os?: string
}

/** 密钥保险库元数据（Phase 4）：秘密值永不出 Main 进程。 */
export type VaultKeyMeta = {
  id: string
  name: string
  fingerprint: string
  createdAt: number
}

export type KeyVaultAPI = {
  list: () => Promise<VaultKeyMeta[]>
  create: (name: string, secret: string) => Promise<VaultKeyMeta | undefined>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  /** 复制密钥：主进程写剪贴板，明文不返回 renderer。 */
  copySecret: (id: string) => Promise<boolean>
  /** 仅切换/连接时解密一次：调用方用后即弃，不落存储。 */
  secret: (id: string) => Promise<string | undefined>
}

export type ElectronAPI = {
  killSidecar: () => Promise<void>
  installCli: () => Promise<string>
  awaitInitialization: () => Promise<ServerReadyData>
  /** Chimera 密钥保险库（秘密值仅存 Main，renderer 按 id 操作）。 */
  keyVault: KeyVaultAPI
  wslServers: WslServersAPI
  updater: UpdaterAPI
  consumeInitialDeepLinks: () => Promise<string[]>
  getDefaultServerUrl: () => Promise<string | null>
  setDefaultServerUrl: (url: string | null) => Promise<void>
  isFirstLaunchOnboardingPending: () => Promise<boolean>
  finishFirstLaunchOnboarding: (createDefaultProject: boolean) => Promise<string | null>
  isOldLayoutEligible: () => Promise<boolean>
  getDisplayBackend: () => Promise<LinuxDisplayBackend | null>
  setDisplayBackend: (backend: LinuxDisplayBackend | null) => Promise<void>
  checkAppExists: (appName: string) => Promise<boolean>
  resolveAppPath: (appName: string) => Promise<string | null>
  storeGet: (name: string, key: string) => Promise<string | null>
  storeSet: (name: string, key: string, value: string) => Promise<void>
  storeDelete: (name: string, key: string) => Promise<void>
  storeClear: (name: string) => Promise<void>
  storeKeys: (name: string) => Promise<string[]>
  storeLength: (name: string) => Promise<number>
  draftGet: (key: string) => Promise<string | null>
  draftSet: (key: string, value: string) => Promise<void>
  draftDelete: (key: string) => Promise<void>
  draftBlobPut: (data: ArrayBuffer) => Promise<string>
  draftBlobGet: (id: string) => Promise<ArrayBuffer | null>

  getWindowID: () => Promise<string>
  onMenuCommand: (cb: (id: string) => void) => () => void
  onDeepLink: (cb: (urls: string[]) => void) => () => void

  openDirectoryPicker: (opts?: {
    multiple?: boolean
    title?: string
    defaultPath?: string
  }) => Promise<string | string[] | null>
  openFilePicker: (opts?: {
    multiple?: boolean
    title?: string
    defaultPath?: string
    extensions?: string[]
  }) => Promise<{ token: string; files: { path: string; name: string; size: number }[] } | null>
  readPickedFile: (token: string, path: string) => Promise<ArrayBuffer>
  releasePickedFiles: (token: string) => Promise<void>
  getPathForFile: (file: File) => string
  saveFilePicker: (opts?: { title?: string; defaultPath?: string }) => Promise<string | null>
  openExternal: (url: string) => void
  openLocalFile: (url: string) => void
  openPath: (path: string, app?: string) => Promise<void>
  revealPath: (path: string) => Promise<boolean>
  readClipboardImage: () => Promise<{ buffer: ArrayBuffer; width: number; height: number } | null>
  getWindowFocused: () => Promise<boolean>
  getWindowFullscreen: () => Promise<boolean>
  onWindowFullscreenChanged: (cb: (fullscreen: boolean) => void) => () => void
  setWindowFocus: () => Promise<void>
  showWindow: () => Promise<void>
  relaunch: () => void
  getZoomFactor: () => Promise<number>
  setZoomFactor: (factor: number) => Promise<void>
  getPinchZoomEnabled: () => Promise<boolean>
  setPinchZoomEnabled: (enabled: boolean) => Promise<void>
  onPinchZoomEnabledChanged: (cb: (enabled: boolean) => void) => () => void
  onZoomFactorChanged: (cb: (factor: number) => void) => () => void
  setTitlebar: (theme: TitlebarTheme) => Promise<void>
  runDesktopMenuAction: (action: DesktopMenuAction) => Promise<void>
  setBackgroundColor: (color: string) => Promise<void>
  exportDebugLogs: () => Promise<string>
  setForceFocus: (enabled: boolean) => Promise<void>
  recordFatalRendererError: (error: FatalRendererError) => Promise<void>
  setNativeTranslations: (bundle: DesktopNativeBundle) => Promise<void>
  /** Chimera 网关 Dashboard API 代理（仅开放桌面授权所需端点）。 */
  chimeraGatewayFetch: (input: {
    path: string
    method?: string
    headers?: Record<string, string>
    body?: string
  }) => Promise<{ status: number; body: string }>
}
