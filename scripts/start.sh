#!/bin/sh
# Production start (Railway runs `npm start`; railway.json was never read by the service).
# 1. Check/apply database migrations. If that fails, log it and still start, so the site stays up.
# 2. Make sure the admin user exists.
# 3. In the background: move any files still stored in the database to R2, and back up hourly.
# 4. Start the app in the foreground.

node scripts/migrate.js || echo "[start] migration check failed (see above); starting the app anyway"
node prisma/seed.js || echo "[start] seed failed; starting the app anyway"

node scripts/move-files-to-r2.js &
( while true; do node scripts/backup.js || echo "[backup] failed (see above)"; sleep 3600; done ) &

exec node_modules/.bin/next start
