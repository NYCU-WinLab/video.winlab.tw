import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The one page shell. Every route renders its body inside this so pages share a
 * single layout grid with the site header: full window width, the same side
 * gutters (16px on mobile, 24px from `sm`) and a vertical rhythm on an 8px scale.
 * There is deliberately no max-width, so the left edge of every page lines up
 * with the header logo on any monitor. A page that wants a narrower column caps
 * itself through `className` (e.g. `max-w-2xl`) and stays left-aligned; the home
 * wall's auto-filling grid handles wide screens by adding columns. Pass
 * `flex flex-col` for pages that need a column layout (e.g. the player).
 */
function PageContainer({
  className,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="page-container"
      className={cn(
        "w-full flex-1 space-y-8 px-4 py-8 sm:px-6",
        className
      )}
      {...props}
    />
  )
}

export { PageContainer }
