import { Hono } from 'hono'
import { requireAuth, requireReferee } from '../middleware/auth.js'

const app = new Hono()

// ── GET /api/campaigns/:id/events ─────────────────────────────────────────────
// ?active=true   — only events where expires_tick IS NULL OR expires_tick > currentTick
// ?world_hex=X&sector=Y — world-specific + subsector events (for history panel)
app.get('/:id/events', requireAuth, async (c) => {
  const session   = c.var.session
  const { id }    = c.req.param()
  const { active, world_hex, sector, current_tick } = c.req.query()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const db = c.env.DB
  let sql    = `SELECT * FROM market_events WHERE campaign_id = ?`
  const args = [id]

  if (active === 'true' && current_tick != null) {
    sql += ` AND (expires_tick IS NULL OR expires_tick > ?)`
    args.push(Number(current_tick))
  }

  if (world_hex && sector) {
    sql += ` AND sector = ? AND (world_hex = ? OR scope = 'subsector')`
    args.push(sector, world_hex)
  }

  sql += ` ORDER BY tick DESC LIMIT 200`

  const { results } = await db.prepare(sql).bind(...args).all()
  return c.json({ data: results ?? [] })
})

// ── POST /api/campaigns/:id/events ────────────────────────────────────────────
app.post('/:id/events', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const body = await c.req.json()

  // Duplicate check: used by maybeInsertEvent (tick, world_hex, campaign)
  if (body.check_duplicate) {
    const row = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM market_events WHERE campaign_id = ? AND tick = ? AND world_hex = ?`
    ).bind(id, body.tick, body.world_hex ?? '').first()
    return c.json({ data: { count: row?.cnt ?? 0 } })
  }

  const eventId = crypto.randomUUID()
  const { world_hex, sector, scope, trade_good_die, buy_modifier_pct, sell_modifier_pct, description, expires_tick, severity, tick } = body

  await c.env.DB.prepare(
    `INSERT INTO market_events
       (id, campaign_id, tick, scope, world_hex, sector, trade_good_die,
        buy_modifier_pct, sell_modifier_pct, description, expires_tick, severity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(eventId, id, tick, scope ?? 'local', world_hex ?? null, sector ?? null,
         trade_good_die ?? null, buy_modifier_pct ?? null, sell_modifier_pct ?? null,
         description, expires_tick ?? null, severity ?? 'minor').run()

  const row = await c.env.DB.prepare(`SELECT * FROM market_events WHERE id = ?`).bind(eventId).first()
  return c.json({ data: row }, 201)
})

// ── PATCH /api/events/:eventId/expire (referee only) ─────────────────────────
app.patch('/event/:eventId/expire', requireReferee, async (c) => {
  const { eventId }  = c.req.param()
  const { current_tick } = await c.req.json()

  await c.env.DB.prepare(
    `UPDATE market_events SET expires_tick = ? WHERE id = ?`
  ).bind(current_tick, eventId).run()

  return c.json({ data: { ok: true } })
})

// ── GET /api/campaigns/:id/snapshots ──────────────────────────────────────────
// ?world_hex=X&sector=Y&tick=N&count=true
app.get('/:id/snapshots', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { world_hex, sector, tick, count } = c.req.query()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const db = c.env.DB

  if (count === 'true') {
    const row = await db.prepare(
      `SELECT COUNT(*) as cnt FROM market_snapshots
       WHERE campaign_id = ? AND world_hex = ? AND sector = ? AND tick = ?`
    ).bind(id, world_hex, sector, Number(tick)).first()
    return c.json({ data: { count: row?.cnt ?? 0 } })
  }

  const { results } = await db.prepare(
    `SELECT * FROM market_snapshots
     WHERE campaign_id = ? AND world_hex = ? AND sector = ? AND tick = ?
     ORDER BY trade_good_die`
  ).bind(id, world_hex, sector, Number(tick)).all()

  return c.json({ data: results ?? [] })
})

