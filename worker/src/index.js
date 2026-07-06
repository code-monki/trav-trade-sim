import { Hono } from 'hono'
import { cors } from 'hono/cors'
import campaigns from './routes/campaigns.js'
import auth      from './routes/auth.js'
import calendar  from './routes/calendar.js'
import market    from './routes/market.js'
import ships     from './routes/ships.js'
import referee   from './routes/referee.js'
import reports   from './routes/reports.js'

const app = new Hono()

// ── CORS ──────────────────────────────────────────────────────────────────────
// CORS_ORIGIN is set via wrangler.toml [vars] for dev and
// `wrangler secret put CORS_ORIGIN` for production.
app.use('*', async (c, next) => {
  const origin  = c.env.CORS_ORIGIN ?? 'http://localhost:5173'
  const handler = cors({ origin, allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] })
  return handler(c, next)
})

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (c) => c.json({ ok: true, service: 'trav-trade-sim' }))

// ── Routes ────────────────────────────────────────────────────────────────────
app.route('/api/campaigns', campaigns)
app.route('/api/auth',      auth)
app.route('/api/campaigns', calendar)   // /api/campaigns/:id/calendar + /api/campaigns/:id/advance-tick
app.route('/api/campaigns', market)     // /api/campaigns/:id/events, /snapshots, /market/*
app.route('/api/ships',     ships)
app.route('/api/referee',   referee)
app.route('/api/reports',   reports)

export default app
