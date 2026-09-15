"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addTag } from "@/app/admin/actions";
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

export function CreateTagDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
          <Plus />
          Create tag
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create tag</DialogTitle>
        </DialogHeader>
        <form
          ref={form}
          className="space-y-4"
          action={(formData) => {
            startTransition(async () => {
              const result = await addTag(formData);
              if ("error" in result) {
                toast.error(result.error);
                return;
              }
              toast.success("Tag created");
              form.current?.reset();
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="tag-name">Tag</Label>
            <Input
              id="tag-name"
              name="name"
              placeholder="seminar-2026"
              required
              disabled={pending}
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create tag"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
