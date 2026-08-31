export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 text-xs text-muted-foreground">
        <span>WinLab Video</span>
        <a
          href="https://github.com/NYCU-WinLab/video.winlab.tw"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground"
        >
          NYCU WinLab
        </a>
      </div>
    </footer>
  );
}
