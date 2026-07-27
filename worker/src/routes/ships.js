import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'

const app = new Hono()

// ── MgT2022 late-delivery penalty (deliberately self-contained — the worker
//    package doesn't share code with the frontend src/lib, same as every
//    other route file here; same seeded-RNG scheme and (1D+4)×10% formula as
//    src/lib/trade-engine-mgt2022.js's freightLatePenaltyPct, but rolls its
//    own die here since the route is the source of truth at delivery time) ─

function fnv1a(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

function makeRng(seedStr) {
  let s = fnv1a(seedStr)
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

function d6(rng) { return Math.floor(rng() * 6) + 1 }

// Late-delivery penalty: (1D + 4) × 10%, rolled deterministically per
// obligation at delivery time (never stored — see d1/010_mgt2022_trade_rules.sql).
function freightLatePenaltyPct(campaignId, obligationId) {
  const rng = makeRng(`${campaignId}:${obligationId}:late`)
  return (d6(rng) + 4) * 10
}

function freightNetAfterPenalty(charge, penaltyPct) {
  return Math.max(0, Math.round(charge * (1 - penaltyPct / 100)))
}

// Basic Passage (MgT2022) consumes general cargo tonnage instead of a
// dedicated stateroom/berth — kept in sync with src/lib/traveller-data-
// mgt2022.js's MGT2022_BASIC_PASSAGE_TONS constant of the same value (the
// worker doesn't share code with the frontend bundle, same as everywhere
// else in this file).
const MGT2022_BASIC_PASSAGE_TONS = 2

// Mail containers (MgT2022) reserve cargo tonnage the same way — kept in
// sync with src/lib/traveller-data-mgt2022.js's MGT2022_MAIL_CONTAINER_TONS.
const MGT2022_MAIL_CONTAINER_TONS = 5

// obligations rows aliased back to the passenger_manifests / mail_contracts /
// freight shapes the frontend already expects (see
// docs/financial-model-gap-analysis.md — "Commercial obligations" — for why
// all three kinds share one table).
const PASSENGER_SELECT = `
  SELECT id, campaign_id, ship_id, player_id, passage_type,
         passenger_count AS count,
         origin_world_hex AS embark_world_hex, origin_sector AS embark_sector,
         origin_world_name AS embark_world_name, accept_tick AS embark_tick,
         dest_world_hex, dest_sector, dest_world_name,
         fare_per_head, amount AS fare_total, status, resolve_tick, created_at
  FROM obligations`

const MAIL_SELECT = `
  SELECT id, campaign_id, ship_id, player_id,
         origin_world_hex, origin_sector, origin_world_name, accept_tick,
         dest_world_hex, dest_sector, dest_world_name,
         parsecs, amount AS payment, mail_containers, status, resolve_tick, created_at
  FROM obligations`

const FREIGHT_SELECT = `
  SELECT id, campaign_id, ship_id, player_id,
         origin_world_hex, origin_sector, origin_world_name, accept_tick,
         dest_world_hex, dest_sector, dest_world_name,
         parsecs, freight_tons, freight_lot_size, rate_per_ton, due_tick,
         amount AS charge, status, resolve_tick, created_at
  FROM obligations`

// ── GET /api/ships/current — player's active ship ─────────────────────────────
app.get('/current', requireAuth, async (c) => {
  const session                = c.var.session
  const { player_id, campaign_id } = c.req.query()

  // Caller must supply their own IDs; session enforces they match.
  if (player_id !== session.player_id) return c.json({ error: 'Forbidden' }, 403)
  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const db = c.env.DB
  const crew = await db.prepare(
    `SELECT c.role, c.can_trade, c.ship_id,
            s.id, s.name, s.hull_type, s.hull_tons, s.cargo_capacity,
            s.current_world, s.current_sector, s.credits,
            s.jump_rating, s.maneuver_drive_rating,
            s.stateroom_capacity, s.low_berth_capacity,
            s.fuel_capacity, s.fuel_current, s.market_value, s.armed
     FROM crew c
     JOIN ships s ON s.id = c.ship_id
     WHERE c.player_id = ? AND c.campaign_id = ? AND c.left_tick IS NULL
     LIMIT 1`
  ).bind(player_id, campaign_id).first()

  if (!crew) return c.json({ data: null })

  const ship = {
    id: crew.id, name: crew.name, hull_type: crew.hull_type,
    hull_tons: crew.hull_tons, cargo_capacity: crew.cargo_capacity,
    current_world: crew.current_world, current_sector: crew.current_sector,
    credits: crew.credits, jump_rating: crew.jump_rating,
    maneuver_drive_rating: crew.maneuver_drive_rating,
    stateroom_capacity: crew.stateroom_capacity,
    low_berth_capacity: crew.low_berth_capacity,
    fuel_capacity: crew.fuel_capacity, fuel_current: crew.fuel_current,
    market_value: crew.market_value, armed: crew.armed === 1,
    crew_role: crew.role, can_trade: crew.can_trade === 1,
  }

  const [
    { results: cargoRows }, { results: passengerRows }, { results: mailRows }, { results: freightRows },
    crewStateRow, stewardRow, passengerCheckRow, freightCheckRow, navalScoutRow, socRow, streetwiseRow,
  ] = await Promise.all([
    db.prepare(`SELECT * FROM cargo WHERE ship_id = ? AND campaign_id = ? ORDER BY created_at`).bind(ship.id, campaign_id).all(),
    db.prepare(PASSENGER_SELECT + ` WHERE kind = 'passenger' AND status = 'pending' AND ship_id = ? AND campaign_id = ? ORDER BY created_at`).bind(ship.id, campaign_id).all(),
    db.prepare(MAIL_SELECT + ` WHERE kind = 'mail' AND status = 'pending' AND ship_id = ? AND campaign_id = ? ORDER BY created_at`).bind(ship.id, campaign_id).all(),
    db.prepare(FREIGHT_SELECT + ` WHERE kind = 'freight' AND status = 'pending' AND ship_id = ? AND campaign_id = ? ORDER BY created_at`).bind(ship.id, campaign_id).all(),
    db.prepare(`SELECT COUNT(*) as cnt FROM crew WHERE ship_id = ? AND campaign_id = ? AND left_tick IS NULL AND has_stateroom = 1`).bind(ship.id, campaign_id).first(),
    // Traffic-availability crew DMs (MgT2022 "SEEKING PASSENGERS"/"FREIGHT"/"MAIL") —
    // computed here alongside crew_staterooms, same join shape.
    db.prepare(`SELECT MAX(ps.level) as mx FROM crew c JOIN player_skills ps ON ps.player_id = c.player_id AND ps.campaign_id = c.campaign_id
                WHERE c.ship_id = ? AND c.campaign_id = ? AND c.left_tick IS NULL AND ps.skill = 'Steward'`).bind(ship.id, campaign_id).first(),
    db.prepare(`SELECT MAX(ps.level) as mx FROM crew c JOIN player_skills ps ON ps.player_id = c.player_id AND ps.campaign_id = c.campaign_id
                WHERE c.ship_id = ? AND c.campaign_id = ? AND c.left_tick IS NULL AND ps.skill IN ('Broker','Carouse','Streetwise')`).bind(ship.id, campaign_id).first(),
    db.prepare(`SELECT MAX(ps.level) as mx FROM crew c JOIN player_skills ps ON ps.player_id = c.player_id AND ps.campaign_id = c.campaign_id
                WHERE c.ship_id = ? AND c.campaign_id = ? AND c.left_tick IS NULL AND ps.skill IN ('Broker','Streetwise')`).bind(ship.id, campaign_id).first(),
    db.prepare(`SELECT MAX(p.rank) as mx FROM crew c JOIN players p ON p.id = c.player_id
                WHERE c.ship_id = ? AND c.campaign_id = ? AND c.left_tick IS NULL AND LOWER(p.background) IN ('navy','scout')`).bind(ship.id, campaign_id).first(),
    db.prepare(`SELECT MAX(p.social_standing) as mx FROM crew c JOIN players p ON p.id = c.player_id
                WHERE c.ship_id = ? AND c.campaign_id = ? AND c.left_tick IS NULL`).bind(ship.id, campaign_id).first(),
    // Black Market's own check wants Streetwise alone, not pooled with
    // Broker/Carouse the way the normal passenger check is.
    db.prepare(`SELECT MAX(ps.level) as mx FROM crew c JOIN player_skills ps ON ps.player_id = c.player_id AND ps.campaign_id = c.campaign_id
                WHERE c.ship_id = ? AND c.campaign_id = ? AND c.left_tick IS NULL AND ps.skill = 'Streetwise'`).bind(ship.id, campaign_id).first(),
  ])

  ship.crew_staterooms             = crewStateRow?.cnt ?? 0
  ship.crew_steward_max            = stewardRow?.mx ?? 0
  ship.crew_passenger_check_max    = passengerCheckRow?.mx ?? 0
  ship.crew_freight_check_max      = freightCheckRow?.mx ?? 0
  ship.crew_naval_scout_rank_max   = navalScoutRow?.mx ?? 0
  ship.crew_social_standing_max    = socRow?.mx ?? null
  ship.crew_streetwise_max         = streetwiseRow?.mx ?? 0

  return c.json({ data: { ship, cargo: cargoRows ?? [], passengers: passengerRows ?? [], mailContracts: mailRows ?? [], freight: freightRows ?? [] } })
})

// ── POST /api/ships — create ship + crew assignment ───────────────────────────
app.post('/', requireAuth, async (c) => {
  const session = c.var.session
  const { campaign_id, player_id, name, hull_type, hull_tons, cargo_capacity, current_tick = 0 } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const db     = c.env.DB
  const shipId = crypto.randomUUID()
  const crewId = crypto.randomUUID()

  await db.batch([
    db.prepare(`INSERT INTO ships (id, campaign_id, name, hull_type, hull_tons, cargo_capacity) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(shipId, campaign_id, name, hull_type ?? null, hull_tons ?? 200, cargo_capacity ?? 80),
    db.prepare(`INSERT INTO crew (id, campaign_id, ship_id, player_id, role, can_trade, joined_tick) VALUES (?, ?, ?, ?, 'captain', 1, ?)`)
      .bind(crewId, campaign_id, shipId, player_id, current_tick),
  ])

  const ship = await db.prepare(`SELECT * FROM ships WHERE id = ?`).bind(shipId).first()
  return c.json({ data: { ...ship, crew_role: 'captain', can_trade: true } }, 201)
})

// ── PATCH /api/ships/:id — update ship fields ─────────────────────────────────
app.patch('/:id', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const fields  = await c.req.json()

  const db   = c.env.DB
  const ship = await db.prepare(`SELECT campaign_id FROM ships WHERE id = ?`).bind(id).first()
  if (!ship)                                 return c.json({ error: 'Ship not found' }, 404)
  if (ship.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  // Only allow safe fields to be patched
  const allowed = ['current_world', 'current_sector', 'credits', 'fuel_current',
                   'hull_type', 'hull_tons', 'cargo_capacity', 'jump_rating',
                   'maneuver_drive_rating', 'stateroom_capacity', 'low_berth_capacity',
                   'fuel_capacity', 'name']
  const setClauses = []
  const values     = []
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) { setClauses.push(`${k} = ?`); values.push(v) }
  }
  if (!setClauses.length) return c.json({ error: 'No valid fields to update' }, 400)

  values.push(id)
  await db.prepare(`UPDATE ships SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run()
  const updated = await db.prepare(`SELECT * FROM ships WHERE id = ?`).bind(id).first()
  return c.json({ data: updated })
})

// ── PATCH /api/ships/:id/credits — adjust credits by delta ───────────────────
app.patch('/:id/credits', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { delta } = await c.req.json()

  const db   = c.env.DB
  const ship = await db.prepare(`SELECT campaign_id, credits FROM ships WHERE id = ?`).bind(id).first()
  if (!ship)                                    return c.json({ error: 'Ship not found' }, 404)
  if (ship.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const newBalance = ship.credits + delta
  await db.prepare(`UPDATE ships SET credits = ? WHERE id = ?`).bind(newBalance, id).run()
  return c.json({ data: { credits: newBalance } })
})

// ── POST /api/ships/:id/buy-cargo — atomic: cargo + transaction + credits + qty ─
app.post('/:id/buy-cargo', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { campaign_id, player_id, good, tons, world_hex, world_name, sector, tick } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const db   = c.env.DB
  const ship = await db.prepare(`SELECT credits FROM ships WHERE id = ?`).bind(id).first()
  if (!ship) return c.json({ error: 'Ship not found' }, 404)

  const totalCost = good.purchase_price * tons
  if ((ship.credits ?? 0) < totalCost) return c.json({ error: 'Insufficient credits' }, 400)

  // Reserve the stock atomically: the WHERE clause's qty_available >= ?
  // makes this a check-and-decrement in one statement, run alone (not part
  // of the batch below) so we can inspect how many rows it actually
  // changed. Two concurrent buyers racing for the same lot's last tons
  // will have this guard evaluated against the true, sequentially
  // consistent value at each one's actual execution time — only one can
  // win once the remaining stock can't satisfy both. A prior separate
  // SELECT-then-batch-decrement here allowed both to pass a stale check.
  const reserve = await db.prepare(
    `UPDATE market_snapshots SET qty_available = qty_available - ?
     WHERE campaign_id = ? AND world_hex = ? AND sector = ? AND trade_good_die = ? AND tick = ?
       AND qty_available >= ?`
  ).bind(tons, campaign_id, world_hex, sector, good.trade_good_die, tick, tons).run()

  if (reserve.meta.changes === 0) {
    const snapshot = await db.prepare(
      `SELECT qty_available FROM market_snapshots
       WHERE campaign_id = ? AND world_hex = ? AND sector = ? AND trade_good_die = ? AND tick = ?`
    ).bind(campaign_id, world_hex, sector, good.trade_good_die, tick).first()
    if (!snapshot) return c.json({ error: 'Market snapshot not found for this tick' }, 400)
    return c.json({ error: `Only ${snapshot.qty_available}t available at this price` }, 400)
  }

  const cargoId = crypto.randomUUID()
  await db.batch([
    db.prepare(`INSERT INTO cargo (id, campaign_id, player_id, ship_id, trade_good_die, trade_good_name, tons, purchase_price, purchased_tick, purchase_world, purchase_world_name, purchase_sector)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(cargoId, campaign_id, player_id, id, good.trade_good_die, good.trade_good_name, tons, good.purchase_price, tick, world_hex, world_name ?? '', sector),
    db.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, trade_good_die, trade_good_name, tons, price_per_ton, total_cr, world_hex, sector)
                VALUES (?, ?, ?, ?, ?, 'buy', ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), campaign_id, player_id, id, tick, good.trade_good_die, good.trade_good_name, tons, good.purchase_price, -totalCost, world_hex, sector),
    db.prepare(`UPDATE ships SET credits = credits - ? WHERE id = ?`).bind(totalCost, id),
  ])

  const cargoRow = await db.prepare(`SELECT * FROM cargo WHERE id = ?`).bind(cargoId).first()
  return c.json({ data: cargoRow }, 201)
})

// ── POST /api/ships/:id/sell-cargo — atomic: delete cargo + transaction + trade_record + credits ──
app.post('/:id/sell-cargo', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { campaign_id, cargo_item, sell_price_per_ton, market_world_hex, market_sector, tick, trade_rules, broker_fee_total = 0 } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const totalRevenue = sell_price_per_ton * cargo_item.tons
  const totalCost    = cargo_item.purchase_price * cargo_item.tons
  const netCredited  = totalRevenue - broker_fee_total
  const netProfit    = totalRevenue - totalCost - broker_fee_total

  const stmts = [
    c.env.DB.prepare(`DELETE FROM cargo WHERE id = ?`).bind(cargo_item.id),
    c.env.DB.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, trade_good_die, trade_good_name, tons, price_per_ton, total_cr, world_hex, sector)
                      VALUES (?, ?, ?, ?, ?, 'sell', ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), campaign_id, cargo_item.player_id, id, tick, cargo_item.trade_good_die, cargo_item.trade_good_name, cargo_item.tons, sell_price_per_ton, totalRevenue, market_world_hex, market_sector),
    c.env.DB.prepare(`INSERT INTO trade_records (id, campaign_id, player_id, ship_id, trade_rules, trade_good_die, trade_good_name, tons, source_world_hex, source_sector, purchase_tick, buy_price_per_ton, total_cost, market_world_hex, market_sector, sell_tick, trade_price_per_ton, sell_price_per_ton, total_revenue, net_profit)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), campaign_id, cargo_item.player_id, id, trade_rules, cargo_item.trade_good_die, cargo_item.trade_good_name, cargo_item.tons, cargo_item.purchase_world, cargo_item.purchase_sector, cargo_item.purchased_tick, cargo_item.purchase_price, totalCost, market_world_hex, market_sector, tick, sell_price_per_ton, sell_price_per_ton, totalRevenue, netProfit),
    c.env.DB.prepare(`UPDATE ships SET credits = credits + ? WHERE id = ?`).bind(netCredited, id),
  ]

  // CT7-only Broker commission — a lump deduction from this sale's proceeds,
  // separate from the per-ton price (which already carries the Broker DM
  // bonus). Recorded as its own 'fee' transaction (the generic type
  // src/lib/reports.js's TYPE_LABEL/EXPENSE_TYPES already render/total)
  // rather than folded silently into the 'sell' row, so it's visible in
  // Reports/ledger like any other deduction.
  if (broker_fee_total > 0) {
    stmts.push(
      c.env.DB.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, total_cr, world_hex, sector, notes)
                        VALUES (?, ?, ?, ?, ?, 'fee', ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), campaign_id, cargo_item.player_id, id, tick, -broker_fee_total, market_world_hex, market_sector,
              `Broker fee on ${cargo_item.trade_good_name} sale`)
    )
  }

  await c.env.DB.batch(stmts)

  return c.json({ data: { ok: true, net_profit: netProfit } })
})

// ── POST /api/ships/:id/book-passengers — atomic: manifest + transaction + credits ──
app.post('/:id/book-passengers', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const body    = await c.req.json()
  const { campaign_id, player_id, passage_type, count, embark_world_hex, embark_sector, embark_world_name,
          dest_world_hex, dest_sector, dest_world_name, fare_per_head, fare_total, tick } = body

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const db   = c.env.DB
  const ship = await db.prepare(`SELECT stateroom_capacity, low_berth_capacity, cargo_capacity FROM ships WHERE id = ?`).bind(id).first()
  if (!ship) return c.json({ error: 'Ship not found' }, 404)

  const [crewStateRow, cargoRow, pendingResult, trafficRow] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as cnt FROM crew WHERE ship_id = ? AND campaign_id = ? AND left_tick IS NULL AND has_stateroom = 1`).bind(id, campaign_id).first(),
    db.prepare(`SELECT COALESCE(SUM(tons), 0) as tons FROM cargo WHERE ship_id = ? AND campaign_id = ?`).bind(id, campaign_id).first(),
    db.prepare(`SELECT passage_type, COALESCE(SUM(passenger_count), 0) as cnt FROM obligations
                WHERE ship_id = ? AND campaign_id = ? AND kind = 'passenger' AND status = 'pending' GROUP BY passage_type`).bind(id, campaign_id).all(),
    db.prepare(`SELECT high_passages, middle_passages, basic_passages, low_passages FROM traffic_snapshots
                WHERE campaign_id = ? AND ship_id = ? AND world_hex = ? AND sector = ? AND dest_world_hex = ? AND dest_sector = ? AND tick = ?`)
      .bind(campaign_id, id, embark_world_hex, embark_sector, dest_world_hex, dest_sector, tick).first(),
  ])

  const pendingByType = {}
  for (const row of pendingResult.results ?? []) pendingByType[row.passage_type] = row.cnt

  // Stateroom/low-berth/cargo capacity — validates nothing today, not even
  // these pre-existing caps. Deliberately excludes Basic from the
  // stateroom count (correctly, per passageCapacityNeeded() — Basic uses
  // cargo tons instead) rather than mirroring the client's own known
  // stateroomsUsed bug (logged separately), since this is new server code.
  if (passage_type === 'high' || passage_type === 'middle') {
    const stateroomsUsed = (crewStateRow?.cnt ?? 0) + (pendingByType.high ?? 0) + (pendingByType.middle ?? 0)
    const available = ship.stateroom_capacity - stateroomsUsed
    if (count > available) return c.json({ error: `Only ${Math.max(0, available)} stateroom(s) available` }, 400)
  } else if (passage_type === 'low') {
    const available = ship.low_berth_capacity - (pendingByType.low ?? 0)
    if (count > available) return c.json({ error: `Only ${Math.max(0, available)} low berth(s) available` }, 400)
  } else if (passage_type === 'basic') {
    const cargoUsed = (cargoRow?.tons ?? 0) + (pendingByType.basic ?? 0) * MGT2022_BASIC_PASSAGE_TONS
    const available = Math.floor((ship.cargo_capacity - cargoUsed) / MGT2022_BASIC_PASSAGE_TONS)
    if (count > available) return c.json({ error: `Only ${Math.max(0, available)} Basic passenger(s) worth of cargo space available` }, 400)
  }

  // Traffic-availability cap (MgT2022 only — no snapshot row exists for
  // CT7/T5, which stay unlimited-subject-to-capacity as before). Atomic
  // guarded decrement, same pattern as buy-cargo's qty_available guard, so
  // two concurrent bookings racing for the last seat can't both win.
  const trafficKey = { high: 'high_passages', middle: 'middle_passages', basic: 'basic_passages', low: 'low_passages' }[passage_type]
  if (trafficRow && trafficKey) {
    const decrement = await db.prepare(
      `UPDATE traffic_snapshots SET ${trafficKey} = ${trafficKey} - ?
       WHERE campaign_id = ? AND ship_id = ? AND world_hex = ? AND sector = ? AND dest_world_hex = ? AND dest_sector = ? AND tick = ? AND ${trafficKey} >= ?`
    ).bind(count, campaign_id, id, embark_world_hex, embark_sector, dest_world_hex, dest_sector, tick, count).run()

    if (decrement.meta.changes === 0) {
      const fresh = await db.prepare(
        `SELECT ${trafficKey} FROM traffic_snapshots WHERE campaign_id = ? AND ship_id = ? AND world_hex = ? AND sector = ? AND dest_world_hex = ? AND dest_sector = ? AND tick = ?`
      ).bind(campaign_id, id, embark_world_hex, embark_sector, dest_world_hex, dest_sector, tick).first()
      return c.json({ error: `Only ${fresh?.[trafficKey] ?? 0} ${passage_type} passenger(s) available this tick` }, 400)
    }
  }

  const manifestId = crypto.randomUUID()
  await db.batch([
    db.prepare(`INSERT INTO obligations (id, campaign_id, ship_id, player_id, kind, amount, passage_type, passenger_count, origin_world_hex, origin_sector, origin_world_name, accept_tick, dest_world_hex, dest_sector, dest_world_name, fare_per_head)
                      VALUES (?, ?, ?, ?, 'passenger', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(manifestId, campaign_id, id, player_id, fare_total, passage_type, count, embark_world_hex, embark_sector, embark_world_name ?? '', tick, dest_world_hex, dest_sector, dest_world_name ?? '', fare_per_head),
    db.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, total_cr, world_hex, sector, notes)
                      VALUES (?, ?, ?, ?, ?, 'passenger_fare', ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), campaign_id, player_id, id, tick, fare_total, embark_world_hex, embark_sector,
            `${count}× ${passage_type} → ${dest_world_name || dest_world_hex}`),
    db.prepare(`UPDATE ships SET credits = credits + ? WHERE id = ?`).bind(fare_total, id),
  ])

  const manifest = await db.prepare(PASSENGER_SELECT + ` WHERE id = ?`).bind(manifestId).first()
  return c.json({ data: manifest }, 201)
})

