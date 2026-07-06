import { Hono } from 'hono'
import { requireAuth, requireReferee } from '../middleware/auth.js'
import { advanceTick } from '../lib/rollup.js'

const app = new Hono()

// ── GET /api/campaigns/:id/calendar ──────────────────────────────────────────
app.get('/:id/calendar', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const row = await c.env.DB.prepare(
    `SELECT current_tick, year, day FROM campaign_calendar WHERE campaign_id = ?`
  ).bind(id).first()

  if (!row) return c.json({ error: 'Calendar not found' }, 404)
  return c.json({ data: row })
})

// ── POST /api/campaigns/:id/advance-tick (referee only) ───────────────────────
app.post('/:id/advance-tick', requireReferee, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const result = await advanceTick(c.env.DB, id)
  if (result.error) return c.json({ error: result.error }, 400)
  return c.json({ data: result })
})

export default app
