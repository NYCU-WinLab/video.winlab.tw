import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Wider sibling of {@link PageContainer} used only by the home video wall.
 *
 * The wall intentionally opts out of the shared `max-w-5xl` shell: a YouTube
 * style wall wants to fill wide desktops so the auto-filling grid keeps cards
 * large and grows the column count with the viewport. It keeps the exact same
 * side gutters (16px on mobile, 24px from `sm`) and vertical rhythm as
 * `PageContainer`, only the max width differs. This is deliberate and is NOT a
 * regression of issue #19 — account, admin and watch stay on `PageContainer`.
 */
function WideContainer({
  className,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="wide-container"
      className={cn(
        "mx-auto w-full max-w-[1600px] flex-1 space-y-8 px-4 py-8 sm:px-6",
        className
      )}
      {...props}
    />
  )
}

export { WideContainer }
