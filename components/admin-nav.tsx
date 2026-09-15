import Link from "next/link";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/admin", label: "Videos" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/tags", label: "Tags" },
];

export function AdminNav({ current }: { current: string }) {
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((link) => (
        <Button
          key={link.href}
          asChild
          size="sm"
          variant={link.href === current ? "secondary" : "ghost"}
        >
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
    </nav>
  );
}
