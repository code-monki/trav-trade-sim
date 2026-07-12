# Traveller Trade Simulator

**A free, browser-based speculative trade companion for Classic Traveller campaigns.**

🌐 **Live app:** https://code-monki.github.io/trav-trade-sim/
🛠 **Source:** https://github.com/code-monki/trav-trade-sim

---

## What Is It?

The Traveller Trade Simulator is a web tool that brings the speculative trade rules from *Classic Traveller Book 7: Merchant Prince* to life at the table. Referees and players connect to a shared campaign in real time — no installation, no accounts, no email. Just a campaign code and a PIN.

Prices shift every jump-week based on world trade codes, active market events, and a deterministic seeded engine that keeps every player's view in sync without a central server doing the rolling.

---

## For Players

- **Market tab** — See purchase and sale prices for all 36 trade goods at the current world, updated each tick. Goods affected by active events are highlighted.
- **Price charts** — Weekly, monthly, and annual candlestick charts (TradingView-style) show price history the moment you first visit a world, thanks to automatic backfill.
- **Jump tab** — Identify the most profitable destination for your cargo before you commit to a jump.
- **Cargo hold** — Track what you're carrying, what you paid, and your running profit/loss.

## For Referees

- **Market events** — Create narrative price events (shortage, trade fair, pirate blockade) with independent buy-side and sell-side modifiers, scoped to a single world or an entire subsector. Events fire automatically at random (M.U.L.E.-style) and stack with manual ones.
- **Tick control** — Advance the in-game clock with a single button. Prices recalculate, random events may fire, and monthly/annual OHLC rollups happen automatically.
- **Player management** — Manage ships, crew assignments, skills, and PIN resets from the Referee panel.
- **Full audit trail** — Every transaction and market event is logged with Imperial date stamps and price history, so players can review the tape after the session.

---

## Technical Notes

- Runs entirely in the browser (Vue 3 + Vite); backend is Supabase (PostgreSQL).
- No PII collected — identity is campaign code + character name + hashed PIN only.
- Open source under a non-commercial fan-project arrangement consistent with Mongoose Publishing's fair use policy.
- Free to use. No ads, no accounts, no data sold.

---

*Traveller is a registered trademark of Mongoose Publishing Ltd. This is an unofficial fan project and is not affiliated with or endorsed by Mongoose Publishing.*
