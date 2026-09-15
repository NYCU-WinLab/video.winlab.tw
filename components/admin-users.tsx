"use client";

import { Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addUser,
  deleteUser,
  setUserRole,
  setUserTags,
} from "@/app/admin/actions";
import { TagPicker } from "@/components/tag-picker";
import { Badge } from "@/components/ui/badge";
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export function AdminUsers({
  users,
  tags,
}: {
  users: AdminUserRow[];
  tags: Tag[];
}) {
  const router = useRouter();
  const [role, setRole] = useState("member");
  const [pending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<AdminUserRow | null>(null);
  const form = useRef<HTMLFormElement>(null);

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

  return (
    <>
      <form
        className="flex flex-wrap items-end gap-3"
        ref={form}
        action={(formData) => {
          formData.set("role", role);
          startTransition(async () => {
            const result = await addUser(formData);
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            toast.success("User added");
            form.current?.reset();
            setRole("member");
            router.refresh();
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            name="email"
            type="email"
            placeholder="member@example.com"
            required
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-name">Name (optional)</Label>
          <Input id="user-name" name="name" disabled={pending} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-role">Role</Label>
          <Select value={role} onValueChange={setRole} disabled={pending}>
            <SelectTrigger id="user-role" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          <UserPlus />
          Add user
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
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
                  {user.locked ? (
                    <span className="text-xs text-muted-foreground">
                      locked by ADMIN_EMAILS
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            setUserRole(
                              user.email,
                              user.role === "admin" ? "member" : "admin",
                            ),
                          "Role updated",
                        )
                      }
                    >
                      {user.role === "admin" ? "Make member" : "Make admin"}
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <TagPicker
                  tags={tags}
                  selected={user.tagIds}
                  emptyLabel="No tags"
                  label="Tags for this user"
                  onSave={(tagIds) => setUserTags(user.email, tagIds)}
                />
              </TableCell>
              <TableCell>{formatDate(user.createdAt)}</TableCell>
              <TableCell>
                {!user.locked && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive"
                    aria-label={`Remove ${user.email}`}
                    disabled={pending}
                    onClick={() => setToDelete(user)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Nobody on the allow list yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove user?</DialogTitle>
            <DialogDescription>
              {toDelete?.email} loses access immediately, together with their tags
              and any sign-in code they requested. Watch history is kept.
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
