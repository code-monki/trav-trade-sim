import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'

const app = new Hono()

// True if the caller is this campaign's referee, or an officer of the org.
async function isOfficerOrReferee(db, session, orgId) {
  if (session.role === 'referee') return true
  const officer = await db.prepare(
    `SELECT id FROM organization_officers WHERE organization_id = ? AND player_id = ?`
  ).bind(orgId, session.player_id).first()
  return !!officer
}

// ── GET /api/organizations/campaign-players — roster for officer picker ──────
// Any campaign member can see the character-name roster (needed to pick a
// fellow player as an officer) — no financial or private data exposed.
app.get('/campaign-players', requireAuth, async (c) => {
  const session = c.var.session
  const { results } = await c.env.DB.prepare(
    `SELECT id, character_name FROM players WHERE campaign_id = ? ORDER BY character_name`
  ).bind(session.campaign_id).all()
  return c.json({ data: results ?? [] })
})

// ── GET /api/organizations — list this campaign's organizations ──────────────
app.get('/', requireAuth, async (c) => {
  const session = c.var.session
  const { results } = await c.env.DB.prepare(
    `SELECT o.*,
            EXISTS(
              SELECT 1 FROM organization_officers oo
              WHERE oo.organization_id = o.id AND oo.player_id = ?
            ) AS is_officer
     FROM organizations o
     WHERE o.campaign_id = ?
     ORDER BY o.name`
  ).bind(session.player_id, session.campaign_id).all()

  return c.json({
    data: (results ?? []).map(row => ({ ...row, is_officer: !!row.is_officer })),
  })
})

// ── POST /api/organizations — found an organization ───────────────────────────
app.post('/', requireAuth, async (c) => {
  const session = c.var.session
  const { name, treasury_credits, dues_rate, notes } = await c.req.json()

  const db = c.env.DB
  const taken = await db.prepare(
    `SELECT id FROM organizations WHERE campaign_id = ? AND name = ?`
  ).bind(session.campaign_id, name.trim()).first()
  if (taken) return c.json({ error: 'An organization with this name already exists' }, 409)

  const orgId = crypto.randomUUID()
  await db.batch([
    db.prepare(
      `INSERT INTO organizations (id, campaign_id, name, treasury_credits, dues_rate, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(orgId, session.campaign_id, name.trim(), treasury_credits ?? 0, dues_rate ?? null, notes || null),
    db.prepare(
      `INSERT INTO organization_officers (id, organization_id, player_id) VALUES (?, ?, ?)`
    ).bind(crypto.randomUUID(), orgId, session.player_id),
  ])

  const row = await db.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(orgId).first()
  return c.json({ data: { ...row, is_officer: true } }, 201)
})

// ── PATCH /api/organizations/:id — edit an organization ───────────────────────
app.patch('/:id', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const fields  = await c.req.json()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  if (fields.name) {
    const taken = await db.prepare(
      `SELECT id FROM organizations WHERE campaign_id = ? AND name = ? AND id != ?`
    ).bind(session.campaign_id, fields.name.trim(), id).first()
    if (taken) return c.json({ error: 'An organization with this name already exists' }, 409)
  }

  const allowed = ['name', 'treasury_credits', 'dues_rate', 'dues_frequency_ticks', 'notes']
  const setClauses = []
  const values     = []
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) { setClauses.push(`${k} = ?`); values.push(v) }
  }
  if (!setClauses.length) return c.json({ error: 'No valid fields' }, 400)

  values.push(id)
  await db.prepare(`UPDATE organizations SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run()
  const updated = await db.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(id).first()
  return c.json({ data: updated })
})

// ── DELETE /api/organizations/:id ──────────────────────────────────────────────
app.delete('/:id', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  await db.prepare(`DELETE FROM organizations WHERE id = ?`).bind(id).run()
  return c.json({ data: { ok: true } })
})

// ── GET /api/organizations/:id/officers — list officers ───────────────────────
app.get('/:id/officers', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const { results } = await db.prepare(
    `SELECT oo.*, p.character_name FROM organization_officers oo
     JOIN players p ON p.id = oo.player_id
     WHERE oo.organization_id = ? ORDER BY p.character_name`
  ).bind(id).all()
  return c.json({ data: results ?? [] })
})

// ── POST /api/organizations/:id/officers — add an officer ─────────────────────
app.post('/:id/officers', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { player_id } = await c.req.json()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  const taken = await db.prepare(
    `SELECT id FROM organization_officers WHERE organization_id = ? AND player_id = ?`
  ).bind(id, player_id).first()
  if (taken) return c.json({ error: 'This player is already an officer' }, 409)

  const officerId = crypto.randomUUID()
  await db.prepare(
    `INSERT INTO organization_officers (id, organization_id, player_id) VALUES (?, ?, ?)`
  ).bind(officerId, id, player_id).run()

  const row = await db.prepare(
    `SELECT oo.*, p.character_name FROM organization_officers oo
     JOIN players p ON p.id = oo.player_id WHERE oo.id = ?`
  ).bind(officerId).first()
  return c.json({ data: row }, 201)
})

