"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteTag, renameTag } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableActionsCell,
  TableActionsHead,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/data-table";
import { formatCount, formatDate } from "@/lib/format";
import type { Tag } from "@/lib/schema";

export type AdminTagRow = Tag & { users: number; videos: number };

export function AdminTags({ tags }: { tags: AdminTagRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [toDelete, setToDelete] = useState<AdminTagRow | null>(null);

  function run(work: () => Promise<{ ok: true } | { error: string }>, done: string) {
    startTransition(async () => {
      const result = await work();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(done);
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Users</TableHead>
            <TableHead>Videos</TableHead>
            <TableHead>Created</TableHead>
            <TableActionsHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tags.map((tag) => (
            <TableRow key={tag.id}>
              <TableCell>
                {editing === tag.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="h-8 w-48"
                      autoFocus
                      disabled={pending}
                    />
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Save name"
                      disabled={pending}
                      onClick={() => run(() => renameTag(tag.id, draft), "Tag renamed")}
                    >
                      <Check />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Cancel"
                      disabled={pending}
                      onClick={() => setEditing(null)}
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  tag.name
                )}
              </TableCell>
              <TableCell label="Users" className="font-mono">
                {formatCount(tag.users)}
              </TableCell>
              <TableCell label="Videos" className="font-mono">
                {formatCount(tag.videos)}
              </TableCell>
              <TableCell label="Created" className="font-mono">
                {formatDate(tag.createdAt)}
              </TableCell>
              <TableActionsCell>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Rename ${tag.name}`}
                    disabled={pending}
                    onClick={() => {
                      setEditing(tag.id);
                      setDraft(tag.name);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="text-destructive"
                    aria-label={`Delete ${tag.name}`}
                    disabled={pending}
                    onClick={() => setToDelete(tag)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableActionsCell>
            </TableRow>
          ))}
          {tags.length === 0 && (
            <TableEmpty colSpan={5}>No tags yet.</TableEmpty>
          )}
        </TableBody>
      </Table>

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag?</DialogTitle>
            <DialogDescription>
              “{toDelete?.name}” is removed from {toDelete?.users ?? 0} user(s) and{" "}
              {toDelete?.videos ?? 0} video(s). Videos left without any tag become
              visible to everyone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const target = toDelete;
                if (!target) return;
                setToDelete(null);
                run(() => deleteTag(target.id), "Tag deleted");
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
