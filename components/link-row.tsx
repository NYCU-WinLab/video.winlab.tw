"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";

/**
 * A table row that opens `href`. The first cell should hold a real <Link>
 * so the row is reachable by keyboard, screen readers and cmd-click; the
 * row-wide click and Enter handling are conveniences on top of that.
 */
export function LinkRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <TableRow
      className="cursor-pointer focus-visible:bg-accent focus-visible:outline-none"
      tabIndex={0}
      onClick={(e) => {
        // Let real links (and modifier clicks on them) behave natively.
        if ((e.target as HTMLElement).closest("a")) return;
        router.push(href);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) router.push(href);
      }}
    >
      {children}
    </TableRow>
  );
}