// ── POST /api/ships/:id/deliver-passengers — batch update status ──────────────
app.post('/:id/deliver-passengers', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { ids, tick, campaign_id } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!ids?.length) return c.json({ data: { ok: true } })

  const stmts = ids.map(pid =>
    c.env.DB.prepare(`UPDATE obligations SET status = 'fulfilled', resolve_tick = ? WHERE id = ? AND campaign_id = ? AND kind = 'passenger'`)
      .bind(tick, pid, campaign_id)
  )
  await c.env.DB.batch(stmts)
  return c.json({ data: { ok: true } })
})

// ── POST /api/ships/:id/refund-passenger — atomic: manifest + transaction + credits ──
app.post('/:id/refund-passenger', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { manifest_id, tick, campaign_id, player_id } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const db       = c.env.DB
  const manifest = await db.prepare(PASSENGER_SELECT + ` WHERE id = ? AND campaign_id = ?`).bind(manifest_id, campaign_id).first()
  if (!manifest) return c.json({ error: 'Manifest not found' }, 404)

  await db.batch([
    db.prepare(`UPDATE obligations SET status = 'cancelled', resolve_tick = ? WHERE id = ?`).bind(tick, manifest_id),
    db.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, total_cr, world_hex, sector, notes)
                VALUES (?, ?, ?, ?, ?, 'passenger_refund', ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), campaign_id, player_id, id, tick, -manifest.fare_total,
            manifest.embark_world_hex, manifest.embark_sector,
            `Refund: ${manifest.count}× ${manifest.passage_type}`),
    db.prepare(`UPDATE ships SET credits = credits - ? WHERE id = ?`).bind(manifest.fare_total, id),
  ])

  return c.json({ data: { ok: true } })
})

