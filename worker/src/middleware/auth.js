import { verifySession } from '../lib/session.js'

// Attaches session data to c.var.session.
// Returns 401 if no valid token is present.
export async function requireAuth(c, next) {
  const header = c.req.header('Authorization') ?? ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  const session = await verifySession(c.env.DB, token)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  c.set('session', session)
  await next()
}

// Same as requireAuth but also enforces role === 'referee'.
export async function requireReferee(c, next) {
  const header  = c.req.header('Authorization') ?? ''
  const token   = header.startsWith('Bearer ') ? header.slice(7) : null
  const session = await verifySession(c.env.DB, token)
  if (!session)                     return c.json({ error: 'Unauthorized' }, 401)
  if (session.role !== 'referee')   return c.json({ error: 'Referee access required' }, 403)
  c.set('session', session)
  await next()
}
