import { For, Show, createEffect, createSignal, onCleanup, type Accessor } from "solid-js"
import type { UserMessage } from "@opencode-ai/sdk/v2"
import { useLanguage } from "@/context/language"

const PREFERRED_PITCH = 8
const MIN_PITCH = 4
const IDLE_WIDTH = 10

export function pickCurrentTurnId(
  marks: Array<{ id: string; top: number; bottom: number }>,
  viewTop: number,
  viewBottom: number,
  line: number,
) {
  const shown = marks.filter((item) => item.bottom > viewTop && item.top < viewBottom)
  const hit = shown.find((item) => item.top <= line && item.bottom >= line)
  if (hit) return hit.id
  const near = shown.slice().sort((a, b) => Math.abs(a.top - line) - Math.abs(b.top - line))[0]
  if (near) return near.id
  return marks.filter((item) => item.top <= line).at(-1)?.id
}

export function turnRailPitch(count: number, available: number) {
  if (count <= 0) return PREFERRED_PITCH
  if (available <= 0) return PREFERRED_PITCH
  return Math.min(PREFERRED_PITCH, Math.max(MIN_PITCH, available / count))
}

export function turnRailStackOffset(count: number, available: number) {
  if (count <= 0 || available <= 0) return 0
  return Math.max(0, (available - count * turnRailPitch(count, available)) / 2)
}

export function turnRailIndexAt(clientY: number, top: number, pitch: number, count: number) {
  if (count <= 1 || pitch <= 0) return 0
  return Math.max(0, Math.min(count - 1, Math.floor((clientY - top) / pitch)))
}

export function turnRailDashWidth(input: { distance?: number; hovering: boolean }) {
  if (!input.hovering) return IDLE_WIDTH
  if (input.distance === 0) return 36
  if (input.distance === 1) return 22
  if (input.distance === 2) return 14
  if (input.distance === 3) return 11
  return IDLE_WIDTH
}

function hoverDistance(hovered: { index: number } | undefined, index: number) {
  if (!hovered) return
  return Math.abs(index - hovered.index)
}

export function SessionTurnRail(props: {
  messages: UserMessage[]
  scroller: Accessor<HTMLDivElement | undefined>
  snippet: (id: string) => string
  onJump: (id: string) => void
}) {
  const language = useLanguage()
  const [currentId, setCurrentId] = createSignal<string>()
  const [hover, setHover] = createSignal<{ id: string; index: number; top: number }>()
  const [available, setAvailable] = createSignal(0)
  const [nav, setNav] = createSignal<HTMLElement>()

  const pitch = () => turnRailPitch(props.messages.length, available())
  const stackOffset = () => turnRailStackOffset(props.messages.length, available())

  createEffect(() => {
    const el = nav()
    if (!el) return
    const observer = new ResizeObserver(() => setAvailable(el.clientHeight))
    observer.observe(el)
    setAvailable(el.clientHeight)
    onCleanup(() => observer.disconnect())
  })

  createEffect(() => {
    const root = props.scroller()
    if (!root) return

    const update = () => {
      const box = root.getBoundingClientRect()
      const marks = [...root.querySelectorAll<HTMLElement>("[data-message-id]")].flatMap((el) => {
        const id = el.dataset.messageId
        if (!id) return []
        const rect = el.getBoundingClientRect()
        return [{ id, top: rect.top, bottom: rect.bottom }]
      })
      setCurrentId(pickCurrentTurnId(marks, box.top, box.bottom, box.top + Math.min(120, box.height * 0.2)))
    }

    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        update()
      })
    }

    root.addEventListener("scroll", onScroll, { passive: true })
    update()
    onCleanup(() => {
      root.removeEventListener("scroll", onScroll)
      if (frame) cancelAnimationFrame(frame)
    })
  })

  const hoverAt = (event: PointerEvent & { currentTarget: HTMLElement }) => {
    const box = event.currentTarget.getBoundingClientRect()
    const index = turnRailIndexAt(event.clientY, box.top, pitch(), props.messages.length)
    const message = props.messages[index]
    if (!message) return
    setHover({ id: message.id, index, top: stackOffset() + index * pitch() })
  }

  const preview = () => {
    const item = hover()
    if (!item) return ""
    return props.snippet(item.id) || language.t("chimera.session.turnRail.turn", { n: `${item.index + 1}` })
  }

  return (
    <Show when={props.messages.length > 0}>
      <nav
        ref={setNav}
        data-slot="chimera-turn-rail"
        class="pointer-events-none absolute top-12 bottom-3 left-1.5 z-20 flex w-[280px] flex-col justify-center"
        aria-label={language.t("chimera.session.turnRail.label")}
      >
        <div
          class="pointer-events-auto flex w-10 shrink-0 cursor-pointer flex-col items-start"
          style={{ height: `${props.messages.length * pitch()}px` }}
          onPointerMove={hoverAt}
          onPointerLeave={() => setHover(undefined)}
          onClick={() => {
            const item = hover()
            if (item) props.onJump(item.id)
          }}
        >
          <For each={props.messages}>
            {(message, index) => (
              <button
                type="button"
                class="flex w-full shrink-0 items-center"
                style={{ height: `${pitch()}px` }}
                aria-current={currentId() === message.id ? "true" : undefined}
                aria-label={language.t("chimera.session.turnRail.turn", { n: `${index() + 1}` })}
                onClick={(event) => {
                  event.stopPropagation()
                  props.onJump(message.id)
                }}
              >
                <span
                  class="rounded-[1px] transition-[width,background-color,height] duration-150 ease-out"
                  classList={{
                    "h-[3px] bg-v2-text-text-base": hover()?.index === index() || currentId() === message.id,
                    "h-[2px] bg-v2-icon-icon-muted": hover()?.index !== index() && currentId() !== message.id,
                  }}
                  style={{
                    width: `${turnRailDashWidth({
                      hovering: hover() !== undefined,
                      distance: hoverDistance(hover(), index()),
                    })}px`,
                  }}
                />
              </button>
            )}
          </For>
        </div>
        <Show when={hover()}>
          {(item) => (
            <div
              class="pointer-events-none absolute left-11 z-30 w-[240px] rounded-[12px] border-[0.5px] border-v2-border-border-muted bg-v2-background-bg-base px-3.5 py-3 shadow-[var(--v2-elevation-floating)]"
              style={{ top: `${Math.max(0, item().top - 18)}px` }}
            >
              <p class="line-clamp-6 text-[13px] leading-[18px] text-v2-text-text-base">{preview()}</p>
            </div>
          )}
        </Show>
      </nav>
    </Show>
  )
}
