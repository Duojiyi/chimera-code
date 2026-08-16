import { QueryClient } from "@tanstack/solid-query"

// 共享 QueryClient：app 根 QueryProvider 与 server-sync 的 Home 索引缓存共用同一实例。
// server-sync 的 ensureServerCtx 在 GlobalProvider（QueryProvider 外层）的 owner 中
// createRoot，useQueryClient() 会解析到 TanStack 默认 client，导致事件写入与首页
// sessionLoad（QueryProvider 内）的 client 不一致——归档/恢复事件永远无法进入首页索引。
export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnReconnect: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  },
})