// ── POST /api/ships/:id/purchase-fuel — atomic: transaction + credits + fuel_current ──
app.post('/:id/purchase-fuel', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { campaign_id, player_id, fuel_type, tons, price_per_ton, world_hex, sector, tick } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const totalCost = Math.round(tons * price_per_ton)

  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, tons, price_per_ton, total_cr, world_hex, sector, notes)
                      VALUES (?, ?, ?, ?, ?, 'fuel', ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), campaign_id, player_id, id, tick, tons, price_per_ton, -totalCost, world_hex, sector, `${fuel_type} fuel`),
    c.env.DB.prepare(`UPDATE ships SET credits = credits - ?, fuel_current = fuel_current + ? WHERE id = ?`).bind(totalCost, tons, id),
  ])

  const ship = await c.env.DB.prepare(`SELECT credits, fuel_current FROM ships WHERE id = ?`).bind(id).first()
  return c.json({ data: { ok: true, total_cost: totalCost, credits: ship?.credits, fuel_current: ship?.fuel_current } })
})

// ── POST /api/ships/:id/accept-mail — insert mail contract ───────────────────
app.post('/:id/accept-mail', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { campaign_id, player_id, origin_world_hex, origin_sector, origin_world_name,
          dest_world_hex, dest_sector, dest_world_name, parsecs, payment, tick,
          mail_containers = null } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const db = c.env.DB

  if (mail_containers != null) {
    const ship = await db.prepare(`SELECT cargo_capacity FROM ships WHERE id = ?`).bind(id).first()
    if (!ship) return c.json({ error: 'Ship not found' }, 404)

    const [cargoRow, pendingBasicRow, pendingMailRow, pendingFreightRow] = await Promise.all([
      db.prepare(`SELECT COALESCE(SUM(tons), 0) as tons FROM cargo WHERE ship_id = ? AND campaign_id = ?`).bind(id, campaign_id).first(),
      db.prepare(`SELECT COALESCE(SUM(passenger_count), 0) as cnt FROM obligations
                  WHERE ship_id = ? AND campaign_id = ? AND kind = 'passenger' AND status = 'pending' AND passage_type = 'basic'`).bind(id, campaign_id).first(),
      db.prepare(`SELECT COALESCE(SUM(mail_containers), 0) as containers FROM obligations
                  WHERE ship_id = ? AND campaign_id = ? AND kind = 'mail' AND status = 'pending'`).bind(id, campaign_id).first(),
      db.prepare(`SELECT COALESCE(SUM(freight_tons), 0) as tons FROM obligations
                  WHERE ship_id = ? AND campaign_id = ? AND kind = 'freight' AND status = 'pending'`).bind(id, campaign_id).first(),
    ])

    const cargoUsed = (cargoRow?.tons ?? 0)
      + (pendingBasicRow?.cnt ?? 0) * MGT2022_BASIC_PASSAGE_TONS
      + (pendingMailRow?.containers ?? 0) * MGT2022_MAIL_CONTAINER_TONS
      + (pendingFreightRow?.tons ?? 0)
    const neededTons = mail_containers * MGT2022_MAIL_CONTAINER_TONS
    const cargoAvailable = ship.cargo_capacity - cargoUsed
    if (neededTons > cargoAvailable) {
      return c.json({ error: `Insufficient cargo space for ${mail_containers} container(s) (need ${neededTons}t, have ${cargoAvailable}t)` }, 400)
    }

    // Take-all-or-none: decrement by exactly the count the client is
    // claiming, guarded so two ships/players racing for the same tick's
    // mail can't both succeed (same atomic pattern as buy-cargo).
    const decrement = await db.prepare(
      `UPDATE traffic_snapshots SET mail_containers = mail_containers - ?
       WHERE campaign_id = ? AND ship_id = ? AND world_hex = ? AND sector = ? AND dest_world_hex = ? AND dest_sector = ? AND tick = ? AND mail_containers >= ?`
    ).bind(mail_containers, campaign_id, id, origin_world_hex, origin_sector, dest_world_hex, dest_sector, tick, mail_containers).run()

    if (decrement.meta.changes === 0) {
      return c.json({ error: 'Mail containers no longer available this tick' }, 400)
    }
  }

  const contractId = crypto.randomUUID()
  await db.prepare(
    `INSERT INTO obligations (id, campaign_id, ship_id, player_id, kind, amount, origin_world_hex, origin_sector, origin_world_name, accept_tick, dest_world_hex, dest_sector, dest_world_name, parsecs, mail_containers)
     VALUES (?, ?, ?, ?, 'mail', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(contractId, campaign_id, id, player_id, payment, origin_world_hex, origin_sector, origin_world_name ?? '',
         tick, dest_world_hex, dest_sector, dest_world_name ?? '', parsecs, mail_containers).run()

  const contract = await db.prepare(MAIL_SELECT + ` WHERE id = ?`).bind(contractId).first()
  return c.json({ data: contract }, 201)
})

// ── POST /api/ships/:id/deliver-mail — atomic: mail contracts + transactions + credits ──
app.post('/:id/deliver-mail', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { contracts, world_hex, sector, tick, campaign_id, player_id } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!contracts?.length) return c.json({ data: { ok: true } })

  const totalPayment = contracts.reduce((s, m) => s + m.payment, 0)
  const stmts = [
    ...contracts.map(m => c.env.DB.prepare(
      `UPDATE obligations SET status = 'fulfilled', resolve_tick = ? WHERE id = ? AND campaign_id = ? AND kind = 'mail'`
    ).bind(tick, m.id, campaign_id)),
    ...contracts.map(m => c.env.DB.prepare(
      `INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, total_cr, world_hex, sector, notes)
       VALUES (?, ?, ?, ?, ?, 'mail', ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), campaign_id, player_id, id, tick, m.payment, world_hex, sector,
           `Mail delivered from ${m.origin_world_name || m.origin_world_hex}`)),
    c.env.DB.prepare(`UPDATE ships SET credits = credits + ? WHERE id = ?`).bind(totalPayment, id),
  ]

  await c.env.DB.batch(stmts)
  return c.json({ data: { ok: true } })
})

