"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  videoId: string;
  src: string;
  initialPosition: number;
  onTimeChange?: (t: number) => void;
  registerSeek?: (seek: (t: number) => void) => void;
};

const HEARTBEAT_MS = 10_000;
export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function VideoPlayer({
  videoId,
  src,
  initialPosition,
  onTimeChange,
  registerSeek,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTimeRef = useRef(0);
  const accumulatedRef = useRef(0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    registerSeek?.((t) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = t;
      video.play().catch(() => {});
    });
  }, [registerSeek]);

  const applyRate = useCallback((next: number) => {
    const clamped = Math.min(SPEEDS[SPEEDS.length - 1], Math.max(SPEEDS[0], next));
    setRate(clamped);
    if (videoRef.current) videoRef.current.playbackRate = clamped;
  }, []);

  // Keyboard shortcuts (YouTube-style), ignored while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const video = videoRef.current;
      if (!video || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey)
        return;
      const step = (s: number) => {
        video.currentTime = Math.max(
          0,
          Math.min(video.duration || Infinity, video.currentTime + s),
        );
      };
      switch (e.key) {
        case " ":
        case "k":
          if (video.paused) video.play().catch(() => {});
          else video.pause();
          break;
        case "ArrowLeft":
          step(-5);
          break;
        case "ArrowRight":
          step(5);
          break;
        case "j":
          step(-10);
          break;
        case "l":
          step(10);
          break;
        case "ArrowUp":
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case "ArrowDown":
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case "m":
          video.muted = !video.muted;
          break;
        case "f":
          if (document.fullscreenElement) document.exitFullscreen();
          else video.requestFullscreen?.();
          break;
        case "<":
          applyRate(SPEEDS[Math.max(0, SPEEDS.indexOf(rate) - 1)]);
          break;
        case ">":
          applyRate(
            SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(rate) + 1)],
          );
          break;
        default:
          if (/^[0-9]$/.test(e.key) && Number.isFinite(video.duration)) {
            video.currentTime = (Number(e.key) / 10) * video.duration;
            break;
          }
          return;
      }
      e.preventDefault();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rate, applyRate]);

  const flush = useCallback(
    (useBeacon = false) => {
      const video = videoRef.current;
      if (!video) return;
      const delta = accumulatedRef.current;
      if (delta <= 0 && !useBeacon) return;
      accumulatedRef.current = 0;
      const payload = JSON.stringify({
        videoId,
        position: video.currentTime,
        delta,
        duration: Number.isFinite(video.duration) ? video.duration : undefined,
      });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/progress",
          new Blob([payload], { type: "application/json" }),
        );
      } else {
        fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    },
    [videoId],
  );

  useEffect(() => {
    const interval = setInterval(() => flush(), HEARTBEAT_MS);
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHidden);
      flush(true);
    };
  }, [flush]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 lg:h-full">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          className="w-full object-contain lg:h-full"
          onLoadedMetadata={(e) => {
            const video = e.currentTarget;
            video.playbackRate = rate;
            if (initialPosition > 0 && initialPosition < video.duration - 5) {
              video.currentTime = initialPosition;
            }
            lastTimeRef.current = video.currentTime;
          }}
          onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            const delta = t - lastTimeRef.current;
            // Ignore seeks: only count small forward steps as watched time.
            if (delta > 0 && delta < 2) accumulatedRef.current += delta;
            lastTimeRef.current = t;
            onTimeChange?.(t);
          }}
          onPause={() => flush()}
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <span className="mr-1">Speed</span>
        {SPEEDS.map((s) => (
          // Chips instead of a select so the current speed is visible at a glance.
          <button
            key={s}
            type="button"
            onClick={() => applyRate(s)}
            className={cn(
              "rounded-full px-2 py-0.5 hover:bg-accent hover:text-foreground",
              s === rate && "bg-accent text-foreground",
            )}
          >
            {s}×
          </button>
        ))}
        <span className="ml-auto hidden sm:inline">
          Space play · ←/→ 5s · J/L 10s · M mute · F fullscreen · &lt;/&gt;
          speed · T theme
        </span>
      </div>
    </div>
  );
}
