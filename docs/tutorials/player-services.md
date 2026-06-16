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
| Passage Type  | **High** / **Middle** / **Low**. High and Middle share staterooms; Low uses cryo-berths. |
| Count         | Number of passengers. Must not exceed available berths.                            |
| Parsecs       | *T5 campaigns only.* Jump distance determines the fare for High and Middle passage. |
| Destination   | Hex and sector of the destination world. Name is optional (for your reference).    |

The **fare preview** updates as you fill in the form.

Click **Book Passengers** to confirm. The fare is **credited to the ship immediately**
and the booking appears on **Ship → Manifest**.

### Fare rates

| Passage | CT7 (per jump) | T5 (High/Middle per parsec · Low flat) |
| ------- | -------------- | --------------------------------------- |
| High    | Cr 10,000      | Cr 10,000/parsec                        |
| Middle  | Cr 8,000       | Cr 8,000/parsec                         |
| Low     | Cr 1,000       | Cr 1,000                                |

> ℹ **Note:** If the Book button is greyed out, either the form is incomplete or there are
> not enough free berths. Check the occupancy summary at the top of the tab.

---

## 2. Passenger Delivery

Passengers are **automatically delivered** when the ship arrives at their destination world.
Use **Jump → Select** on the destination row to trigger auto-delivery and switch to the
market at the new world simultaneously.

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

Scroll to the **Mail Contract** section in **Port → Services**.

![Services Mail Section](screenshots/player-services-mail.png)

| Field        | Notes                                                            |
| ------------ | ---------------------------------------------------------------- |
| Destination  | Hex and sector of the mail destination                           |
| Name         | Optional world name for display in the Contracts tab             |
| Parsecs      | *T5 campaigns only.* Sets the payment amount.                    |

The **payment preview** shows the amount you will receive on delivery:

| Rules | Payment          |
| ----- | ---------------- |
| CT7   | Cr 25,000 flat   |
| T5    | Cr 25,000/parsec |

Click **Accept Mail Contract**. The contract appears on **Ship → Contracts**.
**No credits are transferred yet** — payment is on delivery only.

---

## 5. Mail Delivery

Mail is delivered automatically when the ship arrives at the destination world, the same
way as passengers. Use **Jump → Select** or ask your Referee to move the ship.

On delivery, the payment is credited to the ship account and the contract disappears from
the Contracts tab.

Mail contracts are an Imperial obligation — there is no cancellation mechanic.

---

## 6. Track Passengers and Mail

**Ship → Manifest** shows all passengers currently in transit:
- Passage type and count
- Destination world
- Fare collected and when they boarded

**Ship → Contracts** shows all mail contracts currently in transit:
- Origin and destination worlds
- Jump distance (parsecs)
- Payment due on delivery
- Total pending payment footer

---

*Back: [Your First Trade](./player-first-trade.md) · Next: [Route Analysis](./player-route-analysis.md)*
