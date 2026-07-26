import { Hono } from 'hono'
import { requireAuth, requireReferee } from '../middleware/auth.js'

const app = new Hono()

// ── GET /api/campaigns/:id/events ─────────────────────────────────────────────
// ?active=true   — only events where expires_tick IS NULL OR expires_tick > currentTick
// ?world_hex=X&sector=Y — world-specific + subsector events (for history panel)
app.get('/:id/events', requireAuth, async (c) => {
  const session   = c.var.session
  const { id }    = c.req.param()
  const { active, world_hex, sector, current_tick, source } = c.req.query()
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

  if (source) {
    sql += ` AND source = ?`
    args.push(source)
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
  const { world_hex, sector, scope, trade_good_die, buy_modifier_pct, sell_modifier_pct, description, expires_tick, severity, tick, source } = body

  await c.env.DB.prepare(
    `INSERT INTO market_events
       (id, campaign_id, tick, scope, world_hex, sector, trade_good_die,
        buy_modifier_pct, sell_modifier_pct, description, expires_tick, severity, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(eventId, id, tick, scope ?? 'local', world_hex ?? null, sector ?? null,
         trade_good_die ?? null, buy_modifier_pct ?? null, sell_modifier_pct ?? null,
         description, expires_tick ?? null, severity ?? 'minor', source ?? 'auto').run()

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

// ── DELETE /api/campaigns/event/:eventId (referee only) ───────────────────────
// Safe as a plain delete regardless of history — an assigned event's fields
// are a one-time copy at creation (no lasting FK from market_events back to
// event_definitions), and price snapshots bake an event's effect into a
// number at generation time rather than holding a live reference to the row.
app.delete('/event/:eventId', requireReferee, async (c) => {
  const { eventId } = c.req.param()
  await c.env.DB.prepare(`DELETE FROM market_events WHERE id = ?`).bind(eventId).run()
  return c.json({ data: { ok: true } })
})

// ── GET /api/campaigns/:id/event-definitions ──────────────────────────────────
// requireAuth (not requireReferee): the deterministic per-tick auto-generator
// (maybeGenerateEvent) needs the same definitions pool regardless of which
// campaign member's client happens to trigger it.
app.get('/:id/event-definitions', requireAuth, async (c) => {
  const session = c.var.session
  const { id }   = c.req.param()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM event_definitions WHERE campaign_id = ? ORDER BY description`
  ).bind(id).all()
  return c.json({ data: results ?? [] })
})

// ── POST /api/campaigns/:id/event-definitions — create a custom definition ───
app.post('/:id/event-definitions', requireReferee, async (c) => {
  const session = c.var.session
  const { id }   = c.req.param()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const { description, scope, severity, buy_modifier_pct, sell_modifier_pct,
          duration_ticks, trade_good_die } = await c.req.json()

  const db = c.env.DB
  const taken = await db.prepare(
    `SELECT id FROM event_definitions WHERE campaign_id = ? AND description = ?`
  ).bind(id, description.trim()).first()
  if (taken) return c.json({ error: 'A definition with this description already exists' }, 409)

  const defId = crypto.randomUUID()
  await db.prepare(
    `INSERT INTO event_definitions
       (id, campaign_id, description, scope, severity, buy_modifier_pct,
        sell_modifier_pct, duration_ticks, trade_good_die)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(defId, id, description.trim(), scope ?? 'local', severity ?? 'minor',
         buy_modifier_pct ?? null, sell_modifier_pct ?? null,
         duration_ticks ?? 4, trade_good_die ?? null).run()

  const row = await db.prepare(`SELECT * FROM event_definitions WHERE id = ?`).bind(defId).first()
  return c.json({ data: row }, 201)
})

// ── PATCH /api/campaigns/event-definitions/:defId — edit a definition ────────
app.patch('/event-definitions/:defId', requireReferee, async (c) => {
  const session = c.var.session
  const { defId } = c.req.param()
  const fields    = await c.req.json()

  const db  = c.env.DB
  const def = await db.prepare(`SELECT campaign_id FROM event_definitions WHERE id = ?`).bind(defId).first()
  if (!def)                                    return c.json({ error: 'Definition not found' }, 404)
  if (def.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  if (fields.description) {
    const taken = await db.prepare(
      `SELECT id FROM event_definitions WHERE campaign_id = ? AND description = ? AND id != ?`
    ).bind(session.campaign_id, fields.description.trim(), defId).first()
    if (taken) return c.json({ error: 'A definition with this description already exists' }, 409)
  }

  const allowed = ['description', 'scope', 'severity', 'buy_modifier_pct',
                   'sell_modifier_pct', 'duration_ticks', 'trade_good_die']
  const setClauses = []
  const values     = []
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) { setClauses.push(`${k} = ?`); values.push(v) }
  }
  if (!setClauses.length) return c.json({ error: 'No valid fields' }, 400)

  values.push(defId)
  await db.prepare(`UPDATE event_definitions SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run()
  const updated = await db.prepare(`SELECT * FROM event_definitions WHERE id = ?`).bind(defId).first()
  return c.json({ data: updated })
})

// ── DELETE /api/campaigns/event-definitions/:defId ────────────────────────────
app.delete('/event-definitions/:defId', requireReferee, async (c) => {
  const session   = c.var.session
  const { defId } = c.req.param()

  const db  = c.env.DB
  const def = await db.prepare(`SELECT campaign_id FROM event_definitions WHERE id = ?`).bind(defId).first()
  if (!def)                                    return c.json({ error: 'Definition not found' }, 404)
  if (def.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  await db.prepare(`DELETE FROM event_definitions WHERE id = ?`).bind(defId).run()
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

// ── GET /api/campaigns/:id/traffic — MgT2022 passenger/freight/mail scarcity ──
// ?world_hex=X&sector=Y&tick=N — returns the row for this world/tick, or
// all-zero defaults if MgT2022 hasn't generated one yet (e.g. tick 0).
// CT7/T5 campaigns never call this route.
app.get('/:id/traffic', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { world_hex, sector, tick, ship_id } = c.req.query()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const row = await c.env.DB.prepare(
    `SELECT * FROM traffic_snapshots
     WHERE campaign_id = ? AND ship_id = ? AND world_hex = ? AND sector = ? AND tick = ?`
  ).bind(id, ship_id, world_hex, sector, Number(tick)).first()

  return c.json({
    data: row ?? {
      high_passages: 0, middle_passages: 0, basic_passages: 0, low_passages: 0,
      major_freight_lots: 0, minor_freight_lots: 0, incidental_freight_lots: 0,
      mail_containers: 0,
    },
  })
})

// ── POST /api/campaigns/:id/traffic — insert one tick's traffic snapshot ─────
app.post('/:id/traffic', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const r = await c.req.json()

  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO traffic_snapshots
       (campaign_id, ship_id, world_hex, sector, tick, high_passages, middle_passages,
        basic_passages, low_passages, major_freight_lots, minor_freight_lots,
        incidental_freight_lots, mail_containers)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, r.ship_id, r.world_hex, r.sector, r.tick,
    r.high_passages, r.middle_passages, r.basic_passages, r.low_passages,
    r.major_freight_lots, r.minor_freight_lots, r.incidental_freight_lots,
    r.mail_containers
  ).run()

  return c.json({ data: { ok: true } }, 201)
})

// ── Find a Supplier (MgT2022) ──────────────────────────────────────────────────
// Character-based, one-click check gating whether a player can see a
// world's market this month — not an ambient world property. Plain
// (non-seeded) dice: this is a one-shot player action, not a value that
// needs to be reproducible on replay the way market snapshots are.

function twoD6() { return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1 }

// ── GET /:id/find-supplier — has this player already found a supplier
// at this world this month? (gates the market view without re-rolling) ───────
app.get('/:id/find-supplier', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { player_id, world_hex, sector, month_key } = c.req.query()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const row = await c.env.DB.prepare(
    `SELECT attempts, succeeded FROM supplier_search_attempts
     WHERE player_id = ? AND world_hex = ? AND sector = ? AND month_key = ?`
  ).bind(player_id, world_hex, sector, Number(month_key)).first()

  return c.json({ data: { attempts: row?.attempts ?? 0, succeeded: !!row?.succeeded } })
})

// ── POST /:id/find-supplier — attempt the check ───────────────────────────────
app.post('/:id/find-supplier', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { player_id, world_hex, sector, month_key, skill_level, starport_dm } = await c.req.json()
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const db  = c.env.DB
  const existing = await db.prepare(
    `SELECT attempts, succeeded FROM supplier_search_attempts
     WHERE player_id = ? AND world_hex = ? AND sector = ? AND month_key = ?`
  ).bind(player_id, world_hex, sector, month_key).first()

  if (existing?.succeeded) {
    return c.json({ data: { success: true, alreadySucceeded: true, attempts: existing.attempts } })
  }

  const previousAttempts = existing?.attempts ?? 0
  const total   = twoD6() + (skill_level ?? 0) + (starport_dm ?? 0) - previousAttempts
  const success = total >= 8

  await db.prepare(
    `INSERT INTO supplier_search_attempts (id, campaign_id, player_id, world_hex, sector, month_key, attempts, succeeded)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT (player_id, world_hex, sector, month_key)
     DO UPDATE SET attempts = attempts + 1, succeeded = MAX(succeeded, excluded.succeeded), updated_at = datetime('now')`
  ).bind(crypto.randomUUID(), id, player_id, world_hex, sector, month_key, success ? 1 : 0).run()

  return c.json({ data: { success, total, attempts: previousAttempts + 1 } })
})

export default app