// ── DELETE /api/organizations/:id/officers/:playerId — remove an officer ─────
app.delete('/:id/officers/:playerId', requireAuth, async (c) => {
  const session = c.var.session
  const { id, playerId } = c.req.param()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  const { count } = await db.prepare(
    `SELECT COUNT(*) AS count FROM organization_officers WHERE organization_id = ?`
  ).bind(id).first()
  if (count <= 1) return c.json({ error: 'Cannot remove the last officer' }, 409)

  await db.prepare(
    `DELETE FROM organization_officers WHERE organization_id = ? AND player_id = ?`
  ).bind(id, playerId).run()
  return c.json({ data: { ok: true } })
})

// ── GET /api/organizations/:id/members — ship members of an org ──────────────
app.get('/:id/members', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const { results } = await db.prepare(
    `SELECT om.*, s.name AS ship_name FROM organization_members om
     JOIN ships s ON s.id = om.ship_id
     WHERE om.organization_id = ? ORDER BY s.name`
  ).bind(id).all()
  return c.json({ data: results ?? [] })
})

// ── POST /api/organizations/:id/members — add a ship to the org ──────────────
app.post('/:id/members', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { ship_id, owns_ship } = await c.req.json()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  const taken = await db.prepare(
    `SELECT id FROM organization_members WHERE organization_id = ? AND ship_id = ?`
  ).bind(id, ship_id).first()
  if (taken) return c.json({ error: 'This ship is already a member of this organization' }, 409)

  if (owns_ship) {
    const otherOwner = await db.prepare(
      `SELECT id FROM organization_members WHERE ship_id = ? AND owns_ship = 1`
    ).bind(ship_id).first()
    if (otherOwner) return c.json({ error: 'This ship is already owned outright by another organization' }, 409)
  }

  const memberId = crypto.randomUUID()
  await db.prepare(
    `INSERT INTO organization_members (id, organization_id, ship_id, owns_ship) VALUES (?, ?, ?, ?)`
  ).bind(memberId, id, ship_id, owns_ship ? 1 : 0).run()

  const row = await db.prepare(
    `SELECT om.*, s.name AS ship_name FROM organization_members om JOIN ships s ON s.id = om.ship_id WHERE om.id = ?`
  ).bind(memberId).first()
  return c.json({ data: row }, 201)
})

// ── DELETE /api/organizations/:id/members/:memberId — remove a ship ──────────
app.delete('/:id/members/:memberId', requireAuth, async (c) => {
  const session = c.var.session
  const { id, memberId } = c.req.param()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  await db.prepare(
    `DELETE FROM organization_members WHERE id = ? AND organization_id = ?`
  ).bind(memberId, id).run()
  return c.json({ data: { ok: true } })
})

