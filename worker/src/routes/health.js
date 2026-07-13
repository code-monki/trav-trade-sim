import { Hono } from 'hono'
import { checkSchemaVersion } from '../lib/schema-version.js'

const app = new Hono()

// ── GET /api/health ───────────────────────────────────────────────────────────
// DB-aware readiness check, distinct from the plain liveness check at
// GET / (worker/src/index.js) — this one round-trips D1 to confirm the
// database has received every migration this Worker's code expects.
app.get('/', async (c) => {
  const result = await checkSchemaVersion(c.env.DB)
  if (!result.ok) {
    return c.json({
      error: 'Database schema drift detected',
      schema_ok: false,
      missing_migrations:    result.missing,
      unexpected_migrations: result.unexpected,
    }, 503)
  }
  return c.json({ data: { ok: true, schema_ok: true, applied_migrations: result.applied } })
})

export default app
