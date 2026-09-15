"use client";

import { FileVideo, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/limits";
import { cn } from "@/lib/utils";

export function UploadDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (xhr.status === 413) {
          return reject(
            new Error(`File is larger than the ${MAX_UPLOAD_LABEL} upload limit`),
          );
        }
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
    const file = form.get("file");
    if (file instanceof File && file.size > MAX_UPLOAD_BYTES) {
      toast.error(`File is larger than the ${MAX_UPLOAD_LABEL} upload limit`);
      return;
    }
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
        if (!next) setFileName(null); // reset picker when the dialog closes
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload />
          Upload video
        </Button>
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
            <Label htmlFor="file">
              File (mp4, H.264 recommended, up to {MAX_UPLOAD_LABEL})
            </Label>
            <input
              ref={fileInputRef}
              id="file"
              name="file"
              type="file"
              accept="video/*"
              required
              disabled={uploading}
              className="sr-only"
              onChange={(e) =>
                setFileName(e.currentTarget.files?.[0]?.name ?? null)
              }
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                if (uploading) return;
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (uploading) return;
                const input = fileInputRef.current;
                const dropped = e.dataTransfer.files;
                if (input && dropped.length > 0) {
                  input.files = dropped;
                  setFileName(dropped[0].name);
                }
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input px-4 py-6 text-center transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                dragging && "border-ring bg-muted",
              )}
            >
              <FileVideo className="size-6 text-muted-foreground" strokeWidth={1.5} />
              {fileName ? (
                <span className="type-body break-all">{fileName}</span>
              ) : (
                <span className="type-caption">
                  Drag a video here, or click to choose
                </span>
              )}
            </button>
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
