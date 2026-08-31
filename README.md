# video.winlab.tw

Lab video portal. Admins upload videos, lab members sign in with Google to
watch them, and the site records where each viewer stopped and how long they
actually watched. Videos are stored on the lab Nextcloud over WebDAV and
streamed through the app with HTTP Range support, so nothing is publicly
reachable without a signed-in session.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) + TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| Auth | Auth.js (NextAuth v5) with Google OAuth, JWT sessions |
| Database | SQLite via Drizzle ORM (better-sqlite3) |
| Video storage | Nextcloud WebDAV (`video-svc` service account) |

## How it works

- `middleware.ts` requires a session on every page and API route except
  `/login` and the auth callbacks. `/admin` additionally requires an email
  listed in `ADMIN_EMAILS`.
- Upload (`POST /api/videos`, admin only) streams the file to Nextcloud at
  `files/video-svc/videos/<id>-<name>` and records metadata in SQLite.
- Playback (`GET /api/stream/:id`) proxies WebDAV and forwards the `Range`
  header, so seeking works without downloading the whole file.
- The player posts a heartbeat to `POST /api/progress` every 10 seconds and on
  pause/leave: current position plus seconds actually watched (seeks are not
  counted). The admin page shows per-viewer position, watch time, and last
  activity.

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
- Upload buffers through the app process; keep files to a few GB or upload
  directly to the Nextcloud folder and insert the metadata row manually.
- SQLite lives at `DATABASE_PATH` (default `./data/app.db`); the schema is
  created automatically on first run.
