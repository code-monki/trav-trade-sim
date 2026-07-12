# GM Tutorial: Campaign Setup

This tutorial walks through creating a campaign, saving the recovery code, inviting
players, creating the first ship, and assigning crew. At the end your players will
be ready to trade.

**Related tutorials:**
- Players join after you set up: [Player: Getting Started → Join the Campaign](./player-getting-started.md#1-join-the-campaign)
- After crew are assigned: [Player: First Trade → Read the Market](./player-first-trade.md#1-read-the-market)

---

## Before You Start

Decide in advance:

- A unique **campaign code** players can type, e.g. `SPINWARD-42`
- **Trade rules** — CT7 (Classic Traveller Book 7) or T5 (Traveller 5th Edition).
  Cannot be changed after creation.
- **Starting Imperial date** — year and day (default: Year 1105, Day 1)

---

## 1. Create the Campaign

Open the app and click the **New Campaign** tab on the login screen.

![Log-in Screen](screenshots/gm-new-campaign-form.png)

| Field               | Notes                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| Campaign Name       | Human-readable label, e.g. "Spinward Marches Run"                                   |
| Campaign Code       | Uppercase, no spaces. Share this with players. Auto-uppercased as you type.         |
| Milieu              | Imperial era. Defaults to 1105 (Third Imperium classic).                            |
| Trade Rules         | CT7 or T5. **Cannot be changed after creation.**                                    |
| Starting Date       | Imperial year and day (1–365). Week is derived automatically (day ÷ 7, rounded up). |
| Your Character Name | Your Referee character's name. Must be unique in the campaign.                      |
| PIN                 | Minimum 4 characters. **Cannot be changed.** Save it somewhere safe.                |

Click **Create Campaign**. If the code is already in use you will be prompted to choose a
different one.

---

## 2. Save the Recovery Code

After creation, a one-time **Recovery Code** is displayed. **Save it now** — it is shown
only once and cannot be retrieved later.

![Recovery Code](screenshots/gm-recovery-code-dialog.png)

⚠️ **Warning:** If this code is lost you will need to generate a new one from the Referee panel → Campaign tab. Generating a new code immediately invalidates the old one.

The recovery code lets you (or a locked-out player) reset any character's PIN from the
**Reset PIN** tab on the login screen, without knowing the old PIN. See
[Running a Session → Reset a Player's PIN](./gm-running-session.md#9-reset-a-players-pin)
for the full procedure.

Dismiss the dialog to enter the main map. You are now signed in as Referee.

---

## 3. Invite Players

Share the **campaign code** with your players (e.g. "SPINWARD-42"). They enter it on the
**Join Campaign** tab of the login screen, along with a character name they choose and a
PIN they set themselves.

> ℹ **Note:** Character names must be unique within the campaign and cannot be changed
> after joining. Remind players to choose carefully.

Players create their own PINs — you never see them. Full player instructions:
[Player: Getting Started → Join the Campaign](./player-getting-started.md#1-join-the-campaign).

---

## 4. Create a Ship

Open the hamburger menu (≡) in the top-right corner and click **Manage Campaign**. This
opens the Referee panel.

Click the **Ships** tab, then **New Ship**.

![News Ship Tab](screenshots/gm-new-ship-tab.png)

| Field            | Notes                                                               |
| ---------------- | ------------------------------------------------------------------- |
| Name             | Ship name, e.g. "Free Trader Beowulf"                               |
| Hull Type        | Class designation, e.g. "Type-A Free Trader"                        |
| Hull Tons        | Total displacement in tons. Used to compute jump fuel (10% per parsec). |
| Cargo Tons       | Available hold — constrains how much players can buy                |
| Jump Rating      | Maximum parsecs per jump; sets the default in the Jump tab           |
| Staterooms       | Number of High/Middle passenger berths available                    |
| Low Berths       | Number of Low passage cryo-berths                                    |
| Fuel Capacity (t)| Total fuel tank size. Leave 0 if not tracking fuel.                  |
| Current Fuel (t) | Fuel already aboard when the ship enters play                       |
| Credits          | Starting ship's treasury                                            |

Click **Create**. The ship appears in the ships list.

> ℹ **Note:** All capacity fields can be changed later from the ship edit form. Fuel is not
> consumed automatically — decrease *Current Fuel* manually after each jump.

For a repeatable design you'll create again, or once you have a ship whose stats you want
to reuse, see
[Ship Templates, Debts & Ownership → Create a Ship Template](./gm-ship-templates-debts-ownership.md#1-create-a-ship-template).

---

## 5. Assign Crew

In the **Ships** tab, expand the ship row to see the crew section. Click **Add Crew**
and select a player character.

Each crew member has a **role** and a **Can Trade** flag:

| Role                                                | Can Trade by default? |
| --------------------------------------------------- | --------------------- |
| Captain                                             | Yes — automatically   |
| Pilot / Engineer / Medic / Gunner / Steward / Other | No — set manually     |

Only characters with *Can Trade* can buy and sell cargo. If a player reports that the
Buy button is missing or Sell is disabled, check this flag in the crew row.

![Crew Row Can Trade](screenshots/gm-crew-row-can-trade.png)

A character can only serve on one ship at a time. Remove them from the current ship before
assigning them to another.

Once crew are assigned and *Can Trade* is set, they are ready to trade. Continue to:
[Player: First Trade → Read the Market](./player-first-trade.md#1-read-the-market)

---

*Next: [Running a Session](./gm-running-session.md)*
