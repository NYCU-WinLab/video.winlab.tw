"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function TranscriptActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    try {
      const res = await fetch(`/api/transcript/${id}/retry`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`retry failed (${res.status})`);
      toast.success("Transcription resubmitted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => router.refresh()}
      >
        <RefreshCw className={busy ? "animate-spin" : undefined} />
        Refresh
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={retry}>
        {status === "error" || status === "none"
          ? "Generate transcript"
          : "Resubmit"}
      </Button>
    </>
  );
}
