"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/app/admin/actions";
import type { Tag } from "@/lib/schema";

export function TagPicker({
  tags,
  selected,
  emptyLabel,
  label,
  onSave,
}: {
  tags: Tag[];
  selected: string[];
  emptyLabel: string;
  label: string;
  onSave: (tagIds: string[]) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState(selected);
  const [pending, startTransition] = useTransition();

  function toggle(tagId: string, checked: boolean) {
    const next = checked
      ? [...chosen, tagId]
      : chosen.filter((id) => id !== tagId);
    const previous = chosen;
    setChosen(next);
    startTransition(async () => {
      const result = await onSave(next);
      if ("error" in result) {
        setChosen(previous);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  const names = tags.filter((t) => chosen.includes(t.id)).map((t) => t.name);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <span className="max-w-48 truncate">
            {names.length ? names.join(", ") : emptyLabel}
          </span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tags.map((tag) => (
          <DropdownMenuCheckboxItem
            key={tag.id}
            checked={chosen.includes(tag.id)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => toggle(tag.id, checked === true)}
          >
            {tag.name}
          </DropdownMenuCheckboxItem>
        ))}
        {tags.length === 0 && (
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            No tags yet.
          </DropdownMenuLabel>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
