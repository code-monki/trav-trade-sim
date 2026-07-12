# GM Tutorial: Ship Templates, Debts & Ownership

This tutorial covers three Referee-side tools that build on top of a ship's basic stats:
reusable ship templates, per-ship debts, and joint ownership shares. All of it lives on or
near the ship's detail view in the Referee panel.

**Related tutorials:**
- Requires a ship first: [Campaign Setup → Create a Ship](./gm-campaign-setup.md#4-create-a-ship)
- Player-facing counterpart: [Fleet & Organizations](./player-fleet-organizations.md)

---

## 1. Create a Ship Template

Open the Referee panel → **Ships** tab → **Templates**.

*(Screenshot: Templates panel showing the template list and a New Template form)*

| Field | Notes |
| ----- | ----- |
| Name | Must be unique within the campaign. |
| Ruleset | CT7 or T5 — tags which edition's numbers this design uses. |
| Hull Tons / Cargo / Jump Rating / Maneuver Rating | Same fields as the ship edit form. |
| Staterooms / Low Berths / Fuel Capacity | Same fields as the ship edit form. |
| Market Value | Referee-assessed value — see [Fleet & Organizations → Check Your Net Worth](./player-fleet-organizations.md#1-check-your-net-worth). |
| Notes | Free text — flag numbers you haven't verified against the book. |

> ℹ **Note:** The first time a CT7 campaign's Templates panel is opened with none yet
> created, one starter template (a Type A Free Trader) is seeded automatically, flagged as
> unverified in its notes. T5 campaigns start with no seed.

---

## 2. Use a Template for a New Ship

Open **Ships** tab → **New Ship**. A **Template** dropdown appears at the top of the form,
defaulting to **Custom Design**.

Selecting a template pre-fills hull tons, cargo capacity, stateroom/low berth capacity, fuel
capacity, jump/maneuver rating, and market value. Every field stays editable afterward —
adjust anything, then set a name and starting credits and click **Create**.

> ℹ **Note:** There is no ongoing link between the ship and the template it came from —
> it's a one-time fill, not a live reference. Switching back to **Custom Design** clears the
> form to blank defaults.

---

## 3. Save an Existing Ship as a Template

On any existing ship's detail view, click **Save as Template** and give it a name.

This captures the ship's *current* stats as a new template — useful once you've tuned a
design in play and want to reuse it for future ships.

⚠️ **Warning:** Template names must be unique per campaign — saving with a name that's
already taken is rejected.

---

## 4. Record a Ship Debt

Expand a ship's row in the **Ships** tab and open its **Debts** section.

| Field | Notes |
| ----- | ----- |
| Type | Mortgage, Loan, or Obligation. |
| Creditor Name | Optional — who the ship owes. |
| Principal | The original amount borrowed. |
| Current Balance | What's still owed — this is what payments reduce. |
| Due Tick | Optional — a target tick for narrative pressure. |
| Notes | Free text. |

> ℹ **Note:** Debts don't accrue interest — Traveller doesn't define compounding
> mechanics, so you adjust the balance directly if the situation calls for it.

Players pay debts down themselves from their ship's Reports tab — see
[Fleet & Organizations → Pay Down a Debt](./player-fleet-organizations.md#2-pay-down-a-debt).

---

## 5. Record Ship Ownership Shares

In the same ship's detail view, open the **Ownership** section. Add a player and a
percentage share.

⚠️ **Warning:** Recorded shares for one ship can never total more than 100% — the form
rejects any addition that would push the total over.

A player with no explicit share recorded is treated as owning whatever's *left over* after
everyone else's recorded shares, not automatically 100% themselves — a ship with no
ownership rows at all still behaves as fully owned by whoever crews it.

> ℹ **Note:** This is deliberately separate from Organizations. Ship ownership here is a
> straightforward partnership you arbitrate directly, like a debt — whereas an Organization
> is something a player runs themselves. See
> [Fleet & Organizations → Found an Organization](./player-fleet-organizations.md#3-found-an-organization).

---

*Back to [Tutorial Index](./index.md)*
