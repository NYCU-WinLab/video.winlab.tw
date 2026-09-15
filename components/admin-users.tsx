"use client";

import { ArrowDown, ArrowUp, MoreHorizontal, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteUser, setUserTags, updateUser } from "@/app/admin/actions";
import { TagPicker } from "@/components/tag-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatDate } from "@/lib/format";
import type { Tag } from "@/lib/schema";

export type AdminUserRow = {
  email: string;
  name: string | null;
  role: string;
  createdAt: number;
  tagIds: string[];
  /** Comes from ADMIN_EMAILS, so the role cannot be changed from the UI. */
  locked: boolean;
};

type SortKey = "user" | "role" | "added";
type SortDirection = "asc" | "desc";

/** What the "User" column shows, which is also what it sorts and filters on. */
function userLabel(user: AdminUserRow) {
  return (user.name ?? user.email).toLowerCase();
}

/** A column header that toggles the sort, with the direction shown as an arrow. */
function SortableHead({
  label,
  column,
  sortKey,
  direction,
  onSort,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = column === sortKey;
  return (
    <TableHead
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <Button
        variant="ghost"
        size="xs"
        className="-ml-2"
        onClick={() => onSort(column)}
      >
        {label}
        {active &&
          (direction === "asc" ? (
            <ArrowUp data-icon="inline-end" />
          ) : (
            <ArrowDown data-icon="inline-end" />
          ))}
      </Button>
    </TableHead>
  );
}

export function AdminUsers({
  users,
  tags,
}: {
  users: AdminUserRow[];
  tags: Tag[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("user");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [toEdit, setToEdit] = useState<AdminUserRow | null>(null);
  const [toDelete, setToDelete] = useState<AdminUserRow | null>(null);

  function run(work: () => Promise<{ ok: true } | { error: string }>, done: string) {
    startTransition(async () => {
      const result = await work();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(done);
      router.refresh();
    });
  }

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setDirection(direction === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setDirection(key === "added" ? "desc" : "asc");
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? users.filter(
          (user) =>
            user.email.toLowerCase().includes(needle) ||
            (user.name ?? "").toLowerCase().includes(needle),
        )
      : users;
    const sign = direction === "asc" ? 1 : -1;
    return [...matches].sort((a, b) => {
      if (sortKey === "added") return sign * (a.createdAt - b.createdAt);
      if (sortKey === "role") return sign * a.role.localeCompare(b.role);
      return sign * userLabel(a).localeCompare(userLabel(b));
    });
  }, [users, query, sortKey, direction]);

  return (
    <>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search email or name"
          aria-label="Search users by email or name"
          className="pl-8"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead
              label="User"
              column="user"
              sortKey={sortKey}
              direction={direction}
              onSort={sortBy}
            />
            <SortableHead
              label="Role"
              column="role"
              sortKey={sortKey}
              direction={direction}
              onSort={sortBy}
            />
            <TableHead>Tags</TableHead>
            <SortableHead
              label="Added"
              column="added"
              sortKey={sortKey}
              direction={direction}
              onSort={sortBy}
            />
            <TableActionsHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((user) => (
            <TableRow key={user.email}>
              <TableCell>
                {user.name ?? user.email}
                {user.name && (
                  <span className="block text-xs text-muted-foreground">
                    {user.email}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                  {user.locked && (
                    <Badge
                      variant="outline"
                      className="font-normal whitespace-nowrap text-muted-foreground"
                    >
                      Protected admin
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <TagPicker
                  // remount when the server sends a different set, so the row
                  // never shows tags the Edit dialog has just changed
                  key={user.tagIds.join(",")}
                  tags={tags}
                  selected={user.tagIds}
                  emptyLabel="No tags"
                  label="Tags for this user"
                  onSave={(tagIds) => setUserTags(user.email, tagIds)}
                />
              </TableCell>
              <TableCell className="font-mono">
                {formatDate(user.createdAt)}
              </TableCell>
              <TableActionsCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Actions for ${user.email}`}
                      disabled={pending}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onSelect={() => setToEdit(user)}>
                      Edit
                    </DropdownMenuItem>
                    {!user.locked && (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setToDelete(user)}
                      >
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableActionsCell>
            </TableRow>
          ))}
          {visible.length === 0 && (
            <TableEmpty colSpan={5}>
              {users.length === 0
                ? "Nobody on the allow list yet."
                : "No user matches that search."}
            </TableEmpty>
          )}
        </TableBody>
      </Table>

      <EditUserDialog
        key={toEdit?.email ?? "none"}
        user={toEdit}
        tags={tags}
        onClose={() => setToEdit(null)}
      />

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove user?</DialogTitle>
            <DialogDescription>
              {toDelete?.email} loses access immediately, together with their tags
              and any password reset code they requested. Watch history is kept.
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
                run(() => deleteUser(target.email), "User removed");
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditUserDialog({
  user,
  tags,
  onClose,
}: {
  user: AdminUserRow | null;
  tags: Tag[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState(user?.role ?? "member");
  const [tagIds, setTagIds] = useState<string[]>(user?.tagIds ?? []);

  function toggleTag(tagId: string, checked: boolean) {
    setTagIds((current) =>
      checked ? [...current, tagId] : current.filter((id) => id !== tagId),
    );
  }

  function save() {
    if (!user) return;
    startTransition(async () => {
      const saved = await updateUser(user.email, {
        name,
        role: role === "admin" ? "admin" : "member",
      });
      if ("error" in saved) {
        toast.error(saved.error);
        return;
      }
      const tagged = await setUserTags(user.email, tagIds);
      if ("error" in tagged) {
        toast.error(tagged.error);
        return;
      }
      toast.success("User updated");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (pending) return; // don't close mid-save
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-user-name">Name (optional)</Label>
            <Input
              id="edit-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-user-role">Role</Label>
            <Select
              value={role}
              onValueChange={setRole}
              disabled={pending || user?.locked}
            >
              <SelectTrigger id="edit-user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {user?.locked && (
              <p className="text-xs text-muted-foreground">
                This admin comes from server config, so the role is fixed.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            {tags.length === 0 && (
              <p className="text-xs text-muted-foreground">No tags yet.</p>
            )}
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-2">
                <Checkbox
                  id={`edit-user-tag-${tag.id}`}
                  checked={tagIds.includes(tag.id)}
                  onCheckedChange={(checked) => toggleTag(tag.id, checked === true)}
                  disabled={pending}
                />
                <Label htmlFor={`edit-user-tag-${tag.id}`} className="font-normal">
                  {tag.name}
                </Label>
              </div>
            ))}
          </div>
          <Button
            type="button"
            onClick={save}
            disabled={pending}
            className="w-full"
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