// ── PATCH /api/organizations/:id/members/:memberId — toggle owns_ship ────────
app.patch('/:id/members/:memberId', requireAuth, async (c) => {
  const session = c.var.session
  const { id, memberId } = c.req.param()
  const { owns_ship } = await c.req.json()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  const member = await db.prepare(
    `SELECT ship_id FROM organization_members WHERE id = ? AND organization_id = ?`
  ).bind(memberId, id).first()
  if (!member) return c.json({ error: 'Membership not found' }, 404)

  if (owns_ship) {
    const otherOwner = await db.prepare(
      `SELECT id FROM organization_members WHERE ship_id = ? AND owns_ship = 1 AND id != ?`
    ).bind(member.ship_id, memberId).first()
    if (otherOwner) return c.json({ error: 'This ship is already owned outright by another organization' }, 409)
  }

  await db.prepare(
    `UPDATE organization_members SET owns_ship = ? WHERE id = ?`
  ).bind(owns_ship ? 1 : 0, memberId).run()

  const row = await db.prepare(
    `SELECT om.*, s.name AS ship_name FROM organization_members om JOIN ships s ON s.id = om.ship_id WHERE om.id = ?`
  ).bind(memberId).first()
  return c.json({ data: row })
})

// ── Organization Ownership (equity) — mirrors ship_ownership, officer-managed ─

// ── GET /api/organizations/:id/ownership — list equity shares ────────────────
app.get('/:id/ownership', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)

  const { results } = await db.prepare(
    `SELECT oo.*, p.character_name FROM organization_ownership oo
     JOIN players p ON p.id = oo.player_id
     WHERE oo.organization_id = ? ORDER BY oo.percentage DESC`
  ).bind(id).all()
  return c.json({ data: results ?? [] })
})

// ── POST /api/organizations/:id/ownership — add an equity share ──────────────
app.post('/:id/ownership', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { player_id, percentage } = await c.req.json()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  const { results: existing } = await db.prepare(
    `SELECT percentage FROM organization_ownership WHERE organization_id = ?`
  ).bind(id).all()
  const existingTotal = (existing ?? []).reduce((s, r) => s + r.percentage, 0)
  if (existingTotal + percentage > 100) {
    return c.json({ error: `Equity shares can't exceed 100% (currently ${existingTotal}%)` }, 409)
  }

  const ownershipId = crypto.randomUUID()
  await db.prepare(
    `INSERT INTO organization_ownership (id, campaign_id, organization_id, player_id, percentage) VALUES (?, ?, ?, ?, ?)`
  ).bind(ownershipId, session.campaign_id, id, player_id, percentage).run()

  const row = await db.prepare(
    `SELECT oo.*, p.character_name FROM organization_ownership oo JOIN players p ON p.id = oo.player_id WHERE oo.id = ?`
  ).bind(ownershipId).first()
  return c.json({ data: row }, 201)
})

// ── PATCH /api/organizations/:id/ownership/:ownershipId — edit a share ───────
app.patch('/:id/ownership/:ownershipId', requireAuth, async (c) => {
  const session = c.var.session
  const { id, ownershipId } = c.req.param()
  const { percentage } = await c.req.json()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  const row = await db.prepare(
    `SELECT id FROM organization_ownership WHERE id = ? AND organization_id = ?`
  ).bind(ownershipId, id).first()
  if (!row) return c.json({ error: 'Equity share not found' }, 404)

  const { results: existing } = await db.prepare(
    `SELECT percentage FROM organization_ownership WHERE organization_id = ? AND id != ?`
  ).bind(id, ownershipId).all()
  const existingTotal = (existing ?? []).reduce((s, r) => s + r.percentage, 0)
  if (existingTotal + percentage > 100) {
    return c.json({ error: `Equity shares can't exceed 100% (other shares total ${existingTotal}%)` }, 409)
  }

  await db.prepare(`UPDATE organization_ownership SET percentage = ? WHERE id = ?`).bind(percentage, ownershipId).run()
  const updated = await db.prepare(
    `SELECT oo.*, p.character_name FROM organization_ownership oo JOIN players p ON p.id = oo.player_id WHERE oo.id = ?`
  ).bind(ownershipId).first()
  return c.json({ data: updated })
})

