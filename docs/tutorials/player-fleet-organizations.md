# Player Tutorial: Fleet & Organizations

Beyond buying and selling, your ship has an overall financial standing — value, debt, and
(if it's shared) ownership shares — and you can found or join an **Organization**: a
corporation, confederation, or trade union that pools ships together with a shared
treasury, dues, and disbursement.

**Related tutorials:**
- Requires a ship first: [Getting Started → Find Your Ship](./player-getting-started.md#4-find-your-ship)
- Referee-side counterpart: [GM: Ship Templates, Debts & Ownership](./gm-ship-templates-debts-ownership.md)

---

## 1. Check Your Net Worth

Open **Ship → Reports → Net Worth**.

*(Screenshot: Net Worth tab showing Assets, Liabilities, Net Worth, and Your Share)*

Net Worth combines your ship's credits, its Referee-assessed market value, and its cargo
(valued at what you paid), minus any outstanding debt. If the ship is jointly owned — or
owned outright by an Organization — a **Your Share** row scales the total by your recorded
percentage.

---

## 2. Pay Down a Debt

Open **Ship → Reports → Debts**. Any debts your Referee has recorded against the ship are
listed with their current balance.

Enter an amount and confirm to pay it down. Ship credits and the debt's balance both
decrease by the amount paid.

⚠️ **Warning:** A payment is rejected if it's more than your ship's available credits, or
more than the debt's remaining balance — whichever is smaller.

---

## 3. Found an Organization

Open **Ship → Organizations** and click **+ Found Organization**.

| Field | Notes |
| ----- | ----- |
| Name | Must be unique within the campaign. |
| Treasury | Starting balance, in credits. |
| Dues Rate | Optional flat rate — leave 0 if you don't want to charge dues yet. |
| Notes | Free text. |

You become the organization's first **officer** automatically. Any player can found an
organization — it isn't a Referee-only action.

---

## 4. Manage Officers and Member Ships

Expand your organization and use the **Officers** and **Member Ships** sections. Any
officer can add or remove other officers, and add or remove member ships — there's no rank
among officers.

⚠️ **Warning:** An organization's last officer can't be removed (the Referee can still
delete the organization outright). This avoids leaving it unmanageable.

When adding your own ship as a member, choose whether the organization **owns it
outright**. A ship can be owned outright by only one organization at a time — marking it
here when it's already claimed elsewhere is rejected.

---

## 5. Collect Dues and Disburse Funds

With a dues rate and collection frequency set (in ticks), the organization panel shows
whether dues are currently due. Nothing is collected automatically — click **Collect
Dues** when you're ready. Every member ship is charged the flat rate independently; a ship
without enough credits is skipped and reported, not blocked.

> ℹ **Note:** Collecting again before the configured interval has passed since the last
> collection is rejected — this guards against accidentally double-collecting.

**Disbursement** is separate and ad hoc: send funds from the treasury to any member ship at
any time, capped at the treasury's current balance.

---

## 6. Record Organization Equity

In the **Equity** section, record a player and a percentage stake in the organization — the
same 100%-ceiling rule as ship ownership applies.

This matters most for ships the organization owns outright: that ship's contribution to
your personal Net Worth comes from your equity percentage *in the organization*, not from
any ownership record on the ship itself. See
[GM: Ship Templates, Debts & Ownership → Record Ship Ownership Shares](./gm-ship-templates-debts-ownership.md#5-record-ship-ownership-shares)
for how the two compare.

---

## 7. View the Fleet Report

Click **Show Fleet Report** on the organization panel.

*(Screenshot: Fleet Report showing a per-ship breakdown and fleet-wide totals)*

This consolidates every member ship's credits, market value, cargo value, and debt into
fleet-wide totals plus an income/expense breakdown. It's visible only to the organization's
officers and the Referee, since it shows financial detail for ships you might not
personally crew.

---

*Back to [Tutorial Index](./index.md)*
