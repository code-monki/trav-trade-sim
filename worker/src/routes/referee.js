import { Hono } from 'hono'
import { requireAuth, requireReferee } from '../middleware/auth.js'

const app = new Hono()

// ── GET /api/referee/ships — ships with embedded active crew ──────────────────
app.get('/ships', requireReferee, async (c) => {
  const session     = c.var.session
  const campaignId  = session.campaign_id
  const db          = c.env.DB

  const [{ results: shipRows }, { results: crewRows }] = await Promise.all([
    db.prepare(`SELECT * FROM ships WHERE campaign_id = ? ORDER BY name`).bind(campaignId).all(),
    db.prepare(
      `SELECT c.id, c.ship_id, c.role, c.can_trade, c.has_stateroom, c.joined_tick,
              p.id as player_id, p.character_name, p.role as player_role
       FROM crew c
       JOIN players p ON p.id = c.player_id
       WHERE c.campaign_id = ? AND c.left_tick IS NULL`
    ).bind(campaignId).all(),
  ])

  const ships = (shipRows ?? []).map(s => ({
    ...s,
    crew: (crewRows ?? [])
      .filter(c => c.ship_id === s.id)
      .map(c => ({
        id: c.id, ship_id: c.ship_id, role: c.role,
        can_trade: c.can_trade === 1, has_stateroom: c.has_stateroom === 1,
        joined_tick: c.joined_tick,
        players: { id: c.player_id, character_name: c.character_name, role: c.player_role },
      })),
  }))

  return c.json({ data: ships })
})

// ── POST /api/referee/ships — create ship (no crew assignment) ────────────────
app.post('/ships', requireReferee, async (c) => {
  const session = c.var.session
  const { name, hull_type, hull_tons, cargo_capacity, credits, jump_rating,
          maneuver_drive_rating, fuel_capacity, fuel_current } = await c.req.json()

  const shipId = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO ships (id, campaign_id, name, hull_type, hull_tons, cargo_capacity,
                        credits, jump_rating, maneuver_drive_rating, fuel_capacity, fuel_current)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(shipId, session.campaign_id, name.trim(), hull_type || null,
         hull_tons ?? 200, cargo_capacity ?? 80, credits ?? 0,
         jump_rating || null, maneuver_drive_rating || null,
         fuel_capacity ?? 0, fuel_current ?? 0).run()

  const ship = await c.env.DB.prepare(`SELECT * FROM ships WHERE id = ?`).bind(shipId).first()
  return c.json({ data: { ...ship, crew: [] } }, 201)
})

