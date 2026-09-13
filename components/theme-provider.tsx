"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";

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

/** `t` toggles light/dark anywhere except inside form fields. */
function ThemeShortcut() {
  const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "t" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [resolvedTheme, setTheme]);
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeShortcut />
      {children}
    </NextThemesProvider>
  );
}
