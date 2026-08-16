/**
 * Chimera App Adapter（Phase 2）：把 OpenCode 状态读取收敛到本目录，
 * 展示组件只消费这里导出的派生状态（路线图 4.2：App Adapters 层）。
 * 展示组件（chimera-ui 原语）不直接依赖 app context。
 */
import { createMemo, type Accessor } from "solid-js"
import { useLayout } from "@/context/layout"
import { useServerSync } from "@/context/server-sync"
import { useTabs } from "@/context/tabs"

/** 当前路由对应的工作目录（与 DialogSettings 同款推导）。 */
export function useWorkspaceDirectory(): Accessor<string | undefined> {
  const layout = useLayout()
  const tabs = useTabs()
  const serverSync = useServerSync()
  return createMemo(() => {
    const route = layout.route()
    if (route.type === "dir-new-sesssion") return route.dir
    if (route.type === "draft") {
      const draft = tabs.store.find((item) => item.type === "draft" && item.draftID === route.draftID)
      return draft?.type === "draft" ? draft.directory : undefined
    }
    if (route.type === "session") return serverSync().session.get(route.sessionId)?.directory
    return undefined
  })
}

/** 当前工作区 git 分支（无 git 或无工作区时为 undefined）。 */
export function useWorkspaceBranch(directory: Accessor<string | undefined>): Accessor<string | undefined> {
  const serverSync = useServerSync()
  return createMemo(() => {
    const dir = directory()
    if (!dir) return undefined
    return serverSync().child(dir)[0].vcs?.branch
  })
}

/** 当前会话变更统计（+N -N · N 处更改），非会话页为 undefined。 */
export function useSessionDiff(): Accessor<{ files: number; additions: number; deletions: number } | undefined> {
  const layout = useLayout()
  const serverSync = useServerSync()
  return createMemo(() => {
    const route = layout.route()
    if (route.type !== "session") return undefined
    const diffs = serverSync().session.data.session_diff?.[route.sessionId] ?? []
    if (!diffs.length) return undefined
    return {
      files: diffs.length,
      additions: diffs.reduce((sum, item) => sum + ((item as { additions?: number }).additions ?? 0), 0),
      deletions: diffs.reduce((sum, item) => sum + ((item as { deletions?: number }).deletions ?? 0), 0),
    }
  })
}