// ── POST /api/ships/:id/book-freight — atomic: obligation + transaction + credits ──
// MgT2022 only. Charged upfront, like passenger fares.
app.post('/:id/book-freight', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const body    = await c.req.json()
  const { campaign_id, player_id, origin_world_hex, origin_sector, origin_world_name,
          dest_world_hex, dest_sector, dest_world_name, parsecs,
          freight_tons, freight_lot_size, rate_per_ton, charge, due_tick, tick } = body

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const db   = c.env.DB
  const ship = await db.prepare(`SELECT cargo_capacity FROM ships WHERE id = ?`).bind(id).first()
  if (!ship) return c.json({ error: 'Ship not found' }, 404)

  const [cargoRow, pendingBasicRow, pendingMailRow, pendingFreightRow] = await Promise.all([
    db.prepare(`SELECT COALESCE(SUM(tons), 0) as tons FROM cargo WHERE ship_id = ? AND campaign_id = ?`).bind(id, campaign_id).first(),
    db.prepare(`SELECT COALESCE(SUM(passenger_count), 0) as cnt FROM obligations
                WHERE ship_id = ? AND campaign_id = ? AND kind = 'passenger' AND status = 'pending' AND passage_type = 'basic'`).bind(id, campaign_id).first(),
    db.prepare(`SELECT COALESCE(SUM(mail_containers), 0) as containers FROM obligations
                WHERE ship_id = ? AND campaign_id = ? AND kind = 'mail' AND status = 'pending'`).bind(id, campaign_id).first(),
    db.prepare(`SELECT COALESCE(SUM(freight_tons), 0) as tons FROM obligations
                WHERE ship_id = ? AND campaign_id = ? AND kind = 'freight' AND status = 'pending'`).bind(id, campaign_id).first(),
  ])

  const cargoUsed = (cargoRow?.tons ?? 0)
    + (pendingBasicRow?.cnt ?? 0) * MGT2022_BASIC_PASSAGE_TONS
    + (pendingMailRow?.containers ?? 0) * MGT2022_MAIL_CONTAINER_TONS
    + (pendingFreightRow?.tons ?? 0)
  const cargoAvailable = ship.cargo_capacity - cargoUsed
  if (freight_tons > cargoAvailable) {
    return c.json({ error: `Insufficient cargo space (need ${freight_tons}t, have ${cargoAvailable}t)` }, 400)
  }

  // Traffic-availability cap (MgT2022 only — no snapshot row exists for
  // CT7/T5). Atomic guarded decrement, same pattern as buy-cargo's
  // qty_available guard: the check and the decrement are one statement, so
  // two concurrent bookings racing for the last lot can't both win.
  const lotColumn = { major: 'major_freight_lots', minor: 'minor_freight_lots', incidental: 'incidental_freight_lots' }[freight_lot_size]
  if (lotColumn) {
    const decrement = await db.prepare(
      `UPDATE traffic_snapshots SET ${lotColumn} = ${lotColumn} - 1
       WHERE campaign_id = ? AND ship_id = ? AND world_hex = ? AND sector = ? AND dest_world_hex = ? AND dest_sector = ? AND tick = ? AND ${lotColumn} >= 1`
    ).bind(campaign_id, id, origin_world_hex, origin_sector, dest_world_hex, dest_sector, tick).run()

    if (decrement.meta.changes === 0) {
      const fresh = await db.prepare(
        `SELECT ${lotColumn} FROM traffic_snapshots WHERE campaign_id = ? AND ship_id = ? AND world_hex = ? AND sector = ? AND dest_world_hex = ? AND dest_sector = ? AND tick = ?`
      ).bind(campaign_id, id, origin_world_hex, origin_sector, dest_world_hex, dest_sector, tick).first()
      // No snapshot row at all means CT7/T5 (or MgT2022 before any traffic
      // roll has happened yet) — stay unlimited, matching prior behavior.
      if (fresh) {
        return c.json({ error: `Only ${fresh[lotColumn] ?? 0} ${freight_lot_size} freight lot(s) available this tick` }, 400)
      }
    }
  }

  const obligationId = crypto.randomUUID()
  await db.batch([
    db.prepare(`INSERT INTO obligations (id, campaign_id, ship_id, player_id, kind, amount, origin_world_hex, origin_sector, origin_world_name, accept_tick, dest_world_hex, dest_sector, dest_world_name, parsecs, freight_tons, freight_lot_size, rate_per_ton, due_tick)
                      VALUES (?, ?, ?, ?, 'freight', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(obligationId, campaign_id, id, player_id, charge, origin_world_hex, origin_sector, origin_world_name ?? '',
            tick, dest_world_hex, dest_sector, dest_world_name ?? '', parsecs, freight_tons, freight_lot_size, rate_per_ton, due_tick),
    db.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, total_cr, world_hex, sector, notes)
                      VALUES (?, ?, ?, ?, ?, 'freight_charge', ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), campaign_id, player_id, id, tick, charge, origin_world_hex, origin_sector,
            `${freight_tons}t ${freight_lot_size} freight → ${dest_world_name || dest_world_hex}`),
    db.prepare(`UPDATE ships SET credits = credits + ? WHERE id = ?`).bind(charge, id),
  ])

  const obligation = await db.prepare(FREIGHT_SELECT + ` WHERE id = ?`).bind(obligationId).first()
  return c.json({ data: obligation }, 201)
})

// ── POST /api/ships/:id/deliver-freight — atomic: obligations + late penalty + transactions + credits ──
app.post('/:id/deliver-freight', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { lots, world_hex, sector, tick, campaign_id, player_id } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!lots?.length) return c.json({ data: { ok: true, lots: [] } })

  const stmts = []
  const deliveredLots = []
  let netTotal = 0

  for (const lot of lots) {
    const isLate = lot.due_tick != null && tick > lot.due_tick
    const penaltyPct = isLate ? freightLatePenaltyPct(campaign_id, lot.id) : 0
    const net = isLate ? freightNetAfterPenalty(lot.charge, penaltyPct) : lot.charge
    netTotal += net
    deliveredLots.push({ ...lot, penaltyPct, net })

    stmts.push(
      c.env.DB.prepare(`UPDATE obligations SET status = 'fulfilled', resolve_tick = ? WHERE id = ? AND campaign_id = ? AND kind = 'freight'`)
        .bind(tick, lot.id, campaign_id)
    )
    // Note: the charge itself was already paid at booking time (book-freight
    // credits the ship immediately) — nothing to record here on time.
    if (isLate) {
      const penaltyAmount = net - lot.charge // negative
      stmts.push(
        c.env.DB.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, total_cr, world_hex, sector, notes)
                          VALUES (?, ?, ?, ?, ?, 'freight_penalty', ?, ?, ?, ?)`)
          .bind(crypto.randomUUID(), campaign_id, player_id, id, tick, penaltyAmount, world_hex, sector,
                `Late delivery penalty: ${penaltyPct}%`)
      )
    }
  }
  // Freight was already paid at booking time (see book-freight); a late
  // penalty claws back the difference here instead of paying again.
  const clawback = lots.reduce((s, l) => s + l.charge, 0) - netTotal
  if (clawback > 0) {
    stmts.push(c.env.DB.prepare(`UPDATE ships SET credits = credits - ? WHERE id = ?`).bind(clawback, id))
  }

  await c.env.DB.batch(stmts)
  return c.json({ data: { ok: true, lots: deliveredLots, clawback } })
})