// ── GET /api/campaigns/:id/snapshots/last-tick ────────────────────────────────
// Last recorded snapshot tick for a world, or null if never visited — used to
// determine how far back a gap-fill backfill needs to run.
app.get('/:id/snapshots/last-tick', requireAuth, async (c) => {
  const session             = c.var.session
  const { id }              = c.req.param()
  const { world_hex, sector } = c.req.query()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const row = await c.env.DB.prepare(
    `SELECT MAX(tick) as lastTick FROM market_snapshots WHERE campaign_id = ? AND world_hex = ? AND sector = ?`
  ).bind(id, world_hex, sector).first()

  return c.json({ data: { lastTick: row?.lastTick ?? null } })
})

// ── POST /api/campaigns/:id/snapshots — batch insert ─────────────────────────
app.post('/:id/snapshots', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const { rows } = await c.req.json()
  if (!Array.isArray(rows) || !rows.length) return c.json({ error: 'rows array required' }, 400)

  const db = c.env.DB
  const stmts = rows.map(r => db.prepare(
    `INSERT OR IGNORE INTO market_snapshots
       (id, campaign_id, world_hex, sector, trade_good_die, trade_good_name,
        tick, purchase_price, sale_price, qty_available, source_codes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    r.id ?? crypto.randomUUID(), r.campaign_id, r.world_hex, r.sector,
    r.trade_good_die, r.trade_good_name, r.tick,
    r.purchase_price, r.sale_price, r.qty_available, r.source_codes ?? ''
  ))

  await db.batch(stmts)
  return c.json({ data: { count: rows.length } }, 201)
})

// ── GET /api/campaigns/:id/market/weekly ──────────────────────────────────────
app.get('/:id/market/weekly', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { world_hex, sector, good_die, limit = '52' } = c.req.query()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const { results } = await c.env.DB.prepare(
    `SELECT tick, purchase_price, sale_price, qty_available
     FROM market_snapshots
     WHERE campaign_id = ? AND world_hex = ? AND sector = ? AND trade_good_die = ?
     ORDER BY tick DESC LIMIT ?`
  ).bind(id, world_hex, sector, good_die, Number(limit)).all()

  return c.json({ data: (results ?? []).reverse() })
})

// ── GET /api/campaigns/:id/market/monthly ─────────────────────────────────────
app.get('/:id/market/monthly', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { world_hex, sector, good_die, limit = '24' } = c.req.query()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const { results } = await c.env.DB.prepare(
    `SELECT year, month, open_price, high_price, low_price, close_price, volume_tons
     FROM market_monthly
     WHERE campaign_id = ? AND world_hex = ? AND sector = ? AND trade_good_die = ?
     ORDER BY year DESC, month DESC LIMIT ?`
  ).bind(id, world_hex, sector, good_die, Number(limit)).all()

  return c.json({ data: (results ?? []).reverse() })
})

// ── GET /api/campaigns/:id/market/realized ────────────────────────────────────
app.get('/:id/market/realized', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { world_hex, sector, good_die } = c.req.query()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const { results } = await c.env.DB.prepare(
    `SELECT year, month, open_price, high_price, low_price, close_price, volume_tons, trade_count
     FROM realized_ohlcv
     WHERE campaign_id = ? AND world_hex = ? AND sector = ? AND trade_good_die = ?
     ORDER BY year, month`
  ).bind(id, world_hex, sector, good_die).all()

  return c.json({ data: results ?? [] })
})

// ── GET /api/campaigns/:id/market/annual ──────────────────────────────────────
app.get('/:id/market/annual', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { world_hex, sector, good_die } = c.req.query()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const { results } = await c.env.DB.prepare(
    `SELECT year, open_price, high_price, low_price, close_price, volume_tons
     FROM market_annual
     WHERE campaign_id = ? AND world_hex = ? AND sector = ? AND trade_good_die = ?
     ORDER BY year`
  ).bind(id, world_hex, sector, good_die).all()

  return c.json({ data: results ?? [] })
})

export default app
