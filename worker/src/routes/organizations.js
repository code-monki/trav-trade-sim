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

  const allowed = ['name', 'treasury_credits', 'dues_rate', 'notes']
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

export default app
