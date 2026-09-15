"use client";

import { Search } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { Input } from "@/components/ui/input";

const QueryContext = createContext<{
  query: string;
  setQuery: (q: string) => void;
}>({ query: "", setQuery: () => {} });

/** Shares the search query between the header toolbar and the grid. */
export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  return (
    <QueryContext.Provider value={{ query, setQuery }}>
      {children}
    </QueryContext.Provider>
  );
}

export function useLibraryQuery() {
  return useContext(QueryContext);
}

export function LibraryToolbar() {
  const { query, setQuery } = useLibraryQuery();
  return (
    <form
      // Full width on its own row on mobile; capped and centred by the header
      // from `sm` up.
      className="relative w-full sm:max-w-md"
      onSubmit={(e) => e.preventDefault()}
    >
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        className="h-11 rounded-full pr-11"
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-full text-muted-foreground hover:text-foreground"
      >
        <Search className="size-4" />
      </button>
    </form>
  );
}
