# video.winlab.tw

Lab video portal. Admins upload videos, lab members sign in with Google to
watch them, and the site records where each viewer stopped and how long they
actually watched. Videos are stored on the lab Nextcloud over WebDAV and
streamed through the app with HTTP Range support, so nothing is reachable
without a signed-in session except `/api/health`. Uploads are transcribed by
[transcribe.winlab.tw](https://transcribe.winlab.tw) and the transcript is
shown next to the player, clickable to seek.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) + TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| Auth | Auth.js (NextAuth v5) with Google OAuth, JWT sessions |
| Database | SQLite via Drizzle ORM (better-sqlite3) |
| Video storage | Nextcloud WebDAV (`video-svc` service account) |
| Thumbnails, duration | ffmpeg / ffprobe on the host, cached under `THUMB_DIR` |
| Transcripts | transcribe.winlab.tw HTTP API, polled in-process |

## How it works

- `middleware.ts` requires a session on every page and API route except
  `/login`, the auth callbacks and `/api/health`. `/admin` additionally
  requires an email listed in `ADMIN_EMAILS`. Every API route re-checks the
  session itself.
- Upload (`POST /api/videos`, admin only, 2 GB cap) streams the file to
  Nextcloud at `files/video-svc/videos/<id>-<name>`, records metadata in
  SQLite, then in the background probes the duration with ffprobe, renders a
  thumbnail, and submits the file to transcribe.winlab.tw.
- Thumbnails (`GET /api/thumb/:id`) are generated on first request with
  ffmpeg reading straight from WebDAV and cached as JPEG under `THUMB_DIR`.
  A failed render is remembered for 24 h so a broken file cannot spawn
  ffmpeg on every page view.
- Transcripts: `instrumentation.ts` starts a poller that, every 5 minutes,
  asks transcribe for every `pending` video and imports finished segments in
  one SQLite transaction. The admin pages and the watch page's 15 s poll go
  through the same guarded path, so an import never runs twice at once.
- Admin (`/admin`) lists videos with live transcript status, and each video
  page offers rename, delete (removes the file, thumbnail, transcript and
  everyone's progress), resubmit, and a link to the transcribe job.
- `GET /api/health` (public) reports `db`, `transcriptSync`, `thumbnails`,
  `nextcloud` and `transcribe` checks. It returns 503 only when the database
  or the poller is broken; dependency outages show as `degraded` with 200.
- Playback (`GET /api/stream/:id`) proxies WebDAV and forwards the `Range`
  header, so seeking works without downloading the whole file.
- The player posts a heartbeat to `POST /api/progress` every 10 seconds and on
  pause/leave: current position plus seconds actually watched (seeks are not
  counted). The server clamps position to the probed duration and watched
  time to the wall-clock gap since the previous heartbeat, so a forged client
  cannot inflate the stats. The admin page shows per-viewer position, watch
  time, and last activity.

## Deploy

Production runs on PVE VM 114 as the `video` systemd service. Merging to
`main` does not deploy; run:

```sh
ssh video 'cd /opt/video/app && git pull && ~/.bun/bin/bun install && ~/.bun/bin/bun run build && sudo systemctl restart video'
```

## Development

```sh
bun install
cp .env.example .env.local  # fill in values
bun dev
```

Google OAuth needs `http://localhost:3000/api/auth/callback/google` (and the
production URL) registered as an authorized redirect URI.

## Notes

- Videos should be H.264 MP4 with the moov atom up front for instant
  progressive playback: `ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4`.
- Upload buffers through the app process, so the cap is 2 GB
  (`lib/limits.ts` and `proxyClientMaxBodySize` in `next.config.ts`). For
  larger files upload directly to the Nextcloud folder and insert the
  metadata row manually.
- The host needs `ffmpeg` and `ffprobe` (7.0 or newer, for `-/headers`).
- SQLite lives at `DATABASE_PATH` (default `./data/app.db`); the schema is
  created automatically on first run.
