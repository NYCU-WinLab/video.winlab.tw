import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The one non-table empty state: a centred icon, a single line of copy, and an
 * optional action. Mirrors `TableEmpty` for lists that aren't tables (card
 * grids, panels) so an empty view never looks like a broken one.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      <Icon className="size-8 text-muted-foreground" strokeWidth={1.5} />
      <div className="space-y-1">
        <p className="type-body">{title}</p>
        {description && <p className="type-caption">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export { EmptyState }
