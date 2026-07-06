// Session tokens: random UUID stored in D1 with a 30-day expiry.

const TTL_DAYS = 30

export async function createSession(db, playerId, campaignId) {
  const token    = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86_400_000).toISOString()
  await db.prepare(
    `INSERT INTO sessions (token, player_id, campaign_id, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(token, playerId, campaignId, expiresAt).run()
  return token
}

// Returns { player_id, campaign_id, role } or null if invalid/expired.
export async function verifySession(db, token) {
  if (!token) return null
  const row = await db.prepare(
    `SELECT s.player_id, s.campaign_id, p.role
     FROM sessions s
     JOIN players p ON p.id = s.player_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first()
  return row ?? null
}

export async function deleteSession(db, token) {
  await db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run()
}

export async function deletePlayerSessions(db, playerId) {
  await db.prepare(`DELETE FROM sessions WHERE player_id = ?`).bind(playerId).run()
}
