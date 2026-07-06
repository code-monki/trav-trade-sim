import { Hono } from 'hono'
import { hashPin, verifyPin } from '../lib/hash.js'
import { createSession, deletePlayerSessions } from '../lib/session.js'
import { requireAuth, requireReferee } from '../middleware/auth.js'

const app = new Hono()

// ── POST /api/campaigns — create campaign + referee character ─────────────────
app.post('/', async (c) => {
  const { label, code, milieu, trade_rules, char_name, pin, start_tick = 0 } = await c.req.json()

  if (!label || !code || !char_name || !pin) return c.json({ error: 'Missing required fields' }, 400)
  if (pin.trim().length < 4)                 return c.json({ error: 'PIN must be at least 4 characters' }, 400)

  const db = c.env.DB
  const existing = await db.prepare(`SELECT id FROM campaigns WHERE code = ?`).bind(code.trim().toUpperCase()).first()
  if (existing) return c.json({ error: 'Campaign code already in use' }, 409)

  const campaignId   = crypto.randomUUID()
  const playerId     = crypto.randomUUID()
  const pinHash      = await hashPin(pin)
  const recoveryCode = crypto.randomUUID().toUpperCase().replace(/-/g, '')
  const recoveryHash = await hashPin(recoveryCode)

  const tick  = Math.max(0, start_tick)
  const year  = 1105 + Math.floor(tick / 48)
  const day   = (tick % 48) * 7 + 1

  await db.batch([
    db.prepare(`INSERT INTO campaigns (id, code, label, milieu, trade_rules, recovery_code_hash) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(campaignId, code.trim().toUpperCase(), label.trim(), milieu ?? 'M1105', trade_rules ?? 'CT7', recoveryHash),
    db.prepare(`INSERT INTO campaign_calendar (campaign_id, current_tick, year, day) VALUES (?, ?, ?, ?)`)
      .bind(campaignId, tick, year, day),
    db.prepare(`INSERT INTO players (id, campaign_id, character_name, pin_hash, role) VALUES (?, ?, ?, ?, 'referee')`)
      .bind(playerId, campaignId, char_name.trim(), pinHash),
  ])

  const token = await createSession(db, playerId, campaignId)

  return c.json({
    data: {
      campaign:      { id: campaignId, code: code.trim().toUpperCase(), label: label.trim(), milieu: milieu ?? 'M1105', trade_rules: trade_rules ?? 'CT7' },
      player:        { id: playerId, character_name: char_name.trim(), role: 'referee', credits: 0 },
      recovery_code: recoveryCode,
      token,
    }
  }, 201)
})

// ── POST /api/campaigns/join — register a new player character ────────────────
app.post('/join', async (c) => {
  const { code, char_name, pin } = await c.req.json()

  if (!code || !char_name || !pin) return c.json({ error: 'Missing required fields' }, 400)
  if (pin.trim().length < 4)       return c.json({ error: 'PIN must be at least 4 characters' }, 400)

  const db       = c.env.DB
  const campaign = await db.prepare(`SELECT id FROM campaigns WHERE code = ?`).bind(code.trim().toUpperCase()).first()
  if (!campaign) return c.json({ error: 'Campaign not found' }, 404)

  const taken = await db.prepare(
    `SELECT id FROM players WHERE campaign_id = ? AND character_name = ?`
  ).bind(campaign.id, char_name.trim()).first()
  if (taken) return c.json({ error: 'Character name already taken in this campaign' }, 409)

  const playerId = crypto.randomUUID()
  const pinHash  = await hashPin(pin)

  await db.prepare(`INSERT INTO players (id, campaign_id, character_name, pin_hash, role) VALUES (?, ?, ?, ?, 'player')`)
    .bind(playerId, campaign.id, char_name.trim(), pinHash).run()

  return c.json({ data: { player: { id: playerId, campaign_id: campaign.id, character_name: char_name.trim(), role: 'player', credits: 0 } } }, 201)
})

// ── PATCH /api/campaigns/:id — update campaign label ────────────────────────
app.patch('/:id', requireReferee, async (c) => {
  const { id }    = c.req.param()
  const session   = c.var.session
  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const { label } = await c.req.json()
  if (!label?.trim()) return c.json({ error: 'Label is required' }, 400)

  await c.env.DB.prepare(`UPDATE campaigns SET label = ? WHERE id = ?`).bind(label.trim(), id).run()
  return c.json({ data: { ok: true, label: label.trim() } })
})

// ── DELETE /api/campaigns/:id — referee deletes their campaign ────────────────
app.delete('/:id', requireReferee, async (c) => {
  const { id }    = c.req.param()
  const { pin }   = await c.req.json()
  const session   = c.var.session

  if (session.campaign_id !== id) return c.json({ error: 'Forbidden' }, 403)

  const db     = c.env.DB
  const player = await db.prepare(`SELECT pin_hash FROM players WHERE id = ?`).bind(session.player_id).first()
  if (!player) return c.json({ error: 'Player not found' }, 404)

  const ok = await verifyPin(pin, player.pin_hash)
  if (!ok) return c.json({ error: 'Incorrect PIN' }, 403)

  await db.prepare(`DELETE FROM campaigns WHERE id = ?`).bind(id).run()
  return c.json({ data: { ok: true } })
})

// ── POST /api/campaigns/recovery-code — regenerate recovery code ──────────────
app.post('/recovery-code', requireReferee, async (c) => {
  const session      = c.var.session
  const recoveryCode = crypto.randomUUID().toUpperCase().replace(/-/g, '')
  const recoveryHash = await hashPin(recoveryCode)

  await c.env.DB.prepare(`UPDATE campaigns SET recovery_code_hash = ? WHERE id = ?`)
    .bind(recoveryHash, session.campaign_id).run()

  return c.json({ data: { recovery_code: recoveryCode } })
})

// ── POST /api/campaigns/reset-pin — reset PIN using recovery code ─────────────
app.post('/reset-pin', async (c) => {
  const { code, char_name, recovery, new_pin } = await c.req.json()

  if (!code || !char_name || !recovery || !new_pin) return c.json({ error: 'Missing required fields' }, 400)
  if (new_pin.trim().length < 4)                    return c.json({ error: 'PIN must be at least 4 characters' }, 400)

  const db       = c.env.DB
  const campaign = await db.prepare(`SELECT id, recovery_code_hash FROM campaigns WHERE code = ?`).bind(code.trim().toUpperCase()).first()
  if (!campaign)                    return c.json({ error: 'Campaign not found' }, 404)
  if (!campaign.recovery_code_hash) return c.json({ error: 'No recovery code set for this campaign' }, 400)

  const validRecovery = await verifyPin(recovery.trim().toUpperCase(), campaign.recovery_code_hash)
  if (!validRecovery) return c.json({ error: 'Invalid recovery code' }, 403)

  const player = await db.prepare(
    `SELECT id FROM players WHERE campaign_id = ? AND character_name = ?`
  ).bind(campaign.id, char_name.trim()).first()
  if (!player) return c.json({ error: 'Character not found' }, 404)

  const newHash = await hashPin(new_pin)
  await db.batch([
    db.prepare(`UPDATE players SET pin_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?`).bind(newHash, player.id),
    db.prepare(`DELETE FROM sessions WHERE player_id = ?`).bind(player.id),
  ])

  return c.json({ data: { ok: true } })
})

export default app