// ── DELETE /api/organizations/:id/ownership/:ownershipId ─────────────────────
app.delete('/:id/ownership/:ownershipId', requireAuth, async (c) => {
  const session = c.var.session
  const { id, ownershipId } = c.req.param()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  await db.prepare(
    `DELETE FROM organization_ownership WHERE id = ? AND organization_id = ?`
  ).bind(ownershipId, id).run()
  return c.json({ data: { ok: true } })
})

// ── Dues & Disbursement ───────────────────────────────────────────────────────

// ── POST /api/organizations/:id/collect-dues — officer-triggered collection ──
app.post('/:id/collect-dues', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { tick } = await c.req.json()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  if (!org.dues_rate) return c.json({ error: 'No dues rate configured for this organization' }, 400)

  if (org.last_dues_tick != null) {
    const nextDue = org.last_dues_tick + org.dues_frequency_ticks
    if (tick < nextDue) {
      return c.json({ error: `Dues aren't due yet — next collection available at tick ${nextDue}` }, 409)
    }
  }

  const { results: members } = await db.prepare(
    `SELECT om.ship_id, s.credits FROM organization_members om
     JOIN ships s ON s.id = om.ship_id WHERE om.organization_id = ?`
  ).bind(id).all()

  const paid   = []
  const failed = []
  for (const m of members ?? []) {
    if (m.credits >= org.dues_rate) paid.push(m.ship_id)
    else                            failed.push(m.ship_id)
  }

  const collectedTotal = paid.length * org.dues_rate
  const statements = paid.map(shipId =>
    db.prepare(`UPDATE ships SET credits = credits - ? WHERE id = ?`).bind(org.dues_rate, shipId)
  )
  statements.push(
    db.prepare(
      `UPDATE organizations SET treasury_credits = treasury_credits + ?, last_dues_tick = ? WHERE id = ?`
    ).bind(collectedTotal, tick, id)
  )
  for (const shipId of paid) {
    statements.push(
      db.prepare(
        `INSERT INTO dues_payments (id, organization_id, ship_id, campaign_id, tick, amount) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), id, shipId, session.campaign_id, tick, org.dues_rate)
    )
  }

  if (statements.length) await db.batch(statements)
  else await db.prepare(`UPDATE organizations SET last_dues_tick = ? WHERE id = ?`).bind(tick, id).run()

  const updated = await db.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(id).first()
  return c.json({ data: { organization: updated, collected_total: collectedTotal, paid_ship_ids: paid, failed_ship_ids: failed } })
})

// ── POST /api/organizations/:id/disburse — ad hoc treasury -> ship transfer ──
app.post('/:id/disburse', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()
  const { ship_id, amount, tick, notes } = await c.req.json()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  if (!(amount > 0)) return c.json({ error: 'Amount must be positive' }, 400)
  if (amount > org.treasury_credits) return c.json({ error: 'Insufficient organization treasury' }, 400)

  const member = await db.prepare(
    `SELECT id FROM organization_members WHERE organization_id = ? AND ship_id = ?`
  ).bind(id, ship_id).first()
  if (!member) return c.json({ error: 'Ship is not a member of this organization' }, 404)

  await db.batch([
    db.prepare(`UPDATE organizations SET treasury_credits = treasury_credits - ? WHERE id = ?`).bind(amount, id),
    db.prepare(`UPDATE ships SET credits = credits + ? WHERE id = ?`).bind(amount, ship_id),
    db.prepare(
      `INSERT INTO disbursements (id, organization_id, ship_id, campaign_id, tick, amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), id, ship_id, session.campaign_id, tick, amount, notes || null),
  ])

  const updatedOrg  = await db.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(id).first()
  const updatedShip = await db.prepare(`SELECT credits FROM ships WHERE id = ?`).bind(ship_id).first()
  return c.json({ data: { organization: updatedOrg, ship_credits: updatedShip.credits } })
})

