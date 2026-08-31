"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Segment = {
  start: number;
  end: number;
  text: string;
  speaker: string | null;
};

type Props = {
  videoId: string;
  src: string;
  initialPosition: number;
  isAdmin: boolean;
  transcriptStatus: string;
  transcriptError: string | null;
  segments: Segment[];
};

function formatTimestamp(seconds: number) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export function WatchView({
  videoId,
  src,
  initialPosition,
  isAdmin,
  transcriptStatus,
  transcriptError,
  segments: initialSegments,
}: Props) {
  const [status, setStatus] = useState(transcriptStatus);
  const [error, setError] = useState(transcriptError);
  const [segments, setSegments] = useState(initialSegments);
  const [currentTime, setCurrentTime] = useState(initialPosition);

  const seekRef = useRef<((t: number) => void) | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const registerSeek = useCallback((fn: (t: number) => void) => {
    seekRef.current = fn;
  }, []);

  // Poll while the transcription job is still running.
  useEffect(() => {
    if (status !== "pending") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/transcript/${videoId}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: string;
          error: string | null;
          segments: Segment[];
        };
        setStatus(data.status);
        setError(data.error);
        if (data.status === "done") setSegments(data.segments);
      } catch {
        // transient; next tick retries
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, [status, videoId]);

  const activeIdx = segments.findLastIndex((s) => s.start <= currentTime);

  // Follow playback like a live chat; while paused there are no time
  // updates, so the list simply stays where it is.
  useEffect(() => {
    if (activeIdx < 0) return;
    const list = listRef.current;
    const el = activeRef.current;
    if (!list || !el) return;
    list.scrollTo({
      top: el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2,
      behavior: "smooth",
    });
  }, [activeIdx]);

  async function retry() {
    setStatus("pending");
    setError(null);
    const res = await fetch(`/api/transcript/${videoId}/retry`, {
      method: "POST",
    });
    if (!res.ok) {
      setStatus("error");
      toast.error("Failed to start transcription");
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100dvh-6.5rem)] lg:flex-row">
      <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-black lg:h-full">
        <VideoPlayer
          videoId={videoId}
          src={src}
          initialPosition={initialPosition}
          onTimeChange={setCurrentTime}
          registerSeek={registerSeek}
        />
      </div>

      <aside className="flex h-[45vh] flex-col rounded-lg border lg:h-full lg:w-96 lg:shrink-0">
        <div className="border-b px-4 py-2">
          <h2 className="text-sm font-medium">Transcript</h2>
        </div>

        {status === "done" && segments.length > 0 ? (
          <div ref={listRef} className="flex-1 overflow-y-auto p-2">
            {segments.map((seg, i) => (
              <button
                key={i}
                ref={i === activeIdx ? activeRef : undefined}
                type="button"
                onClick={() => seekRef.current?.(seg.start)}
                className={cn(
                  "flex w-full gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                  i === activeIdx && "bg-accent",
                )}
              >
                <span className="shrink-0 font-mono text-xs leading-5 text-muted-foreground">
                  {formatTimestamp(seg.start)}
                </span>
                <span>
                  {seg.speaker && (
                    <span className="mr-1 text-xs text-muted-foreground">
                      {seg.speaker}:
                    </span>
                  )}
                  {seg.text}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
            {status === "pending" && <p>Transcribing… this can take a while.</p>}
            {status === "done" && segments.length === 0 && (
              <p>No speech detected.</p>
            )}
            {(status === "error" || status === "none") && (
              <>
                <p>
                  {status === "error"
                    ? `Transcription failed${error ? `: ${error}` : "."}`
                    : "No transcript yet."}
                </p>
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={retry}>
                    {status === "error" ? "Retry" : "Generate transcript"}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
