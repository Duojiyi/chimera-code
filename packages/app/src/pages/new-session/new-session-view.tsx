import { Tooltip } from "@opencode-ai/ui/tooltip"
import { Show, type Accessor } from "solid-js"
import { Portal } from "solid-js/web"
import { PromptInputV2Composer } from "@/components/prompt-input-v2"
import { PromptGitStatus, PromptWorkspaceSelector } from "@/components/prompt-workspace-selector"
import {
  PromptProjectAddButton,
  PromptProjectSelector,
  type PromptProjectController,
} from "@/components/prompt-project-selector"
import { StatusPopoverV2 } from "@/components/status-popover"
import { useLanguage } from "@/context/language"
import { NEW_SESSION_CONTENT_WIDTH } from "@/pages/session/new-session-layout"
import type { NewSessionDraftController } from "./new-session-draft-controller"
import type { NewSessionWorkspaceController } from "./new-session-workspace-controller"

export function NewSessionView(props: {
  input: NewSessionDraftController["input"]
  project: PromptProjectController
  workspace: NewSessionWorkspaceController
}) {
  const language = useLanguage()
  return (
    <div class="@container relative flex flex-col min-h-0 h-full flex-1">
      <div
        data-component="session-new-design"
        class="relative flex-1 min-h-0 overflow-hidden rounded-[10px] bg-v2-background-bg-deep"
      >
        {/* Chimera S2：水印字标改为标题组，内容垂直居中（设计稿 design/s2-new-session-*.png） */}
        <div class="absolute inset-0 flex flex-col items-center justify-center px-6">
          <div class={NEW_SESSION_CONTENT_WIDTH}>
            <div class="flex flex-col gap-2">
              <h1 class="text-xl font-semibold text-v2-text-text-base">{language.t("command.session.new")}</h1>
              {/* TODO(chimera): 副标题待补 i18n 键 */}
              <p class="text-[13px] text-v2-text-text-faint">选择项目，告诉 Chimera 要做什么</p>
            </div>
            <div class="mt-6 flex flex-col gap-6">
              <PromptInputV2Composer controller={props.input} />
              <Show when={props.project.empty()}>
                <PromptProjectAddButton controller={props.project} />
              </Show>
              <Show when={props.project.selected()}>
                <div class="flex min-h-11 min-w-0 items-center gap-2 rounded-[8px] border border-v2-stroke-stroke-base px-3 text-v2-text-text-faint">
                  <PromptProjectSelector controller={props.project} placement="bottom" />
                  <div class="flex-1" />
                  <Show
                    when={props.workspace.bar.visible()}
                    fallback={
                      <PromptGitStatus branch={props.workspace.bar.branch()} noGit={!props.workspace.project.git()} />
                    }
                  >
                    <PromptWorkspaceSelector
                      value={props.workspace.selection.value()}
                      projectRoot={props.workspace.project.root()}
                      workspaces={props.workspace.project.workspaces()}
                      branch={props.workspace.bar.branch()}
                      onChange={props.workspace.selection.set}
                      onDone={props.input.restoreFocus}
                    />
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NewSessionStatus(props: { mount: Accessor<HTMLElement | null>; visible: Accessor<boolean> }) {
  const language = useLanguage()

  return (
    <Show when={props.mount()} keyed>
      {(mount) => (
        <Portal mount={mount}>
          <Show when={props.visible()}>
            <Tooltip placement="bottom" value={language.t("status.popover.trigger")}>
              <StatusPopoverV2 />
            </Tooltip>
          </Show>
        </Portal>
      )}
    </Show>
  )
}
