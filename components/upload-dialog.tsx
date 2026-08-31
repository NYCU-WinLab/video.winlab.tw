"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import { Progress } from "@/components/ui/progress";

export function UploadDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);

  function upload(form: FormData) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/videos");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setPercent(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        try {
          reject(new Error(JSON.parse(xhr.responseText).error));
        } catch {
          reject(new Error(`upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("network error during upload"));
      xhr.send(form);
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setUploading(true);
    setPercent(0);
    try {
      await upload(form);
      toast.success("Video uploaded");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (uploading) return; // don't close mid-upload
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>Upload video</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload video</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required disabled={uploading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">File (mp4, H.264 recommended)</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept="video/*"
              required
              disabled={uploading}
            />
          </div>
          {uploading && (
            <div className="space-y-1">
              <Progress value={percent} />
              <p className="text-xs text-muted-foreground">
                {percent < 100
                  ? `Uploading… ${percent}%`
                  : "Transferring to storage…"}
              </p>
            </div>
          )}
          <Button type="submit" disabled={uploading} className="w-full">
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
