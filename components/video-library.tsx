"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { readSort } from "@/components/library-toolbar";
import { formatDuration } from "@/lib/format";

export type LibraryItem = {
  id: string;
  title: string;
  createdAt: number;
  duration: number | null;
  position: number | null;
};

function VideoCard({ item }: { item: LibraryItem }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const percent =
    item.position !== null && item.duration
      ? Math.min(100, (item.position / item.duration) * 100)
      : 0;

  return (
    <Link href={`/watch/${item.id}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
        {!thumbFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/thumb/${item.id}`}
            alt=""
            loading="lazy"
            onError={() => setThumbFailed(true)}
            className="size-full object-cover"
          />
        )}
        {item.duration !== null && (
          <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
            {formatDuration(item.duration)}
          </span>
        )}
        {percent > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
            <div
              className="h-full bg-red-600"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <p className="line-clamp-2 text-sm leading-snug">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString("en-US", {
            dateStyle: "medium",
          })}
          {item.position !== null &&
            ` · Resume at ${formatDuration(item.position)}`}
        </p>
      </div>
    </Link>
  );
}

export function VideoLibrary({ items }: { items: LibraryItem[] }) {
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const sort = readSort(params);

  const filtered = items
    .filter((i) => i.title.toLowerCase().includes(query))
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title, undefined, { numeric: true })
        : b.createdAt - a.createdAt,
    );

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {items.length === 0 ? "No videos yet." : "No matches."}
      </p>
    );
  }

  return (
    <div className="grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filtered.map((item) => (
        <VideoCard key={item.id} item={item} />
      ))}
    </div>
  );
}
