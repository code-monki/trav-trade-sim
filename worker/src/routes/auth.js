import { Hono } from 'hono'
import { verifyPin } from '../lib/hash.js'
import { createSession, deleteSession } from '../lib/session.js'
import { requireAuth } from '../middleware/auth.js'

const app = new Hono()

// ── POST /api/auth/login ──────────────────────────────────────────────────────
app.post('/login', async (c) => {
  const { code, char_name, pin } = await c.req.json()
  if (!code || !char_name || !pin) return c.json({ error: 'Missing required fields' }, 400)

  const db       = c.env.DB
  const campaign = await db.prepare(`SELECT * FROM campaigns WHERE code = ?`).bind(code.trim().toUpperCase()).first()
  if (!campaign) return c.json({ error: 'Campaign not found' }, 404)

  const player = await db.prepare(
    `SELECT * FROM players WHERE campaign_id = ? AND character_name = ?`
  ).bind(campaign.id, char_name.trim()).first()
  if (!player) return c.json({ error: 'Character not found' }, 404)

  // Rate-limit check
  if (player.locked_until && new Date(player.locked_until) > new Date()) {
    return c.json({ error: 'Too many failed attempts — account locked', locked_until: player.locked_until }, 403)
  }

  const ok = await verifyPin(pin, player.pin_hash)
  if (ok) {
    await db.prepare(
      `UPDATE players SET failed_attempts = 0, locked_until = NULL, last_seen = datetime('now') WHERE id = ?`
    ).bind(player.id).run()

    const token = await createSession(db, player.id, campaign.id)

    return c.json({
      data: {
        campaign: { id: campaign.id, code: campaign.code, label: campaign.label, milieu: campaign.milieu, trade_rules: campaign.trade_rules },
        player:   { id: player.id, character_name: player.character_name, role: player.role, credits: player.credits },
        token,
      }
    })
  }

  // Failed attempt
  const newAttempts  = (player.failed_attempts ?? 0) + 1
  const lockedUntil  = newAttempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null
  await db.prepare(
    `UPDATE players SET failed_attempts = ?, locked_until = ? WHERE id = ?`
  ).bind(newAttempts, lockedUntil, player.id).run()

  return c.json({ error: 'Invalid PIN', attempts_remaining: Math.max(0, 4 - player.failed_attempts) }, 401)
})

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
app.post('/logout', requireAuth, async (c) => {
  const header = c.req.header('Authorization') ?? ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (token) await deleteSession(c.env.DB, token)
  return c.json({ data: { ok: true } })
})

export default app
