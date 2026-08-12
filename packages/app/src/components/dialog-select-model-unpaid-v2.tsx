import { DialogBody, DialogHeader, DialogTitle, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { type Component } from "solid-js"
import { useLocal } from "@/context/local"
import { decode64 } from "@/utils/base64"
import { useLanguage } from "@/context/language"

type ModelState = ReturnType<typeof useLocal>["model"]

// Chimera：模型的唯一预置来源是中转站，零态弹窗只引导连接中转站。
// 用户自定义 provider 仍可通过配置文件添加（enabled_providers 会随之放行）。
export const DialogSelectModelUnpaidV2: Component<{ model?: ModelState }> = () => {
  const local = useLocal()
  const dialog = useDialog()
  const directory = () => decode64(local.slug())
  const language = useLanguage()

  const openConnect = () => {
    void import("./dialog-connect-provider").then((x) => {
      const controller = x.useProviderConnectController()
      controller.select("chimera")
      void dialog.show(() => <x.DialogConnectProvider controller={controller} directory={directory} />)
    })
  }

  return (
    <DialogV2
      fit
      containerClass="!h-auto max-h-[calc(100vh_-_16px)] !w-[min(calc(100vw_-_16px),480px)]"
      class="[font-family:var(--v2-font-family-sans)] [&_[data-slot=dialog-header]]:!px-5 [&_[data-slot=dialog-header-title]]:!text-[15px] [&_[data-slot=dialog-header-title]]:!tracking-[-0.13px]"
    >
      <DialogHeader closeLabel={language.t("common.close")}>
        <DialogTitle>{language.t("dialog.model.select.title")}</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[calc(100vh_-_68px)] min-h-0 flex-none gap-0 overflow-y-auto px-5 pb-5">
        <div class="flex w-full flex-col items-start gap-3 rounded-lg border-[0.5px] border-v2-border-border-muted bg-v2-background-bg-layer-02 p-4">
          <div class="flex items-center gap-2">
            <ProviderIcon id="chimera" class="size-4 shrink-0 text-v2-icon-icon-base" />
            {/* TODO(chimera): 待补 i18n 键 */}
            <span class="text-[13px] font-[530] leading-5 text-v2-text-text-base">连接 Chimera 中转站</span>
          </div>
          <p class="text-[13px] leading-5 text-v2-text-text-muted">
            使用中转站账号密码登录，或粘贴企业令牌。登录后自动同步该账号下的密钥与可用模型。
          </p>
          <ButtonV2 variant="contrast" size="normal" onClick={openConnect}>
            连接中转站
          </ButtonV2>
        </div>
      </DialogBody>
    </DialogV2>
  )
}
