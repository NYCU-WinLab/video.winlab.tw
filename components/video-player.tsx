"use client";

import { useCallback, useEffect, useRef } from "react";

type Props = {
  videoId: string;
  src: string;
  initialPosition: number;
  onTimeChange?: (t: number) => void;
  registerSeek?: (seek: (t: number) => void) => void;
};

const HEARTBEAT_MS = 10_000;

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

  useEffect(() => {
    registerSeek?.((t) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = t;
      video.play().catch(() => {});
    });
  }, [registerSeek]);

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
    <video
      ref={videoRef}
      src={src}
      controls
      playsInline
      className="w-full object-contain lg:h-full"
      onLoadedMetadata={(e) => {
        const video = e.currentTarget;
        if (initialPosition > 0 && initialPosition < video.duration - 5) {
          video.currentTime = initialPosition;
        }
        lastTimeRef.current = video.currentTime;
      }}
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
  );
}