// ── PATCH /api/referee/ships/:id — update ship ────────────────────────────────
app.patch('/ships/:id', requireReferee, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const fields  = await c.req.json()

  const db   = c.env.DB
  const ship = await db.prepare(`SELECT campaign_id FROM ships WHERE id = ?`).bind(id).first()
  if (!ship)                                    return c.json({ error: 'Ship not found' }, 404)
  if (ship.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const allowed = ['name', 'hull_type', 'hull_tons', 'cargo_capacity', 'credits',
                   'current_world', 'current_sector', 'jump_rating', 'maneuver_drive_rating',
                   'stateroom_capacity', 'low_berth_capacity', 'fuel_capacity', 'fuel_current']
  const setClauses = []
  const values     = []
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) { setClauses.push(`${k} = ?`); values.push(v) }
  }
  if (!setClauses.length) return c.json({ error: 'No valid fields' }, 400)

  values.push(id)
  await db.prepare(`UPDATE ships SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run()
  const updated = await db.prepare(`SELECT * FROM ships WHERE id = ?`).bind(id).first()
  return c.json({ data: updated })
})

// ── POST /api/referee/crew — assign crew member ───────────────────────────────
app.post('/crew', requireReferee, async (c) => {
  const session = c.var.session
  const { ship_id, player_id, role, current_tick } = await c.req.json()

  const crewId = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO crew (id, campaign_id, ship_id, player_id, role, can_trade, joined_tick)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(crewId, session.campaign_id, ship_id, player_id, role, role === 'captain' ? 1 : 0, current_tick ?? 0).run()

  const row = await c.env.DB.prepare(
    `SELECT c.id, c.ship_id, c.role, c.can_trade, c.has_stateroom, c.joined_tick,
            p.id as player_id, p.character_name, p.role as player_role
     FROM crew c JOIN players p ON p.id = c.player_id WHERE c.id = ?`
  ).bind(crewId).first()

  return c.json({
    data: {
      id: row.id, ship_id: row.ship_id, role: row.role,
      can_trade: row.can_trade === 1, has_stateroom: row.has_stateroom === 1,
      joined_tick: row.joined_tick,
      players: { id: row.player_id, character_name: row.character_name, role: row.player_role },
    }
  }, 201)
})

// ── PATCH /api/referee/crew/:id — update crew row (role, can_trade, left_tick) ─
app.patch('/crew/:id', requireReferee, async (c) => {
  const { id }  = c.req.param()
  const fields  = await c.req.json()
  const allowed = ['role', 'can_trade', 'has_stateroom', 'left_tick']
  const setClauses = []
  const values     = []
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) { setClauses.push(`${k} = ?`); values.push(v) }
  }
  if (!setClauses.length) return c.json({ error: 'No valid fields' }, 400)

  values.push(id)
  await c.env.DB.prepare(`UPDATE crew SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run()
  return c.json({ data: { ok: true } })
})

// ── GET /api/referee/players — players with skills + ship name ────────────────
app.get('/players', requireReferee, async (c) => {
  const session    = c.var.session
  const campaignId = session.campaign_id
  const db         = c.env.DB

  const [{ results: playerRows }, { results: skillRows }, { results: crewRows }] = await Promise.all([
    db.prepare(`SELECT id, character_name, role, credits FROM players WHERE campaign_id = ? ORDER BY character_name`).bind(campaignId).all(),
    db.prepare(`SELECT id, player_id, skill, level FROM player_skills WHERE campaign_id = ?`).bind(campaignId).all(),
    db.prepare(
      `SELECT c.player_id, s.name as ship_name FROM crew c
       JOIN ships s ON s.id = c.ship_id
       WHERE c.campaign_id = ? AND c.left_tick IS NULL`
    ).bind(campaignId).all(),
  ])

  const crewMap  = Object.fromEntries((crewRows ?? []).map(r => [r.player_id, r.ship_name]))
  const skillMap = {}
  for (const s of skillRows ?? []) {
    if (!skillMap[s.player_id]) skillMap[s.player_id] = []
    skillMap[s.player_id].push(s)
  }

  const players = (playerRows ?? []).map(p => ({
    ...p,
    current_ship: crewMap[p.id] ?? '',
    skills: skillMap[p.id] ?? [],
  }))

  return c.json({ data: players })
})

// ── POST /api/referee/skills — upsert a skill ─────────────────────────────────
app.post('/skills', requireReferee, async (c) => {
  const session = c.var.session
  const { player_id, skill, level } = await c.req.json()

  const db       = c.env.DB
  const skillId  = crypto.randomUUID()
  await db.prepare(
    `INSERT INTO player_skills (id, campaign_id, player_id, skill, level)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (player_id, skill) DO UPDATE SET level = excluded.level`
  ).bind(skillId, session.campaign_id, player_id, skill.trim(), level).run()

  const row = await db.prepare(
    `SELECT id, skill, level FROM player_skills WHERE player_id = ? AND skill = ?`
  ).bind(player_id, skill.trim()).first()

  return c.json({ data: row })
})

// ── DELETE /api/referee/skills/:id ────────────────────────────────────────────
app.delete('/skills/:id', requireReferee, async (c) => {
  const { id } = c.req.param()
  await c.env.DB.prepare(`DELETE FROM player_skills WHERE id = ?`).bind(id).run()
  return c.json({ data: { ok: true } })
})

