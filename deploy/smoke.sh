#!/usr/bin/env bash
# The image as deployed: start it with an empty database and probe the
# health check, the sign-in redirect and the tools the thumbnails need.
# ci runs it with the image loaded as ghcr.io/nycu-winlab/video.winlab.tw:ci.
set -euo pipefail
trap 'docker compose logs' EXIT

mkdir -p "$RUNNER_TEMP/video-data"
sudo chown 1000:1000 "$RUNNER_TEMP/video-data"
cat > "$RUNNER_TEMP/video.env" <<ENV
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
NEXTCLOUD_URL=https://nextcloud.example.com
NEXTCLOUD_USER=ci
NEXTCLOUD_APP_PASSWORD=ci
ENV
cat > .env <<ENV
VIDEO_VERSION=ci
VIDEO_ENV_FILE=$RUNNER_TEMP/video.env
VIDEO_DATA=$RUNNER_TEMP/video-data
VIDEO_BIND=127.0.0.1
ENV
docker compose up -d --wait web

curl -sf localhost:3000/api/health | grep -q '"db":"ok"'
test "$(curl -s -o /dev/null -w '%{http_code}' localhost:3000/)" = 302
docker compose exec -T web ffprobe -version > /dev/null
docker compose exec -T web ffmpeg -version > /dev/null
test -f "$RUNNER_TEMP/video-data/app.db"
echo "smoke passed"
