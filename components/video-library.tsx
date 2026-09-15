"use client";

import { Film, SearchX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useLibraryQuery } from "@/components/library-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
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
    <Link
      href={`/watch/${item.id}`}
      className="group block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted">
        {thumbFailed && (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Film className="size-8" />
          </div>
        )}
        {!thumbFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/thumb/${item.id}`}
            alt={item.title}
            loading="lazy"
            onError={() => setThumbFailed(true)}
            className="size-full object-cover"
          />
        )}
        {item.duration !== null && (
          <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-xs text-white">
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
          <span className="font-mono">
            {new Date(item.createdAt).toLocaleDateString("en-US", {
              dateStyle: "medium",
            })}
          </span>
          {item.position !== null && (
            <>
              {" · Resume at "}
              <span className="font-mono">
                {formatDuration(item.position)}
              </span>
            </>
          )}
        </p>
      </div>
    </Link>
  );
}

function VideoCardSkeleton() {
  return (
    <div className="block">
      <Skeleton className="aspect-video rounded-2xl" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

/** Placeholder card grid shown while the library loads (see `app/loading.tsx`). */
export function VideoLibrarySkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 min-[480px]:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
      {Array.from({ length: count }, (_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function VideoLibrary({ items }: { items: LibraryItem[] }) {
  const rawQuery = useLibraryQuery().query.trim();
  const query = rawQuery.toLowerCase();

  const filtered = items
    .filter((i) => i.title.toLowerCase().includes(query))
    .sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { numeric: true }),
    );

  if (filtered.length === 0) {
    return items.length === 0 ? (
      <EmptyState
        icon={Film}
        title="No videos yet"
        description="Uploaded videos will show up here."
      />
    ) : (
      <EmptyState
        icon={SearchX}
        title="No matches"
        description={
          rawQuery
            ? `Nothing matches “${rawQuery}”.`
            : "Try a different search."
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 min-[480px]:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
      {filtered.map((item) => (
        <VideoCard key={item.id} item={item} />
      ))}
    </div>
  );
}
