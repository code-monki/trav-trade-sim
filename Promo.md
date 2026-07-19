# Traveller Trade Simulator

**A free, browser-based speculative trade companion for Traveller campaigns — Classic Traveller, T5, and Mongoose 2022.**

🌐 **Live app:** https://code-monki.github.io/trav-trade-sim/
🛠 **Source:** https://github.com/code-monki/trav-trade-sim

---

## What Is It?

The Traveller Trade Simulator is a web tool that brings speculative trade to the table — built on live data from the [Traveller Map API](https://travellermap.com) and covering nine milieus, from the Interstellar Wars through Year 1900. Referees and players connect to a shared campaign in real time — no installation, no accounts, no email. Just a campaign code and a PIN.

Prices shift every jump-week based on world trade codes, active market events, and a deterministic seeded engine that keeps every player's view in sync without a central server doing the rolling. Pick a ruleset per campaign — Classic Traveller Book 7, T5, or Mongoose Traveller 2022 — and the trade math, passage fares, and freight/mail rules follow it.

---

## For Players

- **Market tab** — See purchase and sale prices for all 36 trade goods at the current world, updated each tick. Goods affected by active events are highlighted.
- **Price charts** — Weekly, monthly, annual, and realized (actual trade prices) candlestick charts (TradingView-style) show price history the moment you first visit a world, thanks to automatic backfill.
- **Jump tab** — Identify the most profitable destination for your cargo before you commit to a jump.
- **Cargo hold** — Track what you're carrying, what you paid, and your running profit/loss.
- **Passengers, mail & freight** — Book High/Middle/Low passage, accept Imperial mail contracts, and haul freight lots; manifests auto-deliver and pay out on arrival.
- **Fuel** — Buy refined or unrefined fuel priced by starport class, with a fill-level bar and a one-click "fill for jump."
- **Aboard & Reports** — See everything currently aboard your ship in one place, plus a full ledger, trade history, and income breakdown filterable by date range.
- **Fleet & organizations** — Track ship debts, ownership shares, and net worth; found or join an organization to pool dues and disburse funds across a fleet.

## For Referees

- **Market events** — Create narrative price events (shortage, trade fair, pirate blockade) with independent buy-side and sell-side modifiers, scoped to a single world or an entire subsector. Events fire automatically at random (M.U.L.E.-style), stack with manual ones, and draw from a 20-entry catalogue.
- **Tick control** — Advance the in-game clock with a single button. Prices recalculate, random events may fire, and monthly/annual OHLC rollups happen automatically.
- **Ship & fleet tools** — Manage ships, crew assignments, skills, and PIN resets, plus reusable ship templates, per-ship debts, and joint ownership shares.
- **Organization financials** — Set dues rates and collection frequency, disburse funds, and review fleet-wide P&L.
- **Full audit trail** — Every transaction and market event is logged with Imperial date stamps and price history, so players can review the tape after the session.

---

## Technical Notes

- Runs entirely in the browser (Vue 3 + Vite); backend is Cloudflare Workers (Hono) + D1 (SQLite at the edge).
- No PII collected — identity is campaign code + character name + hashed PIN only.
- Application code is open source under Apache License 2.0; the Traveller game rules and trade mechanics are used under a non-commercial fan-project arrangement consistent with Mongoose Publishing's fair use policy.
- Free to use. No ads, no accounts, no data sold.

---

*Traveller is a registered trademark of Mongoose Publishing Ltd. This is an unofficial fan project and is not affiliated with or endorsed by Mongoose Publishing.*