// ── POST /api/ships/:id/refund-freight — atomic: obligation + transaction + credits ──
app.post('/:id/refund-freight', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { obligation_id, tick, campaign_id, player_id } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const db         = c.env.DB
  const obligation = await db.prepare(FREIGHT_SELECT + ` WHERE id = ? AND campaign_id = ?`).bind(obligation_id, campaign_id).first()
  if (!obligation) return c.json({ error: 'Freight contract not found' }, 404)

  await db.batch([
    db.prepare(`UPDATE obligations SET status = 'cancelled', resolve_tick = ? WHERE id = ?`).bind(tick, obligation_id),
    db.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, total_cr, world_hex, sector, notes)
                VALUES (?, ?, ?, ?, ?, 'freight_refund', ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), campaign_id, player_id, id, tick, -obligation.charge,
            obligation.origin_world_hex, obligation.origin_sector,
            `Refund: ${obligation.freight_tons}t ${obligation.freight_lot_size} freight`),
    db.prepare(`UPDATE ships SET credits = credits - ? WHERE id = ?`).bind(obligation.charge, id),
  ])

  return c.json({ data: { ok: true } })
})

// ── GET /api/ships/:id/passengers — in-transit passengers (referee use) ───────
app.get('/:id/passengers', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { campaign_id } = c.req.query()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const { results } = await c.env.DB.prepare(
    PASSENGER_SELECT + ` WHERE kind = 'passenger' AND status = 'pending' AND ship_id = ? AND campaign_id = ? ORDER BY created_at`
  ).bind(id, campaign_id).all()

  return c.json({ data: results ?? [] })
})

