# Player Tutorial: Getting Started

This tutorial covers joining a campaign and learning to navigate the interface.
Before you read this, ask your Referee for the campaign code.

**Related tutorials:**
- [Your First Trade](./player-first-trade.md)
- [Passengers, Fuel & Mail](./player-services.md)
- If you are locked out: [GM: Running a Session → Reset a Player's PIN](./gm-running-session.md#9-reset-a-players-pin)

---

## Before You Start

To join a campaign you need three things from your Referee:

- The **campaign code**, e.g. `SPINWARD-42`

You choose yourself:

- A **character name** — must be unique within the campaign
- A **PIN** of at least 4 characters

> ⚠ **Warning:** Your character name and PIN **cannot be changed after joining**.
> If you forget your PIN, ask your Referee to reset it using the campaign's recovery code.
> See [GM: Running a Session → Reset a Player's PIN](./gm-running-session.md#9-reset-a-players-pin).

---

## 1. Join the Campaign

Open the app and click the **Join Campaign** tab on the login screen.

![Player Join Campaign](screenshots/player-join-campaign.png)

1. Enter the **Campaign Code** exactly as given by your Referee (not case-sensitive).
2. Enter your **Character Name**.
3. Choose and confirm your **PIN**.
4. Click **Join Campaign**.

If your character name is already taken in this campaign, choose a different one.
Once you are in, you will go directly to the main map.

On future visits, use the **Sign In** tab with the same campaign code, character name,
and PIN.

---

## 2. Navigate the Interface

The main screen has two areas: a **left sidebar** and a **right detail panel**.

![Player Main View](screenshots/player-main-view.png)

**Left sidebar**

- *Sector dropdown* — select the region of space you are operating in
- *World list* — all worlds in that sector; click one to open its detail panel
- Use the filter box above the world list to search by name or hex coordinate

**Right detail panel — top-level tabs**

| Tab      | Shortcut | Content                                               |
| -------- | -------- | ----------------------------------------------------- |
| Overview | `O`      | World characteristics: UWP, trade codes, tech level   |
| Port     | `M`      | Port services (sub-tabs below)                        |
| Ship     | `C`      | Your ship (sub-tabs below)                            |
| Events   | `E`      | Market event history for this world                   |
| Jump     | `J`      | Worlds reachable within your ship's jump range        |

**Port sub-tabs** (visible when Port is selected)

| Sub-tab    | Content                                                      |
| ---------- | ------------------------------------------------------------ |
| Market     | Current buy/sell prices for all trade goods; price chart     |
| Passengers | Book High, Middle, or Low passage                            |
| Services   | Purchase fuel; accept mail contracts                         |

**Ship sub-tabs** (visible when Ship is selected)

| Sub-tab   | Content                                      |
| --------- | -------------------------------------------- |
| Cargo     | Ship's hold and running trade ledger         |
| Manifest  | Passengers currently in transit              |
| Contracts | Mail contracts in transit + pending payment  |

Keyboard shortcuts switch tabs when no input field is focused. Press `?` to open Help.

---

## 3. Read the World Overview

With a world selected, the **Overview** tab shows the world's characteristics decoded
from its **UWP** (Universal World Profile). Key fields for traders:

| Field       | Trading significance                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Starport    | A/B = full facilities; C/D = limited; E = frontier; X = none. Better starports generally yield better prices and larger quantities available. |
| Tech Level  | Higher-tech worlds produce and consume different goods.                                                                                       |
| Trade Codes | Ag, In, Ri, Po, etc. These drive price modifiers per the CT7/T5 tables.                                                                       |
| Travel Zone | Amber = caution; Red = interdicted. The world list highlights these in colour.                                                                |

The UWP badge in the world header is a link to the Traveller Map website for additional
world reference information.

---

## 4. Find Your Ship

Click the **Cargo** tab (`C`). If your Referee has assigned you to a ship, the status bar
at the top shows:

- Ship name and current world location
- Available credits (Cr)
- Hold usage (used tons / total tons) and free space

![Player Cargo No Ship Assigned](screenshots/player-cargo-no-ship-assigned.png)

![Player Cargo Tab](screenshots/player-cargo-tab.png)
If you see "No ship assigned", ask your Referee to add you to a vessel (Referee panel →
Ships tab → Add Crew). See
[Campaign Setup → Assign Crew](./gm-campaign-setup.md#5-assign-crew).

---

*Next: [Your First Trade](./player-first-trade.md) · [Passengers, Fuel & Mail](./player-services.md)*
