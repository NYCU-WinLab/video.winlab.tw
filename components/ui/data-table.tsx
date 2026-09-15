import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * The one table pattern. Every list (admin users, admin tags, the per-video
 * viewers table, account passkeys) is built from these pieces so they share a
 * header style, row density and empty state, and behave the same on mobile.
 *
 * Conventions callers follow, not just imports:
 * - Data tokens (dates, counts, durations, sizes) render in `font-mono` and go
 *   through the shared helpers in `lib/format.ts` (`formatDate`, `formatCount`,
 *   `formatDuration`, `formatBytes`). Never hand-format a date or number.
 * - Row controls use the compact button sizes (`icon-xs`, `xs`, `sm`); the
 *   44px touch target is for a page's primary action, not dense table rows.
 * - The trailing actions column uses `TableActionsHead` / `TableActionsCell`,
 *   which stay pinned to the right edge so row actions remain reachable when
 *   the table scrolls horizontally on a narrow screen.
 * - Empty tables render a single `TableEmpty` row instead of an empty body.
 *
 * The primitives are re-exported so a table imports everything from one module.
 */
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
}

/**
 * Header cell for the trailing actions column: zero-width and pinned to the
 * right edge so the header lines up with the pinned action cells below.
 */
function TableActionsHead({
  className,
  ...props
}: React.ComponentProps<typeof TableHead>) {
  return (
    <TableHead
      className={cn("sticky right-0 w-0 bg-background", className)}
      {...props}
    />
  )
}

/**
 * Body cell for the trailing actions column. Stays pinned to the right edge on
 * horizontal scroll, with a thin left divider so it reads as a frozen column
 * when the rest of the row scrolls under it.
 */
function TableActionsCell({
  className,
  ...props
}: React.ComponentProps<typeof TableCell>) {
  return (
    <TableCell
      className={cn(
        "sticky right-0 bg-background shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.08)]",
        className
      )}
      {...props}
    />
  )
}

/**
 * The one empty-state row: spans the whole table, centred with breathing room
 * so an empty list never looks like a broken one.
 */
function TableEmpty({
  colSpan,
  children,
}: {
  colSpan: number
  children: React.ReactNode
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={colSpan}
        className="h-24 text-center text-muted-foreground"
      >
        {children}
      </TableCell>
    </TableRow>
  )
}

export { TableActionsHead, TableActionsCell, TableEmpty }