// ── POST /api/ships/:id/pay-debt — atomic: credits + debt balance + payment row ─
app.post('/:id/pay-debt', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { debt_id, amount, tick, campaign_id } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(amount > 0)) return c.json({ error: 'Payment amount must be positive' }, 400)

  const db   = c.env.DB
  const ship = await db.prepare(`SELECT credits FROM ships WHERE id = ? AND campaign_id = ?`).bind(id, campaign_id).first()
  if (!ship) return c.json({ error: 'Ship not found' }, 404)

  const debt = await db.prepare(`SELECT current_balance FROM ship_debts WHERE id = ? AND ship_id = ?`).bind(debt_id, id).first()
  if (!debt) return c.json({ error: 'Debt not found' }, 404)

  if (amount > ship.credits)        return c.json({ error: 'Insufficient credits' }, 400)
  if (amount > debt.current_balance) return c.json({ error: 'Payment exceeds remaining balance' }, 400)

  await db.batch([
    db.prepare(`UPDATE ships SET credits = credits - ? WHERE id = ?`).bind(amount, id),
    db.prepare(`UPDATE ship_debts SET current_balance = current_balance - ? WHERE id = ?`).bind(amount, debt_id),
    db.prepare(`INSERT INTO debt_payments (id, debt_id, campaign_id, ship_id, tick, amount)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), debt_id, campaign_id, id, tick, amount),
  ])

  const updatedDebt = await db.prepare(`SELECT * FROM ship_debts WHERE id = ?`).bind(debt_id).first()
  return c.json({ data: { ok: true, debt: updatedDebt, credits: ship.credits - amount } })
})

export default app
