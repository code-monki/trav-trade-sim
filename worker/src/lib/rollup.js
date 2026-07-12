// JS equivalents of the PostgreSQL rollup_month, rollup_year, and
// advance_tick stored procedures.  Called from the calendar route.

export function tickYear(tick)  { return 1105 + Math.floor(tick / 48) }
export function tickMonth(tick) { return Math.floor(tick / 4) % 12 + 1 }
function tickDay(tick)   { return (tick % 48) * 7 + 1 }

async function doRollupMonth(db, campaignId, year, month) {
  const tickMin = (year - 1105) * 48 + (month - 1) * 4
  const tickMax = tickMin + 3

  const { results } = await db.prepare(
    `SELECT world_hex, sector, trade_good_die, tick, purchase_price, qty_available
     FROM market_snapshots
     WHERE campaign_id = ? AND tick BETWEEN ? AND ?
     ORDER BY trade_good_die, tick`
  ).bind(campaignId, tickMin, tickMax).all()

  if (!results.length) return

  // Group by (world_hex, sector, trade_good_die)
  const groups = new Map()
  for (const row of results) {
    const key = `${row.world_hex}|${row.sector}|${row.trade_good_die}`
    if (!groups.has(key)) groups.set(key, { world_hex: row.world_hex, sector: row.sector, trade_good_die: row.trade_good_die, rows: [] })
    groups.get(key).rows.push(row)
  }

  const stmts = []
  for (const g of groups.values()) {
    const sorted = g.rows.sort((a, b) => a.tick - b.tick)
    const open   = sorted[0].purchase_price
    const close  = sorted[sorted.length - 1].purchase_price
    const high   = Math.max(...sorted.map(r => r.purchase_price))
    const low    = Math.min(...sorted.map(r => r.purchase_price))
    const vol    = sorted.reduce((s, r) => s + r.qty_available, 0)

    stmts.push(db.prepare(
      `INSERT INTO market_monthly
         (id, campaign_id, world_hex, sector, trade_good_die, year, month,
          open_price, high_price, low_price, close_price, volume_tons)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (campaign_id, world_hex, sector, trade_good_die, year, month)
       DO UPDATE SET
         open_price=excluded.open_price, high_price=excluded.high_price,
         low_price=excluded.low_price,   close_price=excluded.close_price,
         volume_tons=excluded.volume_tons`
    ).bind(crypto.randomUUID(), campaignId, g.world_hex, g.sector, g.trade_good_die,
           year, month, open, high, low, close, vol))
  }

  if (stmts.length) await db.batch(stmts)
}

async function doRollupYear(db, campaignId, year) {
  const { results } = await db.prepare(
    `SELECT world_hex, sector, trade_good_die, month,
            open_price, high_price, low_price, close_price, volume_tons
     FROM market_monthly
     WHERE campaign_id = ? AND year = ?
     ORDER BY trade_good_die, month`
  ).bind(campaignId, year).all()

  if (!results.length) return

  const groups = new Map()
  for (const row of results) {
    const key = `${row.world_hex}|${row.sector}|${row.trade_good_die}`
    if (!groups.has(key)) groups.set(key, { world_hex: row.world_hex, sector: row.sector, trade_good_die: row.trade_good_die, rows: [] })
    groups.get(key).rows.push(row)
  }

  const stmts = []
  for (const g of groups.values()) {
    const sorted = g.rows.sort((a, b) => a.month - b.month)
    const open  = sorted[0].open_price
    const close = sorted[sorted.length - 1].close_price
    const high  = Math.max(...sorted.map(r => r.high_price))
    const low   = Math.min(...sorted.map(r => r.low_price))
    const vol   = sorted.reduce((s, r) => s + r.volume_tons, 0)

    stmts.push(db.prepare(
      `INSERT INTO market_annual
         (id, campaign_id, world_hex, sector, trade_good_die, year,
          open_price, high_price, low_price, close_price, volume_tons)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (campaign_id, world_hex, sector, trade_good_die, year)
       DO UPDATE SET
         open_price=excluded.open_price, high_price=excluded.high_price,
         low_price=excluded.low_price,   close_price=excluded.close_price,
         volume_tons=excluded.volume_tons`
    ).bind(crypto.randomUUID(), campaignId, g.world_hex, g.sector, g.trade_good_die,
           year, open, high, low, close, vol))
  }

  if (stmts.length) await db.batch(stmts)

  // Event compaction: delete expired events older than (year - 1)
  const cutoff = (year - 1 - 1105) * 48
  await db.prepare(
    `DELETE FROM market_events
     WHERE campaign_id = ? AND expires_tick IS NOT NULL AND expires_tick < ?`
  ).bind(campaignId, cutoff).run()
}

// Re-runs monthly/annual rollup for a boundary tick that was possibly rolled
// up against incomplete data (e.g. a world's weekly snapshots were backfilled
// after the boundary already passed). Safe to call repeatedly — the rollup
// SQL is an upsert.
export async function repairRollup(db, campaignId, tick) {
  if (tick > 0 && tick % 4  === 0) await doRollupMonth(db, campaignId, tickYear(tick - 4), tickMonth(tick - 4))
  if (tick > 0 && tick % 48 === 0) await doRollupYear(db, campaignId, tickYear(tick - 48))
}

export async function advanceTick(db, campaignId) {
  // Atomically increment the tick and read back the new value.
  const result = await db.prepare(
    `UPDATE campaign_calendar
     SET current_tick = current_tick + 1,
         updated_at   = datetime('now')
     WHERE campaign_id = ?
     RETURNING current_tick`
  ).bind(campaignId).first()

  if (!result) return { error: 'Campaign calendar not found' }

  const newTick = result.current_tick
  const year    = tickYear(newTick)
  const day     = tickDay(newTick)
  const month   = tickMonth(newTick)

  // Update the denormalized year/day columns.
  await db.prepare(
    `UPDATE campaign_calendar SET year = ?, day = ? WHERE campaign_id = ?`
  ).bind(year, day, campaignId).run()

  // Monthly rollup fires after every 4th tick (completed month).
  if (newTick % 4 === 0) {
    const ry = tickYear(newTick - 4)
    const rm = tickMonth(newTick - 4)
    await doRollupMonth(db, campaignId, ry, rm)
  }

  // Annual rollup fires after every 48th tick (completed year).
  if (newTick % 48 === 0) {
    await doRollupYear(db, campaignId, tickYear(newTick - 48))
  }

  return { tick: newTick, year, day, month }
}