// ── POST /api/referee/ships/:id/refund-passenger — referee-side refund ────────
app.post('/ships/:id/refund-passenger', requireReferee, async (c) => {
  const session    = c.var.session
  const { id }     = c.req.param()
  const { manifest_id, tick, campaign_id, player_id } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const db       = c.env.DB
  const manifest = await db.prepare(`SELECT * FROM passenger_manifests WHERE id = ?`).bind(manifest_id).first()
  if (!manifest) return c.json({ error: 'Manifest not found' }, 404)

  await db.batch([
    db.prepare(`UPDATE passenger_manifests SET status = 'refunded', resolve_tick = ? WHERE id = ?`).bind(tick, manifest_id),
    db.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, total_cr, world_hex, sector, notes)
                VALUES (?, ?, ?, ?, ?, 'passenger_refund', ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), campaign_id, player_id, id, tick, -manifest.fare_total,
            manifest.embark_world_hex, manifest.embark_sector,
            `Refund: ${manifest.count}× ${manifest.passage_type}`),
    db.prepare(`UPDATE ships SET credits = credits - ? WHERE id = ?`).bind(manifest.fare_total, id),
  ])

  return c.json({ data: { ok: true } })
})

// ── POST /api/referee/ships/:id/auto-deliver — deliver passengers + mail on world change ──
app.post('/ships/:id/auto-deliver', requireReferee, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { world_hex, sector, tick, campaign_id, player_id } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const db = c.env.DB

  const { results: passengers } = await db.prepare(
    `SELECT * FROM passenger_manifests WHERE ship_id = ? AND campaign_id = ? AND status = 'in_transit'
     AND dest_world_hex = ? AND dest_sector = ?`
  ).bind(id, campaign_id, world_hex, sector).all()

  const { results: mail } = await db.prepare(
    `SELECT * FROM mail_contracts WHERE ship_id = ? AND campaign_id = ? AND status = 'in_transit'
     AND dest_world_hex = ? AND dest_sector = ?`
  ).bind(id, campaign_id, world_hex, sector).all()

  if (!passengers?.length && !mail?.length) return c.json({ data: { ok: true } })

  const stmts = [
    ...(passengers ?? []).map(p =>
      db.prepare(`UPDATE passenger_manifests SET status = 'delivered', resolve_tick = ? WHERE id = ?`).bind(tick, p.id)
    ),
    ...(passengers ?? []).map(p =>
      db.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, total_cr, world_hex, sector, notes)
                  VALUES (?, ?, ?, ?, ?, 'passenger_fare', 0, ?, ?, ?)`)
        .bind(crypto.randomUUID(), campaign_id, p.player_id, id, tick, world_hex, sector,
              `Delivered: ${p.count}× ${p.passage_type} from ${p.embark_world_name || p.embark_world_hex}`)
    ),
    ...(mail ?? []).map(m =>
      db.prepare(`UPDATE mail_contracts SET status = 'delivered', resolve_tick = ? WHERE id = ?`).bind(tick, m.id)
    ),
    ...(mail ?? []).map(m =>
      db.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, total_cr, world_hex, sector, notes)
                  VALUES (?, ?, ?, ?, ?, 'mail', ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), campaign_id, player_id, id, tick, m.payment, world_hex, sector,
              `Mail delivered from ${m.origin_world_name || m.origin_world_hex}`)
    ),
  ]

  const totalMailPayment = (mail ?? []).reduce((s, m) => s + m.payment, 0)
  if (totalMailPayment > 0) {
    stmts.push(db.prepare(`UPDATE ships SET credits = credits + ? WHERE id = ?`).bind(totalMailPayment, id))
  }

  await db.batch(stmts)
  return c.json({ data: { ok: true, passengers_delivered: passengers?.length ?? 0, mail_delivered: mail?.length ?? 0 } })
})

export default app
