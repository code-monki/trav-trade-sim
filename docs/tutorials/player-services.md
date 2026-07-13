# Player Tutorial: Passengers, Fuel & Mail

Beyond cargo trading, your ship earns income and stays operational through three additional
services: passenger transport, fuel purchasing, and Imperial mail contracts.

**Prerequisites:** A ship assigned with staterooms/berths and a fuel capacity configured
by your Referee. See [Getting Started → Find Your Ship](./player-getting-started.md#4-find-your-ship).

**Related tutorials:**
- [Your First Trade](./player-first-trade.md)
- [GM: Running a Session → Manage Passengers](./gm-running-session.md#5-manage-passengers)

---

## 1. Book Passengers

Open **Port → Passengers**. The top of the tab shows your ship's current stateroom and
low berth occupancy.

![Passengers Sub-tab](screenshots/player-passengers-tab.png)

| Field         | Notes                                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| Passage Type  | **High** / **Middle** / **Low** — and, in MgT2022 campaigns, a fourth **Basic** tier. High and Middle share staterooms; Low uses cryo-berths; Basic consumes 2 tons of general cargo space per passenger instead. |
| Count         | Number of passengers. Must not exceed available berths (or, for Basic, free cargo tons) — MgT2022 also caps this at the tick's rolled traffic-availability count for that tier. |
| Parsecs       | *T5 and MgT2022 campaigns.* Jump distance determines the fare for High, Middle, and (MgT2022 only) Basic passage. |
| Destination   | Hex and sector of the destination world. Name is optional (for your reference).    |

The **fare preview** updates as you fill in the form.

Click **Book Passengers** to confirm. The fare is **credited to the ship immediately**
and the booking appears on **Ship → Manifest**.

### Fare rates

| Passage | CT7 (per jump) | T5 (per parsec) | MgT2022 (per parsec) |
| ------- | -------------- | ---------------- | --------------------- |
| High    | Cr 10,000      | Cr 10,000/parsec  | Cr 10,000–30,000 (1–6 parsecs) |
| Middle  | Cr 8,000       | Cr 8,000/parsec   | Cr 8,000–18,000 (1–6 parsecs)  |
| Basic   | —              | —                 | Cr 2,000–7,000 (1–6 parsecs)   |
| Low     | Cr 1,000       | Cr 1,000 (flat)   | Cr 700 (flat)                  |

> ℹ **Note:** If the Book button is greyed out, either the form is incomplete, there are
> not enough free berths/cargo space, or (MgT2022) this tick's rolled traffic availability
> for that tier has been used up. Check the occupancy summary at the top of the tab.

---

## 2. Passenger Delivery

Passengers are **automatically delivered** when the ship arrives at their destination world.
Use **Jump → Select** on the destination row to trigger auto-delivery and switch to the
market at the new world simultaneously.

> ℹ Just browsing a world in the sidebar does not count as arriving — if you're looking at
> a world with a passenger, mail, or freight obligation still waiting for it, a small badge
> appears next to the zone indicator in the world header to remind you.

After delivery, passengers disappear from the Manifest tab. No extra action is required —
fare was collected at boarding.

If a passenger needs to disembark early (narrative reasons), your Referee can issue a
refund from the campaign management panel. The fare will be reversed from the ship account.

---

## 3. Purchase Fuel

Open **Port → Services**. The Fuel section shows what types of fuel are available at the
current starport, and your ship's current tank level.

![Services Fuel Section](screenshots/player-services-fuel.png)

| Starport Class | Fuel Available | Price       |
| -------------- | -------------- | ----------- |
| A, B           | Refined        | Cr 500/ton  |
| C, D           | Unrefined      | Cr 100/ton  |
| E, X           | None           | —           |

The **fill-level bar** shows current/maximum fuel. The stepper `+` button and `:max` are
capped at remaining tank space — you cannot over-fill.

Click **Fill for jump** to set the purchase to exactly the fuel required for one jump at
your ship's current jump rating (less if the tank cannot hold that much).

> ℹ **Fuel formula:** hull tons × 10% × parsecs.  
> A J-2 jump in a 200-ton ship requires 40 tons of fuel.

After purchase, credits are debited and *Current Fuel* increases on the ship record.
Your Referee manually reduces *Current Fuel* after each jump.

---

## 4. Accept a Mail Contract

Open **Port → Mail**.

![Mail Tab](screenshots/player-mail-tab.png)

| Field        | Notes                                                            |
| ------------ | ---------------------------------------------------------------- |
| Destination  | Hex and sector of the mail destination                           |
| Name         | Optional world name for display in the Contracts tab             |
| Parsecs      | *T5 campaigns only.* Sets the payment amount. MgT2022 mail instead pays per rolled container, unaffected by parsecs. |

MgT2022 campaigns also show this tick's rolled container count — mail is only offered when
the world's roll succeeds, and acceptance is take-all-or-none for that count.

The **payment preview** shows the amount you will receive on delivery:

| Rules   | Payment                             |
| ------- | ------------------------------------ |
| CT7     | Cr 25,000 flat                       |
| T5      | Cr 25,000/parsec                     |
| MgT2022 | Cr 25,000 × rolled container count   |

Click **Accept Mail Contract**. The contract appears on **Ship → Contracts**.
**No credits are transferred yet** — payment is on delivery only.

> ℹ **MgT2022 Freight:** Bulk cargo lots (Major/Minor/Incidental) are a separate,
> MgT2022-only system with their own **Port → Freight** tab, covered below.

---

## 6. Book Freight (MgT2022 only)

Open **Port → Freight** — visible only in MgT2022 campaigns. Pick a lot size, tonnage,
parsecs, and a destination:

| Field       | Notes                                                                          |
| ----------- | ------------------------------------------------------------------------------- |
| Lot Size    | **Major**, **Minor**, or **Incidental** — smaller lots pay a higher rate per ton. |
| Tons        | Capped by free cargo space and this tick's rolled availability for that lot size. |
| Parsecs     | Sets both the rate and the delivery deadline (due tick).                         |
| Destination | Hex and sector of the delivery world.                                            |

The charge is **collected upfront**, like passenger fares. The lot appears in
**Ship → Aboard → Freight in Transit** with its due tick.

Freight auto-delivers on arrival, the same as passengers and mail. Arriving **after** the
due tick applies a randomized late-delivery penalty — a portion of the already-collected
charge is deducted from the ship's credits at that point. Arriving on time costs nothing
extra.

You (or your Referee) can cancel a pending freight lot for a full refund before it delivers.

---

## 5. Mail Delivery

Mail is delivered automatically when the ship arrives at the destination world, the same
way as passengers. Use **Jump → Select** or ask your Referee to move the ship.

On delivery, the payment is credited to the ship account and the contract disappears from
the Contracts tab.

Mail contracts are an Imperial obligation — there is no cancellation mechanic.

---

## 7. Track Passengers, Mail, and Freight

**Ship → Manifest** shows all passengers currently in transit:
- Passage type and count
- Destination world
- Fare collected and when they boarded

**Ship → Contracts** shows all mail contracts currently in transit:
- Origin and destination worlds
- Jump distance (parsecs)
- Payment due on delivery
- Total pending payment footer

**Ship → Aboard → Freight in Transit** (MgT2022 only) shows all freight lots currently in
transit: lot size, tonnage, destination, charge already collected, and due tick.

---

*Back: [Your First Trade](./player-first-trade.md) · Next: [Route Analysis](./player-route-analysis.md)*
