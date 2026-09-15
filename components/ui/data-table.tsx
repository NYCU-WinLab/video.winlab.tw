import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Table as BaseTable,
  TableBody,
  TableCell as BaseTableCell,
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
 * - The trailing actions column uses `TableActionsHead` / `TableActionsCell`.
 * - Empty tables render a single `TableEmpty` row instead of an empty body.
 *
 * Responsive behaviour lives here so every list gets it for free. From `sm` up
 * the table renders as a normal table (unchanged). Below `sm` it reflows into a
 * stack of cards: the header is hidden, each row becomes a bordered card and
 * each cell becomes a `label: value` line. Give every non-title cell a `label`
 * so the value keeps its column name once the header is gone; leave the first
 * (title) cell without one so it reads as the card heading. The actions cell
 * drops its desktop sticky pinning and sits as a divided footer inside the card,
 * so row actions stay reachable without any horizontal scrolling.
 *
 * The primitives are re-exported so a table imports everything from one module.
 */

/**
 * The shared table. On desktop it is the plain table; below `sm` it switches to
 * a card stack: header hidden, body and rows become blocks, and each row is a
 * bordered, padded card. Cells opt into their own `label: value` layout via the
 * `TableCell` `label` prop.
 */
function Table({ className, ...props }: React.ComponentProps<typeof BaseTable>) {
  return (
    <BaseTable
      className={cn(
        "max-sm:block",
        "max-sm:[&_thead]:hidden",
        "max-sm:[&_tbody]:block",
        "max-sm:[&_tbody_tr]:mb-3 max-sm:[&_tbody_tr]:block max-sm:[&_tbody_tr]:rounded-lg max-sm:[&_tbody_tr]:bg-card max-sm:[&_tbody_tr]:p-3 max-sm:[&_tbody_tr]:shadow-sm max-sm:[&_tbody_tr]:ring-1 max-sm:[&_tbody_tr]:ring-border",
        "max-sm:[&_tbody_tr:last-child]:mb-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * Header cell for the trailing actions column: zero-width and pinned to the
 * right edge so the header lines up with the pinned action cells below. Hidden
 * on mobile along with the rest of the header.
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
 * A table cell. On desktop it is the plain cell. Below `sm`, pass a `label` and
 * the cell becomes a `label: value` line (the label is drawn from `data-label`);
 * omit `label` on the first cell so it reads as the card's title.
 */
function TableCell({
  className,
  label,
  ...props
}: React.ComponentProps<typeof BaseTableCell> & { label?: string }) {
  return (
    <BaseTableCell
      data-label={label}
      className={cn(
        "max-sm:whitespace-normal max-sm:px-0",
        label
          ? "max-sm:flex max-sm:items-baseline max-sm:justify-between max-sm:gap-4 max-sm:py-1 max-sm:text-right max-sm:before:shrink-0 max-sm:before:text-left max-sm:before:font-medium max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]"
          : "max-sm:block max-sm:pt-0 max-sm:pb-2 max-sm:text-base max-sm:font-medium",
        className
      )}
      {...props}
    />
  )
}

/**
 * Body cell for the trailing actions column. On desktop it stays pinned to the
 * right edge on horizontal scroll, with a thin left divider so it reads as a
 * frozen column. On mobile it drops the pinning and becomes a divided footer at
 * the bottom of the card, actions aligned to the right and still reachable.
 */
function TableActionsCell({
  className,
  ...props
}: React.ComponentProps<typeof BaseTableCell>) {
  return (
    <BaseTableCell
      className={cn(
        "sticky right-0 bg-background shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.08)]",
        "max-sm:static max-sm:mt-2 max-sm:flex max-sm:justify-end max-sm:border-t max-sm:px-0 max-sm:pt-2 max-sm:shadow-none",
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
    <TableRow className="hover:bg-transparent max-sm:ring-0">
      <TableCell
        colSpan={colSpan}
        className="h-24 text-center text-muted-foreground max-sm:block max-sm:h-auto max-sm:py-6 max-sm:text-base max-sm:font-normal"
      >
        {children}
      </TableCell>
    </TableRow>
  )
}

export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableActionsHead,
  TableActionsCell,
  TableEmpty,
}
