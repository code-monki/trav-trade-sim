import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'

const app = new Hono()

// obligations rows aliased back to the passenger_manifests / mail_contracts
// shapes the frontend already expects (see docs/financial-model-gap-analysis.md
// — "Commercial obligations" — for why both kinds share one table).
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
         parsecs, amount AS payment, status, resolve_tick, created_at
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
            s.fuel_capacity, s.fuel_current, s.market_value
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
    market_value: crew.market_value,
    crew_role: crew.role, can_trade: crew.can_trade === 1,
  }

  const [{ results: cargoRows }, { results: passengerRows }, { results: mailRows }, crewStateRow] = await Promise.all([
    db.prepare(`SELECT * FROM cargo WHERE ship_id = ? AND campaign_id = ? ORDER BY created_at`).bind(ship.id, campaign_id).all(),
    db.prepare(PASSENGER_SELECT + ` WHERE kind = 'passenger' AND status = 'pending' AND ship_id = ? AND campaign_id = ? ORDER BY created_at`).bind(ship.id, campaign_id).all(),
    db.prepare(MAIL_SELECT + ` WHERE kind = 'mail' AND status = 'pending' AND ship_id = ? AND campaign_id = ? ORDER BY created_at`).bind(ship.id, campaign_id).all(),
    db.prepare(`SELECT COUNT(*) as cnt FROM crew WHERE ship_id = ? AND campaign_id = ? AND left_tick IS NULL AND has_stateroom = 1`).bind(ship.id, campaign_id).first(),
  ])

  ship.crew_staterooms = crewStateRow?.cnt ?? 0

  return c.json({ data: { ship, cargo: cargoRows ?? [], passengers: passengerRows ?? [], mailContracts: mailRows ?? [] } })
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

  // Check available quantity in the market snapshot for this tick
  const snapshot = await db.prepare(
    `SELECT qty_available FROM market_snapshots
     WHERE campaign_id = ? AND world_hex = ? AND sector = ? AND trade_good_die = ? AND tick = ?`
  ).bind(campaign_id, world_hex, sector, good.trade_good_die, tick).first()

  if (!snapshot) return c.json({ error: 'Market snapshot not found for this tick' }, 400)
  if (tons > snapshot.qty_available) {
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
    db.prepare(`UPDATE market_snapshots SET qty_available = qty_available - ? WHERE campaign_id = ? AND world_hex = ? AND sector = ? AND trade_good_die = ? AND tick = ?`)
      .bind(tons, campaign_id, world_hex, sector, good.trade_good_die, tick),
  ])

  const cargoRow = await db.prepare(`SELECT * FROM cargo WHERE id = ?`).bind(cargoId).first()
  return c.json({ data: cargoRow }, 201)
})

// ── POST /api/ships/:id/sell-cargo — atomic: delete cargo + transaction + trade_record + credits ──
app.post('/:id/sell-cargo', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { campaign_id, cargo_item, sell_price_per_ton, market_world_hex, market_sector, tick, trade_rules } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const totalRevenue = sell_price_per_ton * cargo_item.tons
  const totalCost    = cargo_item.purchase_price * cargo_item.tons
  const netProfit    = totalRevenue - totalCost

  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM cargo WHERE id = ?`).bind(cargo_item.id),
    c.env.DB.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, trade_good_die, trade_good_name, tons, price_per_ton, total_cr, world_hex, sector)
                      VALUES (?, ?, ?, ?, ?, 'sell', ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), campaign_id, cargo_item.player_id, id, tick, cargo_item.trade_good_die, cargo_item.trade_good_name, cargo_item.tons, sell_price_per_ton, totalRevenue, market_world_hex, market_sector),
    c.env.DB.prepare(`INSERT INTO trade_records (id, campaign_id, player_id, ship_id, trade_rules, trade_good_die, trade_good_name, tons, source_world_hex, source_sector, purchase_tick, buy_price_per_ton, total_cost, market_world_hex, market_sector, sell_tick, trade_price_per_ton, sell_price_per_ton, total_revenue, net_profit)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), campaign_id, cargo_item.player_id, id, trade_rules, cargo_item.trade_good_die, cargo_item.trade_good_name, cargo_item.tons, cargo_item.purchase_world, cargo_item.purchase_sector, cargo_item.purchased_tick, cargo_item.purchase_price, totalCost, market_world_hex, market_sector, tick, sell_price_per_ton, sell_price_per_ton, totalRevenue, netProfit),
    c.env.DB.prepare(`UPDATE ships SET credits = credits + ? WHERE id = ?`).bind(totalRevenue, id),
  ])

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

  const manifestId = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO obligations (id, campaign_id, ship_id, player_id, kind, amount, passage_type, passenger_count, origin_world_hex, origin_sector, origin_world_name, accept_tick, dest_world_hex, dest_sector, dest_world_name, fare_per_head)
                      VALUES (?, ?, ?, ?, 'passenger', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(manifestId, campaign_id, id, player_id, fare_total, passage_type, count, embark_world_hex, embark_sector, embark_world_name ?? '', tick, dest_world_hex, dest_sector, dest_world_name ?? '', fare_per_head),
    c.env.DB.prepare(`INSERT INTO transactions (id, campaign_id, player_id, ship_id, tick, type, total_cr, world_hex, sector, notes)
                      VALUES (?, ?, ?, ?, ?, 'passenger_fare', ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), campaign_id, player_id, id, tick, fare_total, embark_world_hex, embark_sector,
            `${count}× ${passage_type} → ${dest_world_name || dest_world_hex}`),
    c.env.DB.prepare(`UPDATE ships SET credits = credits + ? WHERE id = ?`).bind(fare_total, id),
  ])

  const manifest = await c.env.DB.prepare(PASSENGER_SELECT + ` WHERE id = ?`).bind(manifestId).first()
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
          dest_world_hex, dest_sector, dest_world_name, parsecs, payment, tick } = await c.req.json()

  if (campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const contractId = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO obligations (id, campaign_id, ship_id, player_id, kind, amount, origin_world_hex, origin_sector, origin_world_name, accept_tick, dest_world_hex, dest_sector, dest_world_name, parsecs)
     VALUES (?, ?, ?, ?, 'mail', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(contractId, campaign_id, id, player_id, payment, origin_world_hex, origin_sector, origin_world_name ?? '',
         tick, dest_world_hex, dest_sector, dest_world_name ?? '', parsecs).run()

  const contract = await c.env.DB.prepare(MAIL_SELECT + ` WHERE id = ?`).bind(contractId).first()
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
