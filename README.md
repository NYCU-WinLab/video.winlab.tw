# video.winlab.tw

Lab video portal. Admins upload videos, lab members sign in with Google to
watch them, and the site records where each viewer stopped and how long they
actually watched. Only emails on the allow list can sign in, and videos can be
locked to tags so that only the right people see them. Videos are stored on the lab Nextcloud over WebDAV and
streamed through the app with HTTP Range support, so nothing is reachable
without a signed-in session except `/api/health`. Uploads are transcribed by
[transcribe.winlab.tw](https://transcribe.winlab.tw) and the transcript is
shown next to the player, clickable to seek.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) + TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| Auth | Auth.js (NextAuth v5): Google OAuth or emailed sign-in code, JWT sessions |
| Database | SQLite via Drizzle ORM (better-sqlite3) |
| Video storage | Nextcloud WebDAV (`video-svc` service account) |
| Thumbnails, duration | ffmpeg / ffprobe on the host, cached under `THUMB_DIR` |
| Transcripts | transcribe.winlab.tw HTTP API, polled in-process |

## Access

- The `users` table is the allow list. Both sign-in paths go through it: an
  email that is not listed is rejected with "This email is not on the allow
  list, ask an admin" on `/login`. Removing someone ends their session on
  their next request.
- Admins are `ADMIN_EMAILS` plus every user with `role = 'admin'`.
  `ADMIN_EMAILS` is the bootstrap source and cannot be demoted from the UI.
- The first migration seeds the allow list from everyone already known to the
  database (viewers in `watch_progress`, uploaders in `videos`) plus
  `ADMIN_EMAILS`, so switching the allow list on locks nobody out. It runs on
  any start that finds the table empty, so clearing the allow list entirely
  brings it back; removing individual users does not.
- Tags (`/admin/tags`) are assigned to users (`/admin/users`) and to videos
  (`/admin/videos/<id>`). A video with no tag is visible to everyone signed
  in; a video locked to tags is visible to admins and to users carrying one of
  those tags. The rule is enforced on the home list, the watch page and the
  stream, thumbnail, transcript and progress APIs, not just in the UI.
- Email sign-in: `/login` asks for an email, `POST /api/auth/pin/request`
  mails a 6-digit code (sha256-hashed in `login_codes`, valid 10 minutes, 5
  requests per email per hour, 5 guesses per code), and the `email-pin`
  credentials provider checks it.

## How it works

- `proxy.ts` (the Next.js 16 name for middleware) requires a session on every
  page and API route except `/login`, the auth callbacks and `/api/health`.
  `/admin` additionally requires an admin. Every API route re-checks the
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
- Admin (`/admin`) lists videos with live transcript status and who they are
  visible to, `/admin/users` manages the allow list, roles and user tags, and
  `/admin/tags` manages tags. Each video page offers rename, tag locks, delete (removes the file, thumbnail, transcript and
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

Email sign-in needs `SMTP_USER` and `SMTP_PASS` (and optionally `SMTP_HOST`,
`SMTP_PORT`, `MAIL_FROM`) in `/opt/video/app/.env` before the restart, and the
deploy must run `bun install` because `nodemailer` is a new dependency.
Without SMTP credentials the app refuses to hand out codes in production.

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
