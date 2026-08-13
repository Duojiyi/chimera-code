import { createEffect } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { usePlatform } from "@/context/platform"
import { persisted } from "@/utils/persist"

type Store = {
  version?: string
}

export const { use: useHighlights, provider: HighlightsProvider } = createSimpleContext({
  name: "Highlights",
  gate: false,
  init: () => {
    const platform = usePlatform()
    const [store, setStore, _, ready] = persisted("highlights.v1", createStore<Store>({ version: undefined }))
    const state = { started: false }

    const markSeen = () => {
      if (!platform.version) return
      setStore("version", platform.version)
    }

    // chimera: 首发不自动弹出「新功能 / 首个版本」发行说明。
    createEffect(() => {
      if (state.started) return
      if (!ready()) return
      if (!platform.version) return
      state.started = true
      markSeen()
    })

    return {
      ready,
      from: () => undefined as string | undefined,
      to: () => undefined as string | undefined,
      get last() {
        return store.version
      },
      markSeen,
    }
  },
})
