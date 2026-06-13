# GM Tutorial: Running a Session

**Prerequisites:** Campaign created and at least one ship assigned.
See [Campaign Setup](./gm-campaign-setup.md) if you have not done that yet.

**Related tutorials:**
- [Player: First Trade](./player-first-trade.md)
- Reset PIN procedure references [Campaign Setup → Save the Recovery Code](./gm-campaign-setup.md#save-the-recovery-code)

---

## Typical Session Flow {#typical-session-flow}

Each session generally follows this rhythm:

1. Players select worlds, open the Market tab, and buy cargo
2. Players use the Jump tab to pick a profitable destination
3. You advance the tick (**Advance Tick ›** in the header or press `T`)
4. Prices shift; random events may fire on next world visits
5. Players navigate to the destination and sell their cargo
6. Repeat from step 1

You can create market events manually at any time to add narrative flavor. Random events
also fire automatically on a world's first Market tab visit each tick.

---

## 1. Advance the Tick {#advance-the-tick}

Click **Advance Tick ›** in the header, or press `T`. One tick = one jump-week = 7 Imperial days.

> **📸 Screenshot:** `screenshots/gm-advance-tick-button.png` — Header with the
> Advance Tick button visible alongside the Imperial date display.

What happens automatically on tick advance:

- Prices are recalculated for all worlds using CT7/T5 trade rules
- Market events that have reached their expiry tick are closed automatically
- A random event may fire on the next world visit (one per world per tick, M.U.L.E.-style)
- Monthly OHLC candlestick rollup triggers every 4 ticks
- Annual rollup and event compaction triggers every 48 ticks

> ℹ **Note:** Only the Referee character can advance the tick. All players see the current
> date in the header but cannot change it.

---

## 2. Create Market Events {#create-market-events}

Open the Referee panel → **Events** tab → **New Event**.

> **📸 Screenshot:** `screenshots/gm-events-new-event-form.png` — Events tab
> with the New Event form open and all fields filled with an example.

| Field | Notes |
|---|---|
| Scope | *Local* — affects one world. *Subsector* — affects all worlds in the subsector. |
| World | Which world (for Local scope) |
| Trade Good | Specific good affected, or *All Goods* |
| Effect % | Price modifier — positive raises price, negative lowers it. E.g. +25 = 25% increase. |
| Severity | Minor / Major / Crisis — controls the badge color on the Market tab |
| Duration (ticks) | How many ticks the event lasts. Closes automatically at that tick. |
| Description | Narrative text shown in the Market tab banner and Events history |

Events fire automatically at random on a world's first Market tab visit each tick. Manual
events stack on top of the automatic ones.

---

## 3. Expire Events Early {#expire-events-early}

In the Referee panel → Events tab, each active event has an **Expire** button. Click it
to end the event immediately, regardless of its original duration.

Expired events remain visible in the world's **Events** tab (dimmed) so players can see
the historical price context. Use early expiry when a narrative situation resolves ahead
of schedule.

---

## 4. Manage Players {#manage-players}

The Referee panel → **Players** tab lists every character with their current ship
assignment and skill list.

Skills are free-form text — any name is valid. Trade-relevant skills include:
**Broker, Trader, Liaison, Admin, Steward, Streetwise**. Skills are reference data
in the current version; they do not automatically modify prices.

To add a skill: click the character's row, then type the skill name and level.
Remove a skill with the × button on the skill chip.

---

## 5. Reset a Player's PIN {#reset-a-players-pin}

If a player forgets their PIN:

1. Go to the login screen → **Reset PIN** tab
2. Enter the **Campaign Code**, the player's **Character Name**, and the campaign's
   **Recovery Code** (saved at campaign creation — see
   [Campaign Setup → Save the Recovery Code](./gm-campaign-setup.md#save-the-recovery-code))
3. Enter and confirm a new PIN for that character
4. Click **Reset PIN**

The player can then sign in with the new PIN. Character names are case-sensitive.

> ℹ **Note:** To generate a new recovery code: Referee panel → Campaign tab →
> **Generate New Recovery Code**. This immediately invalidates any previous code.

---

## 6. Delete a Campaign {#delete-a-campaign}

The **Danger Zone** section at the bottom of the Referee panel → Campaign tab lets you
permanently delete the campaign. This removes all associated data — ships, cargo, market
history, players, events, and trade records — and **cannot be undone**.

Click **Delete Campaign…** to reveal the confirmation form, enter your Referee PIN, and
click **Confirm Delete**. You will be signed out and returned to the login screen.

---

*Back: [Campaign Setup](./gm-campaign-setup.md) · Next: [Player: Getting Started](./player-getting-started.md)*