// ── GET /api/organizations/:id/dues-payments — collection history ────────────
app.get('/:id/dues-payments', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  const { results } = await db.prepare(
    `SELECT dp.*, s.name AS ship_name FROM dues_payments dp
     JOIN ships s ON s.id = dp.ship_id
     WHERE dp.organization_id = ? ORDER BY dp.tick DESC`
  ).bind(id).all()
  return c.json({ data: results ?? [] })
})

// ── GET /api/organizations/:id/disbursements — disbursement history ──────────
app.get('/:id/disbursements', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT campaign_id FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  const { results } = await db.prepare(
    `SELECT d.*, s.name AS ship_name FROM disbursements d
     JOIN ships s ON s.id = d.ship_id
     WHERE d.organization_id = ? ORDER BY d.tick DESC`
  ).bind(id).all()
  return c.json({ data: results ?? [] })
})

// ── GET /api/organizations/:id/fleet-report — consolidated fleet P&L ─────────
app.get('/:id/fleet-report', requireAuth, async (c) => {
  const session = c.var.session
  const { id }  = c.req.param()

  const db  = c.env.DB
  const org = await db.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(id).first()
  if (!org)                                    return c.json({ error: 'Organization not found' }, 404)
  if (org.campaign_id !== session.campaign_id) return c.json({ error: 'Forbidden' }, 403)
  if (!(await isOfficerOrReferee(db, session, id))) return c.json({ error: 'Officers only' }, 403)

  const { results: ships } = await db.prepare(
    `SELECT s.id, s.name, s.credits, s.market_value
     FROM organization_members om JOIN ships s ON s.id = om.ship_id
     WHERE om.organization_id = ? ORDER BY s.name`
  ).bind(id).all()

  const shipIds = (ships ?? []).map(s => s.id)
  let cargoByShip = {}
  let debtByShip  = {}
  let byType      = {}

  if (shipIds.length) {
    const placeholders = shipIds.map(() => '?').join(',')

    const { results: cargoRows } = await db.prepare(
      `SELECT ship_id, SUM(purchase_price * tons) AS value FROM cargo WHERE ship_id IN (${placeholders}) GROUP BY ship_id`
    ).bind(...shipIds).all()
    for (const r of cargoRows ?? []) cargoByShip[r.ship_id] = r.value

    const { results: debtRows } = await db.prepare(
      `SELECT ship_id, SUM(current_balance) AS balance FROM ship_debts WHERE ship_id IN (${placeholders}) GROUP BY ship_id`
    ).bind(...shipIds).all()
    for (const r of debtRows ?? []) debtByShip[r.ship_id] = r.balance

    const { results: txnRows } = await db.prepare(
      `SELECT type, total_cr FROM transactions WHERE ship_id IN (${placeholders}) AND campaign_id = ?`
    ).bind(...shipIds, session.campaign_id).all()
    for (const row of txnRows ?? []) byType[row.type] = (byType[row.type] ?? 0) + row.total_cr
  }

  const shipRows = (ships ?? []).map(s => {
    const cargoValue = cargoByShip[s.id] ?? 0
    const debt       = debtByShip[s.id] ?? 0
    return {
      id: s.id, name: s.name, credits: s.credits, market_value: s.market_value,
      cargo_value: cargoValue, debt,
      net_contribution: s.credits + s.market_value + cargoValue - debt,
    }
  })

  const fleetNetWorth = org.treasury_credits + shipRows.reduce((sum, r) => sum + r.net_contribution, 0)

  return c.json({
    data: {
      organization_treasury: org.treasury_credits,
      ships: shipRows,
      fleet_net_worth: fleetNetWorth,
      income_by_type: byType,
    },
  })
})

export default app
