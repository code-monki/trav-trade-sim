import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'

const app = new Hono()

// ── GET /api/reports/ledger — paginated transaction ledger ────────────────────
// ?ship_id=X&limit=N&from_tick=A&to_tick=B
app.get('/ledger', requireAuth, async (c) => {
  const session   = c.var.session
  const { ship_id, limit = '101', from_tick, to_tick } = c.req.query()

  let sql    = `SELECT * FROM transactions WHERE ship_id = ? AND campaign_id = ?`
  const args = [ship_id, session.campaign_id]

  if (from_tick != null) { sql += ` AND tick >= ?`; args.push(Number(from_tick)) }
  if (to_tick   != null) { sql += ` AND tick < ?`;  args.push(Number(to_tick))   }

  sql += ` ORDER BY tick DESC LIMIT ?`
  args.push(Number(limit))

  const { results } = await c.env.DB.prepare(sql).bind(...args).all()
  return c.json({ data: results ?? [] })
})

// ── GET /api/reports/trades — paginated trade record history ──────────────────
// ?ship_id=X&limit=N&from_tick=A&to_tick=B
app.get('/trades', requireAuth, async (c) => {
  const session   = c.var.session
  const { ship_id, limit = '101', from_tick, to_tick } = c.req.query()

  let sql    = `SELECT * FROM trade_records WHERE ship_id = ? AND campaign_id = ?`
  const args = [ship_id, session.campaign_id]

  if (from_tick != null) { sql += ` AND sell_tick >= ?`; args.push(Number(from_tick)) }
  if (to_tick   != null) { sql += ` AND sell_tick < ?`;  args.push(Number(to_tick))   }

  sql += ` ORDER BY sell_tick DESC LIMIT ?`
  args.push(Number(limit))

  const { results } = await c.env.DB.prepare(sql).bind(...args).all()
  return c.json({ data: results ?? [] })
})

// ── GET /api/reports/income — income breakdown by transaction type ─────────────
// ?ship_id=X&from_tick=A&to_tick=B
app.get('/income', requireAuth, async (c) => {
  const session   = c.var.session
  const { ship_id, from_tick, to_tick } = c.req.query()

  let sql    = `SELECT type, total_cr FROM transactions WHERE ship_id = ? AND campaign_id = ?`
  const args = [ship_id, session.campaign_id]

  if (from_tick != null) { sql += ` AND tick >= ?`; args.push(Number(from_tick)) }
  if (to_tick   != null) { sql += ` AND tick < ?`;  args.push(Number(to_tick))   }

  const { results } = await c.env.DB.prepare(sql).bind(...args).all()

  const byType = {}
  for (const row of results ?? []) {
    byType[row.type] = (byType[row.type] ?? 0) + row.total_cr
  }

  return c.json({ data: byType })
})

// ── POST /api/reports/skills/upsert — player self-service skill upsert ─────────
// Used by CharacterDialog (players editing their own skills)
app.post('/skills', requireAuth, async (c) => {
  const session = c.var.session
  const { campaign_id, player_id, skill, level } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (player_id   !== session.player_id)   return c.json({ error: 'Forbidden' }, 403)

  const skillId = crypto.randomUUID()
  const db      = c.env.DB

  await db.prepare(
    `INSERT INTO player_skills (id, campaign_id, player_id, skill, level)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (player_id, skill) DO UPDATE SET level = excluded.level`
  ).bind(skillId, campaign_id, player_id, skill.trim(), level).run()

  const row = await db.prepare(
    `SELECT id, skill, level FROM player_skills WHERE player_id = ? AND skill = ?`
  ).bind(player_id, skill.trim()).first()

  return c.json({ data: row })
})

// ── GET /api/reports/skills — player self-service skill list ─────────────────
app.get('/skills', requireAuth, async (c) => {
  const session = c.var.session
  const { campaign_id, player_id } = c.req.query()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (player_id   !== session.player_id)   return c.json({ error: 'Forbidden' }, 403)

  const { results } = await c.env.DB.prepare(
    `SELECT id, skill, level FROM player_skills WHERE campaign_id = ? AND player_id = ? ORDER BY skill`
  ).bind(campaign_id, player_id).all()

  return c.json({ data: results ?? [] })
})

// ── DELETE /api/reports/skills/:id — player deletes own skill ────────────────
app.delete('/skills/:id', requireAuth, async (c) => {
  const session  = c.var.session
  const { id }   = c.req.param()

  const row = await c.env.DB.prepare(
    `SELECT player_id FROM player_skills WHERE id = ?`
  ).bind(id).first()

  if (!row)                              return c.json({ error: 'Skill not found' }, 404)
  if (row.player_id !== session.player_id) return c.json({ error: 'Forbidden' }, 403)

  await c.env.DB.prepare(`DELETE FROM player_skills WHERE id = ?`).bind(id).run()
  return c.json({ data: { ok: true } })
})

export default app
