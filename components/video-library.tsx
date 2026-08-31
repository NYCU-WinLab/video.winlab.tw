"use client";

import { Pin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type LibraryItem = {
  id: string;
  title: string;
  createdAt: number;
  duration: number | null;
  position: number | null;
  lastWatchedAt: number | null;
  pinned: boolean;
};

function formatDuration(seconds: number) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function VideoCard({ item }: { item: LibraryItem }) {
  const router = useRouter();
  const [pinned, setPinned] = useState(item.pinned);

  async function togglePin(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !pinned;
    setPinned(next);
    await fetch("/api/pins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: item.id, pinned: next }),
    }).catch(() => setPinned(!next));
    router.refresh();
  }

  const percent =
    item.position !== null && item.duration
      ? Math.min(100, (item.position / item.duration) * 100)
      : 0;

  return (
    <Link href={`/watch/${item.id}`}>
      <Card className="h-full transition-colors hover:bg-accent/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-base">
              {item.title}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-1 shrink-0"
              onClick={togglePin}
              aria-label={pinned ? "Unpin" : "Pin"}
            >
              <Pin
                className={cn(
                  "size-4",
                  pinned ? "fill-current" : "text-muted-foreground",
                )}
              />
            </Button>
          </div>
          <CardDescription>
            {item.duration ? formatDuration(item.duration) : "—"} ·{" "}
            {new Date(item.createdAt).toLocaleDateString("en-US", {
              dateStyle: "medium",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={percent} />
          <p className="mt-2 text-xs text-muted-foreground">
            {item.position !== null
              ? `Resume at ${formatDuration(item.position)}`
              : "Not started"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function Section({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: LibraryItem[];
  emptyText: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((i) =>
    i.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="h-8 max-w-48"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {items.length === 0 ? emptyText : "No matches."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <VideoCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

export function VideoLibrary({ items }: { items: LibraryItem[] }) {
  const recent = items
    .filter((i) => i.lastWatchedAt !== null)
    .sort((a, b) => (b.lastWatchedAt ?? 0) - (a.lastWatchedAt ?? 0))
    .slice(0, 6);
  const pinned = items.filter((i) => i.pinned);
  const all = [...items].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-10">
      <Section
        title="Recently watched"
        items={recent}
        emptyText="Nothing watched yet."
      />
      <Section title="Pinned" items={pinned} emptyText="No pinned videos." />
      <Section title="All videos" items={all} emptyText="No videos yet." />
    </div>
  );
}
