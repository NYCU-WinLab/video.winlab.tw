"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type SortKey = "name" | "date";

export function readSort(params: URLSearchParams): SortKey {
  return params.get("sort") === "date" ? "date" : "name";
}

function setParam(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(window.history.state, "", url);
}

/** Search box + sort toggle for the home grid; state lives in the URL. */
export function LibraryToolbar() {
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const sort = readSort(params);

  return (
    <>
      <Input
        value={query}
        onChange={(e) => setParam("q", e.target.value || null)}
        placeholder="Search…"
        className="h-8 w-full max-w-md"
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs text-muted-foreground"
        onClick={() => setParam("sort", sort === "name" ? "date" : null)}
      >
        {sort === "name" ? "Name" : "Newest"}
      </Button>
    </>
  );
}
