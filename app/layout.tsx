import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Geist for UI/body and headings; Geist Mono only for data tokens
// (durations, timestamps, sizes, IDs, codes). CJK falls back to a system
// sans stack declared in globals.css so Chinese never renders in mono.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WinLab Video",
  description: "Lab video portal with per-user watch progress",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          {/* Floating copyright, pinned to the bottom-right corner on every
              page. Non-interactive and below the toaster so it never blocks
              a control or a notification. */}
          <footer
            aria-label="Copyright"
            className="pointer-events-none fixed right-4 bottom-4 z-40 text-sm text-muted-foreground select-none sm:right-6 sm:bottom-6"
          >
            © 2026 WinLab
          </footer>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
