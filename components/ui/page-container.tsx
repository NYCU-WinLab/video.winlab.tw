import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The one page shell. Every route renders its body inside this so pages share a
 * single max-width, the same side gutters (16px on mobile, 24px from `sm`) and a
 * vertical rhythm on an 8px scale. Override spacing per page through `className`;
 * pass `flex flex-col` for pages that need a column layout (e.g. the player).
 */
function PageContainer({
  className,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="page-container"
      className={cn(
        "mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8 sm:px-6",
        className
      )}
      {...props}
    />
  )
}

export { PageContainer }
