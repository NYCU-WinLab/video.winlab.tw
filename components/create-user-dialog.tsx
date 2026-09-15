"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addUser } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export function CreateUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("member");
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return; // don't close mid-save
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          Create user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
        </DialogHeader>
        <form
          ref={form}
          className="space-y-4"
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
              setOpen(false);
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
              <SelectTrigger id="user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Adding…" : "Add user"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
