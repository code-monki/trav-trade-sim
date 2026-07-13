// Tutorial content for the in-app TutorialDialog.
// Cross-references use: <a href="#" data-tut="tutorial-id" data-sec="section-id">text</a>
// Screenshot callouts use: <div class="tut-shot">📸 description</div>

export const TUTORIAL_GROUPS = [
  { role: 'GM',     ids: ['gm-campaign-setup', 'gm-running-session', 'gm-ship-templates-debts-ownership'] },
  { role: 'Player', ids: ['player-getting-started', 'player-first-trade', 'player-services', 'player-route-analysis', 'player-fleet-organizations'] },
]

export const TUTORIALS = [
  // ── GM: Campaign Setup ──────────────────────────────────────────────────────
  {
    id: 'gm-campaign-setup',
    title: 'Campaign Setup',
    role: 'GM',
    sections: [
      {
        id: 'before-you-start',
        title: 'Before You Start',
        body: `
<p>This tutorial walks through creating a campaign, saving your recovery code, inviting
players, and creating the first ship and crew. At the end your players will be ready to
trade.</p>
<p>Decide in advance:</p>
<ul>
  <li>A unique <strong>campaign code</strong> players can type, e.g. <code>SPINWARD-42</code></li>
  <li><strong>Trade rules</strong> — CT7 (Classic Traveller Book 7), T5 (Traveller 5th Edition), or
      MgT2022 (Mongoose Traveller 2022). Cannot be changed after creation.</li>
  <li><strong>Starting Imperial date</strong> — year and day (default: Year 1105, Day 1)</li>
</ul>
<p>Player join instructions are in
<a href="#" data-tut="player-getting-started" data-sec="join-campaign">Getting Started → Join the Campaign</a>.</p>
`
      },
      {
        id: 'create-campaign',
        title: '1. Create the Campaign',
        body: `
<p>Open the app and click the <strong>New Campaign</strong> tab on the login screen.</p>
<div class="tut-shot">📸 New Campaign form showing all required fields</div>
<table class="tut-table">
  <thead><tr><th>Field</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>Campaign Name</td><td>Human-readable label, e.g. "Spinward Marches Run"</td></tr>
    <tr><td>Campaign Code</td><td>Uppercase, no spaces. Share this with players. Auto-uppercased as you type.</td></tr>
    <tr><td>Milieu</td><td>Imperial era. Defaults to 1105 (Third Imperium classic).</td></tr>
    <tr><td>Trade Rules</td><td>CT7, T5, or MgT2022. <strong>Cannot be changed after creation.</strong></td></tr>
    <tr><td>Starting Date</td><td>Imperial year and day (1–365). Week is derived automatically (day ÷ 7, rounded up).</td></tr>
    <tr><td>Your Character Name</td><td>Your Referee character's name. Must be unique in the campaign.</td></tr>
    <tr><td>PIN</td><td>Minimum 4 characters. <strong>Cannot be changed.</strong> Save it somewhere safe.</td></tr>
  </tbody>
</table>
<p>Click <strong>Create Campaign</strong>. If the code is already in use you will be
prompted to choose a different one.</p>
`
      },
      {
        id: 'recovery-code',
        title: '2. Save the Recovery Code',
        body: `
<p>After creation, a one-time <strong>Recovery Code</strong> is displayed.
<strong>Save it now</strong> — it is shown only once and cannot be retrieved later.</p>
<div class="tut-shot">📸 Recovery Code dialog with the code prominently displayed</div>
<p class="tut-warn">⚠ If this code is lost you will need to generate a new one from the Referee
panel → Campaign tab. Generating a new code immediately invalidates the old one.</p>
<p>The recovery code lets you (or a locked-out player) reset any character's PIN from the
<strong>Reset PIN</strong> tab on the login screen, without knowing the old PIN. See
<a href="#" data-tut="gm-running-session" data-sec="reset-pin">Running a Session → Reset a PIN</a>
for the full procedure.</p>
<p>Dismiss the dialog to enter the main map. You are now signed in as Referee.</p>
`
      },
      {
        id: 'invite-players',
        title: '3. Invite Players',
        body: `
<p>Share the <strong>campaign code</strong> with your players (e.g. "SPINWARD-42"). They
enter it on the <strong>Join Campaign</strong> tab of the login screen, along with a
character name they choose and a PIN they set themselves.</p>
<p class="tut-note">ℹ Character names must be unique within the campaign and cannot be changed
after joining. Remind players to choose carefully.</p>
<p>Players create their own PINs — you never see them. If a player is locked out, use the
recovery code to reset their PIN. Full player instructions:
<a href="#" data-tut="player-getting-started" data-sec="join-campaign">Getting Started → Join the Campaign</a>.</p>
`
      },
      {
        id: 'create-ship',
        title: '4. Create a Ship',
        body: `
<p>Open the hamburger menu (≡) in the top-right corner and click
<strong>Manage Campaign</strong>. This opens the Referee panel.</p>
<p>Click the <strong>Ships</strong> tab, then <strong>New Ship</strong>.</p>
<div class="tut-shot">📸 Ships tab with the New Ship form open</div>
<table class="tut-table">
  <thead><tr><th>Field</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>Name</td><td>Ship name, e.g. "Free Trader Beowulf"</td></tr>
    <tr><td>Hull Type</td><td>Class designation, e.g. "Type-A Free Trader"</td></tr>
    <tr><td>Hull Tons</td><td>Total displacement in tons. Used to compute jump fuel (10% per parsec).</td></tr>
    <tr><td>Cargo Tons</td><td>Available hold — constrains how much players can buy</td></tr>
    <tr><td>Jump Rating</td><td>Maximum parsecs per jump; sets the default in the Jump tab</td></tr>
    <tr><td>Staterooms</td><td>Number of High/Middle passenger berths available</td></tr>
    <tr><td>Low Berths</td><td>Number of Low passage cryo-berths</td></tr>
    <tr><td>Fuel Capacity (t)</td><td>Total fuel tank size. Leave 0 if not tracking fuel.</td></tr>
    <tr><td>Current Fuel (t)</td><td>Fuel already aboard when the ship enters play</td></tr>
    <tr><td>Credits</td><td>Starting ship's treasury</td></tr>
  </tbody>
</table>
<p>Click <strong>Create</strong>. The ship appears in the ships list.</p>
<p class="tut-note">ℹ All capacity fields can be changed later from the ship edit form. Fuel is not
consumed automatically — decrease <em>Current Fuel</em> manually after each jump.</p>
<p>For a repeatable design you'll create again, or once you have a ship whose stats you want
to reuse, see
<a href="#" data-tut="gm-ship-templates-debts-ownership" data-sec="create-template">Ship Templates, Debts &amp; Ownership → Create a Ship Template</a>.</p>
`
      },
      {
        id: 'assign-crew',
        title: '5. Assign Crew',
        body: `
<p>In the <strong>Ships</strong> tab, expand the ship row to see the crew section.
Click <strong>Add Crew</strong> and select a player character.</p>
<p>Each crew member has a <strong>role</strong> and a <strong>Can Trade</strong> flag:</p>
<ul>
  <li><strong>Captain</strong> — receives <em>Can Trade</em> automatically</li>
  <li><strong>Pilot, Engineer, Medic, Gunner, Steward, Other</strong> — do not receive
      <em>Can Trade</em> by default; check the checkbox for each character who needs it</li>
</ul>
<p>Only characters with <em>Can Trade</em> can buy and sell cargo. If a player reports that
the Buy button is missing or Sell is disabled, check this flag in the crew row.</p>
<p>A character can only serve on one ship at a time. Remove them from the current ship before
assigning them to another.</p>
<p>Once crew are assigned and <em>Can Trade</em> is set, they are ready to trade. Next:
<a href="#" data-tut="player-first-trade" data-sec="read-market">Player: First Trade → Read the Market</a>.</p>
`
      }
    ]
  },

  // ── GM: Running a Session ───────────────────────────────────────────────────
  {
    id: 'gm-running-session',
    title: 'Running a Session',
    role: 'GM',
    sections: [
      {
        id: 'session-flow',
        title: 'Typical Session Flow',
        body: `
<p>Each session generally follows this rhythm:</p>
<ol>
  <li>Players select worlds, open Port → Market, and buy cargo or book passengers</li>
  <li>Players purchase fuel at Port → Services if the tank is low</li>
  <li>Players accept mail contracts at Port → Mail for additional income</li>
  <li>Players use the Jump tab to pick a profitable destination</li>
  <li>You advance the tick (<strong>Advance Tick ›</strong> in the header or press <kbd>T</kbd>)</li>
  <li>Prices shift; random events may fire on next world visits</li>
  <li>Players navigate to the destination — passengers and mail auto-deliver on arrival</li>
  <li>Players sell their cargo at the destination</li>
  <li>Repeat from step 1</li>
</ol>
<p>You can create market events manually at any time to add narrative flavor. Random events
also fire automatically on a world's first Market tab visit each tick.</p>
`
      },
      {
        id: 'advance-tick',
        title: '1. Advance the Tick',
        body: `
<p>Click <strong>Advance Tick ›</strong> in the header, or press <kbd>T</kbd>.
One tick = one jump-week = 7 Imperial days.</p>
<p>What happens automatically on tick advance:</p>
<ul>
  <li>Prices are recalculated for all worlds using CT7/T5/MgT2022 rules</li>
  <li>Market events that have reached their expiry tick are closed automatically</li>
  <li>A random event may fire on the next world visit (one per world per tick, M.U.L.E.-style)</li>
  <li>Monthly OHLC candlestick rollup triggers every 4 ticks</li>
  <li>Annual rollup and event compaction triggers every 48 ticks</li>
</ul>
<p class="tut-note">ℹ Only the Referee can advance the tick. All players see the current
date in the header but cannot advance it.</p>
`
      },
      {
        id: 'create-events',
        title: '2. Create Market Events',
        body: `
<p>Open the Referee panel → <strong>Events</strong> tab → <strong>New Event</strong>.</p>
<div class="tut-shot">📸 Events tab with the New Event form showing all fields</div>
<table class="tut-table">
  <thead><tr><th>Field</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>Scope</td><td><em>Local</em> — affects one world. <em>Subsector</em> — affects all worlds in the subsector.</td></tr>
    <tr><td>World</td><td>Which world (for Local scope)</td></tr>
    <tr><td>Trade Good</td><td>Specific good affected, or <em>All Goods</em></td></tr>
    <tr><td>Buy modifier %</td><td>Adjusts the <em>purchase</em> price at this world — positive makes buying more expensive, negative cheaper. Leave blank for no effect on buying.</td></tr>
    <tr><td>Sell modifier %</td><td>Adjusts the <em>sale</em> price at this world — positive means players receive more when selling, negative means less. Leave blank for no effect on selling.</td></tr>
    <tr><td>Severity</td><td>Minor / Major / Crisis — controls the badge color and icon on the Market tab</td></tr>
    <tr><td>Duration (ticks)</td><td>How many ticks the event lasts. Closes automatically at that tick.</td></tr>
    <tr><td>Description</td><td>Narrative text shown in the Market tab banner and Events history</td></tr>
  </tbody>
</table>
`
      },
      {
        id: 'events-catalogue',
        title: '3. Use the Events Catalogue',
        body: `
<p>The Referee panel → <strong>Events</strong> tab includes a <strong>Catalogue</strong>
section — 20 pre-built M.U.L.E.-style events ranging from shortages and surpluses to
piracy and industrial accidents.</p>
<p>Click any catalogue entry to pre-fill the <strong>New Event</strong> form below it.
Review and adjust the fields (especially scope and which world), then click
<strong>Create Event</strong> to activate it.</p>
<p>You can also create events from scratch — the catalogue is just a time-saving shortcut
for common scenarios.</p>
`
      },
      {
        id: 'expire-events',
        title: '4. Expire Events Early',
        body: `
<p>In the Referee panel → Events tab, each active event has an <strong>Expire</strong> button.
Click it to end the event immediately, regardless of its original duration.</p>
<p>Expired events remain visible in the world's <strong>Events</strong> tab (dimmed) so
players can see the price history context. Use early expiry when a narrative situation
resolves ahead of schedule.</p>
`
      },
      {
        id: 'manage-passengers',
        title: '5. Manage Passengers',
        body: `
<p>When players book passengers, they appear in the Referee panel → <strong>Ships</strong>
tab → expand ship → passenger manifest section. Each row shows the passenger type, count,
destination, and booked fare.</p>
<p>Passengers are <strong>automatically delivered</strong> when you move the ship to their
destination via the ship edit form. You can also let players trigger delivery themselves
by using the Jump tab.</p>
<p>To issue a refund: click <strong>Refund</strong> on a manifest row. This sets the
passenger status to <em>refunded</em>, reverses the fare credit from the ship account,
and records a refund transaction. Use this when passengers disembark early or an
in-game event requires compensation.</p>
<p class="tut-warn">⚠ Refunds cannot be undone. The fare is debited from the ship's
current credit balance.</p>
`
      },
      {
        id: 'track-fuel',
        title: '6. Track Fuel',
        body: `
<p>Each ship has a <strong>Fuel Capacity</strong> (tank size) and <strong>Current Fuel</strong>
(current level). Both are visible in the ship stat grid and editable in the ship edit form.</p>
<p>Fuel is <strong>not consumed automatically</strong> — you must manually reduce
<em>Current Fuel</em> in the ship edit form after each jump. The formula for jump fuel is:</p>
<p class="tut-note">ℹ Fuel = hull tons × 10% × parsecs. Example: a J-2 jump in a 200-ton
ship uses 40 tons of fuel.</p>
<p>Players purchase fuel at starports via Port → Services. The purchase automatically
increments <em>Current Fuel</em> (and is capped at remaining tank space, preventing
over-filling).</p>
`
      },
      {
        id: 'manage-players',
        title: '7. Manage Players',
        body: `
<p>The Referee panel → <strong>Players</strong> tab lists every character with their current
ship assignment and skill list.</p>
<p>Skills are free-form text. Trade-relevant skills include:
<strong>Broker, Trader, Liaison, Admin, Steward, Streetwise</strong>.
Skills are reference data — they do not automatically modify prices in the current version.</p>
<p>To add a skill: click the character's row, then enter a skill name and level. Remove
a skill with the × button on the skill chip.</p>
`
      },
      {
        id: 'edit-campaign-label',
        title: '8. Edit the Campaign Label',
        body: `
<p>The campaign display name can be changed at any time. Open the Referee panel →
<strong>Campaign</strong> tab. Click the <strong>✎</strong> (edit) button next to the
campaign name, type the new label, and press <strong>Save</strong> or hit Enter.</p>
<p class="tut-note">ℹ Only the label changes — the campaign code, trade rules, and milieu
are locked at creation and cannot be modified.</p>
`
      },
      {
        id: 'reset-pin',
        title: '9. Reset a Player\'s PIN',
        body: `
<p>If a player forgets their PIN:</p>
<ol>
  <li>Go to the login screen → <strong>Reset PIN</strong> tab</li>
  <li>Enter the <strong>Campaign Code</strong>, the player's <strong>Character Name</strong>,
      and the campaign's <strong>Recovery Code</strong></li>
  <li>Enter and confirm a new PIN for that character</li>
  <li>Click <strong>Reset PIN</strong></li>
</ol>
<p>The player can then sign in with the new PIN. Character names are case-sensitive.</p>
<p class="tut-note">ℹ To generate a new recovery code: Referee panel → Campaign tab →
<strong>Generate New Recovery Code</strong>. This immediately invalidates any previous code.
The code used at campaign creation is at
<a href="#" data-tut="gm-campaign-setup" data-sec="recovery-code">Campaign Setup → Save the Recovery Code</a>.</p>
`
      },
      {
        id: 'delete-campaign',
        title: '10. Delete a Campaign',
        body: `
<p>The <strong>Danger Zone</strong> section at the bottom of the Referee panel →
<strong>Campaign</strong> tab lets you permanently delete the campaign. This removes all
associated data — ships, cargo, market history, players, events, and trade records —
and <strong>cannot be undone</strong>.</p>
<p>Click <strong>Delete Campaign…</strong> to reveal the confirmation form, enter your
Referee PIN, and click <strong>Confirm Delete</strong>. You will be signed out and
returned to the login screen. The campaign code is freed for reuse.</p>
<p class="tut-warn">⚠ An incorrect PIN in the confirmation form shows an error and does
not delete anything — there's no accidental-deletion risk from a mistyped PIN.</p>
`
      }
    ]
  },

  // ── GM: Ship Templates, Debts & Ownership ───────────────────────────────────
  {
    id: 'gm-ship-templates-debts-ownership',
    title: 'Ship Templates, Debts & Ownership',
    role: 'GM',
    sections: [
      {
        id: 'before-you-start',
        title: 'Before You Start',
        body: `
<p>This tutorial covers four Referee-side tools that build on top of a ship's basic stats:
reusable ship templates, per-ship debts, and joint ownership shares. All of it lives on or
near the ship's detail view in the Referee panel.</p>
<p>You'll need at least one ship already created — see
<a href="#" data-tut="gm-campaign-setup" data-sec="create-ship">Campaign Setup → Create a Ship</a>
if you haven't made one yet.</p>
`
      },
      {
        id: 'create-template',
        title: '1. Create a Ship Template',
        body: `
<p>Open the Referee panel → <strong>Ships</strong> tab → <strong>Templates</strong>.</p>
<div class="tut-shot">📸 Templates panel showing the template list and a New Template form</div>
<table class="tut-table">
  <thead><tr><th>Field</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>Name</td><td>Must be unique within the campaign.</td></tr>
    <tr><td>Ruleset</td><td>CT7, T5, or MgT2022 — tags which edition's numbers this design uses.</td></tr>
    <tr><td>Hull Tons / Cargo / Jump Rating / Maneuver Rating</td><td>Same fields as the ship edit form.</td></tr>
    <tr><td>Staterooms / Low Berths / Fuel Capacity</td><td>Same fields as the ship edit form.</td></tr>
    <tr><td>Market Value</td><td>Referee-assessed value — see
        <a href="#" data-tut="player-fleet-organizations" data-sec="check-net-worth">Fleet &amp; Organizations → Check Your Net Worth</a>.</td></tr>
    <tr><td>Notes</td><td>Free text — use it to flag numbers you haven't verified against the book.</td></tr>
  </tbody>
</table>
<p class="tut-note">ℹ The first time a CT7 or MgT2022 campaign's Templates panel is opened with none yet
created, one starter template (a Type A Free Trader) is seeded automatically, flagged as
unverified in its notes. T5 campaigns start with no seed.</p>
`
      },
      {
        id: 'use-template',
        title: '2. Use a Template for a New Ship',
        body: `
<p>Open <strong>Ships</strong> tab → <strong>New Ship</strong>. A <strong>Template</strong>
dropdown appears at the top of the form, defaulting to <strong>Custom Design</strong>.</p>
<p>Selecting a template pre-fills hull tons, cargo capacity, stateroom/low berth capacity,
fuel capacity, jump/maneuver rating, and market value. Every field stays editable afterward —
adjust anything, then set a name and starting credits and click <strong>Create</strong>.</p>
<p class="tut-note">ℹ There is no ongoing link between the ship and the template it came
from — it's a one-time fill, not a live reference. Switching back to
<strong>Custom Design</strong> clears the form to blank defaults.</p>
`
      },
      {
        id: 'save-as-template',
        title: '3. Save an Existing Ship as a Template',
        body: `
<p>On any existing ship's detail view, click <strong>Save as Template</strong> and give it a
name.</p>
<p>This captures the ship's <em>current</em> stats as a new template — useful once you've
tuned a design in play and want to reuse it for future ships.</p>
<p class="tut-warn">⚠ Template names must be unique per campaign — saving with a name
that's already taken is rejected.</p>
`
      },
      {
        id: 'record-debt',
        title: '4. Record a Ship Debt',
        body: `
<p>Expand a ship's row in the <strong>Ships</strong> tab and open its <strong>Debts</strong>
section.</p>
<table class="tut-table">
  <thead><tr><th>Field</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>Type</td><td>Mortgage, Loan, or Obligation.</td></tr>
    <tr><td>Creditor Name</td><td>Optional — who the ship owes.</td></tr>
    <tr><td>Principal</td><td>The original amount borrowed.</td></tr>
    <tr><td>Current Balance</td><td>What's still owed — this is what payments reduce.</td></tr>
    <tr><td>Due Tick</td><td>Optional — a target tick for narrative pressure.</td></tr>
    <tr><td>Notes</td><td>Free text.</td></tr>
  </tbody>
</table>
<p class="tut-note">ℹ Debts don't accrue interest — Traveller doesn't define compounding
mechanics, so you adjust the balance directly if the situation calls for it.</p>
<p>Players pay debts down themselves from their ship's Reports tab — see
<a href="#" data-tut="player-fleet-organizations" data-sec="pay-down-debt">Fleet &amp; Organizations → Pay Down a Debt</a>.</p>
`
      },
      {
        id: 'record-ownership',
        title: '5. Record Ship Ownership Shares',
        body: `
<p>In the same ship's detail view, open the <strong>Ownership</strong> section. Add a
player and a percentage share.</p>
<p class="tut-warn">⚠ Recorded shares for one ship can never total more than 100% — the
form rejects any addition that would push the total over.</p>
<p>A player with no explicit share recorded is treated as owning whatever's <em>left
over</em> after everyone else's recorded shares, not automatically 100% themselves — a ship
with no ownership rows at all still behaves as fully owned by whoever crews it.</p>
<p class="tut-note">ℹ This is deliberately separate from Organizations. Ship ownership here
is a straightforward partnership you arbitrate directly, like a debt — whereas an
Organization is something a player runs themselves. See
<a href="#" data-tut="player-fleet-organizations" data-sec="found-organization">Fleet &amp; Organizations → Found an Organization</a>.</p>
`
      }
    ]
  },

  // ── Player: Getting Started ─────────────────────────────────────────────────
  {
    id: 'player-getting-started',
    title: 'Getting Started',
    role: 'Player',
    sections: [
      {
        id: 'what-you-need',
        title: 'Before You Start',
        body: `
<p>To join a campaign you need three things from your Referee:</p>
<ul>
  <li>The <strong>campaign code</strong>, e.g. <code>SPINWARD-42</code></li>
</ul>
<p>You choose yourself:</p>
<ul>
  <li>A <strong>character name</strong> — must be unique within the campaign</li>
  <li>A <strong>PIN</strong> of at least 4 characters</li>
</ul>
<p class="tut-warn">⚠ Your character name and PIN <strong>cannot be changed after joining</strong>.
If you forget your PIN, ask your Referee to reset it using the campaign's recovery code.
See <a href="#" data-tut="gm-running-session" data-sec="reset-pin">GM: Running a Session → Reset a Player's PIN</a>.</p>
`
      },
      {
        id: 'join-campaign',
        title: '1. Join the Campaign',
        body: `
<p>Open the app and click the <strong>Join Campaign</strong> tab on the login screen.</p>
<div class="tut-shot">📸 Join Campaign tab with the three input fields</div>
<ol>
  <li>Enter the <strong>Campaign Code</strong> exactly as given by your Referee
      (not case-sensitive).</li>
  <li>Enter your <strong>Character Name</strong>.</li>
  <li>Choose and confirm your <strong>PIN</strong>.</li>
  <li>Click <strong>Join Campaign</strong>.</li>
</ol>
<p>If your character name is already taken in this campaign, choose a different one.
Once you are in, you will go directly to the main map.</p>
<p>On future visits, use the <strong>Sign In</strong> tab with the same campaign code,
character name, and PIN.</p>
`
      },
      {
        id: 'navigate-interface',
        title: '2. Navigate the Interface',
        body: `
<p>The main screen has two areas: a <strong>left sidebar</strong> and a
<strong>right detail panel</strong>.</p>
<div class="tut-shot">📸 Main map view showing the sidebar and the world detail panel side by side</div>
<p><strong>Left sidebar</strong></p>
<ul>
  <li><em>Sector dropdown</em> — select the region of space you are operating in</li>
  <li><em>World list</em> — all worlds in that sector; click one to open it in the detail panel</li>
  <li>Use the filter box above the world list to search by name or hex coordinate</li>
</ul>
<p><strong>Right detail panel — top-level tabs</strong></p>
<ul>
  <li><strong>Overview</strong> (<kbd>O</kbd>) — world characteristics, UWP, trade codes</li>
  <li><strong>Port</strong> (<kbd>M</kbd> for Market) — port services; sub-tabs below</li>
  <li><strong>Ship</strong> (<kbd>C</kbd> for Cargo) — your ship; sub-tabs below</li>
  <li><strong>Events</strong> (<kbd>E</kbd>) — market event history for this world</li>
  <li><strong>Jump</strong> (<kbd>J</kbd>) — worlds reachable within your ship's jump range</li>
</ul>
<p><strong>Port sub-tabs</strong> (appear when Port is selected)</p>
<ul>
  <li><strong>Market</strong> — current buy/sell prices for all trade goods</li>
  <li><strong>Passengers</strong> — book passenger berths</li>
  <li><strong>Mail</strong> — accept mail contracts</li>
  <li><strong>Services</strong> — purchase fuel</li>
  <li><strong>Freight</strong> (MgT2022 only) — book bulk cargo lots</li>
</ul>
<p><strong>Ship sub-tabs</strong> (appear when Ship is selected)</p>
<ul>
  <li><strong>Cargo</strong> — your ship's hold and running trade ledger</li>
  <li><strong>Manifest</strong> — passengers currently in transit</li>
  <li><strong>Contracts</strong> — mail contracts in transit</li>
</ul>
<p>Keyboard shortcuts switch tabs when no input field is focused. Press <kbd>?</kbd> to
open Help at any time.</p>
`
      },
      {
        id: 'world-overview',
        title: '3. Read the World Overview',
        body: `
<p>With a world selected, the <strong>Overview</strong> tab shows characteristics decoded
from the world's <strong>UWP</strong> (Universal World Profile). Key fields for traders:</p>
<ul>
  <li><strong>Starport</strong> — A/B = full facilities; C/D = limited; E = frontier; X = none.
      Better starports generally yield better trade prices and larger quantities.</li>
  <li><strong>Tech Level</strong> — higher-tech worlds produce and consume different goods.</li>
  <li><strong>Trade Codes</strong> — Ag, In, Ri, Po, etc. These drive price modifiers for
      specific goods per the CT7/T5/MgT2022 trade tables.</li>
  <li><strong>Travel Zone</strong> — Amber = caution; Red = interdicted.
      The world list highlights these in colour.</li>
</ul>
<p>The UWP badge in the world header is a link to the Traveller Map for additional reference.</p>
`
      },
      {
        id: 'find-your-ship',
        title: '4. Find Your Ship',
        body: `
<p>Click the <strong>Cargo</strong> tab (<kbd>C</kbd>). If you have been assigned to a ship
by the Referee, the status bar at the top shows:</p>
<ul>
  <li>Ship name and current world location</li>
  <li>Available credits (Cr)</li>
  <li>Hold usage (used tons / total tons) and free space</li>
</ul>
<div class="tut-shot">📸 Cargo tab showing the ship status bar with name, credits, and hold stats</div>
<p>If you see "No ship assigned", ask your Referee to add you to a vessel (Referee panel →
Ships tab → Add Crew). See
<a href="#" data-tut="gm-campaign-setup" data-sec="assign-crew">Campaign Setup → Assign Crew</a>.</p>
<p>Once you have a ship, you are ready to trade. Continue to
<a href="#" data-tut="player-first-trade" data-sec="read-market">Your First Trade → Read the Market</a>.</p>
`
      }
    ]
  },

  // ── Player: Your First Trade ────────────────────────────────────────────────
  {
    id: 'player-first-trade',
    title: 'Your First Trade',
    role: 'Player',
    sections: [
      {
        id: 'trade-overview',
        title: 'Overview',
        body: `
<p>A complete trade has four steps: <strong>select a world → buy → jump → sell</strong>.
The goal is to buy goods where they are cheap and sell them where they are expensive.</p>
<p>Prerequisites:</p>
<ul>
  <li>A ship assigned with available hold space —
      see <a href="#" data-tut="player-getting-started" data-sec="find-your-ship">Getting Started → Find Your Ship</a></li>
  <li><em>Can Trade</em> authorization — if the Buy button is missing, ask your Referee</li>
  <li>A world selected in the left sidebar</li>
</ul>
`
      },
      {
        id: 'read-market',
        title: '1. Read the Market',
        body: `
<p>Select a world in the left sidebar (see
<a href="#" data-tut="player-getting-started" data-sec="navigate-interface">Getting Started → Navigate the Interface</a>)
and open the <strong>Market</strong> tab (<kbd>M</kbd>).</p>
<div class="tut-shot">📸 Market tab with multiple goods listed; some rows highlighted amber from an active event</div>
<table class="tut-table">
  <thead><tr><th>Column</th><th>What it means</th></tr></thead>
  <tbody>
    <tr><td>Plot</td><td>Tick to add this good's price history to the chart below the table</td></tr>
    <tr><td>Good</td><td>Trade good name</td></tr>
    <tr><td>Die</td><td>The d66 result that identifies this good (used in CT7/T5/MgT2022 rules)</td></tr>
    <tr><td>Buy (Cr/t)</td><td>Price per ton to purchase here <em>this week</em></td></tr>
    <tr><td>Sell (Cr/t)</td><td>Price per ton if you sell here this week</td></tr>
    <tr><td>Spread</td><td>Sell minus Buy. Positive = you could buy and sell here for a profit without jumping.</td></tr>
    <tr><td>Qty (t)</td><td>Tons available. Resets each tick — stock does not carry over.</td></tr>
  </tbody>
</table>
<p><strong>Color coding:</strong> Green = below base price (buyer's market). Red = above base
(seller's market). A good that is green here and red at your destination is a profitable trade.</p>
<p>Goods highlighted with an amber left border are affected by an active market event.
A banner above the table explains the event.</p>
`
      },
      {
        id: 'buy-cargo',
        title: '2. Buy Cargo',
        body: `
<p>Find a trade good with available quantity (Qty > 0) and click <strong>Buy</strong>
on its row. A purchase dialog opens:</p>
<div class="tut-shot">📸 Buy dialog showing price, available quantity, free hold, and a quantity input with Max button</div>
<ul>
  <li>Purchase price per ton</li>
  <li>Available quantity and your free hold space</li>
  <li>Your current credits</li>
</ul>
<p>Enter the tons you want to buy, or click <strong>Max</strong> to fill the hold with as
much as you can afford and store. Click <strong>Confirm</strong>.</p>
<p>Credits are debited immediately. The new cargo row appears in the <strong>Cargo</strong>
tab with the purchase price and source world recorded.</p>
<p class="tut-note">ℹ The Buy button only appears when you have a ship, <em>Can Trade</em>
authorization, and the good has stock. If it is missing, ask your Referee to check your
crew record.</p>
`
      },
      {
        id: 'find-destination',
        title: '3. Find a Destination',
        body: `
<p>Switch to the <strong>Jump</strong> tab (<kbd>J</kbd>). This lists all worlds reachable
from your current location within your ship's jump rating.</p>
<p>With cargo in the hold, a <strong>Profit</strong> column appears showing how much you
would make selling your entire hold at each destination. The list sorts by profit
automatically — the best destination is at the top.</p>
<p>For a full breakdown of how to use this list, see
<a href="#" data-tut="player-route-analysis" data-sec="read-route-table">Route Analysis → Reading the Route Table</a>.</p>
`
      },
      {
        id: 'complete-jump',
        title: '4. Complete the Jump',
        body: `
<p>In the <strong>Jump</strong> tab, click <strong>Select</strong> on your chosen destination.
This:</p>
<ol>
  <li>Records the destination as your ship's current world</li>
  <li>Navigates to that world in the sidebar</li>
  <li>Switches to the Market tab for the new world automatically</li>
</ol>
<p>Alternatively, navigate to the destination world manually in the sidebar, then click
<strong>Set Here</strong> in the Cargo tab status bar to update your ship's recorded
location without going through the Jump tab.</p>
<p class="tut-note">ℹ Ticks are advanced by the Referee, not automatically on a jump. Check
with your Referee about in-game time after jumping.</p>
`
      },
      {
        id: 'sell-cargo',
        title: '5. Sell at the Destination',
        body: `
<p>At the destination world, open the <strong>Cargo</strong> tab (<kbd>C</kbd>).
Each row in your hold shows:</p>
<ul>
  <li>The sell price per ton at the current world</li>
  <li>Projected profit or loss vs. what you paid (green = profit, red = loss)</li>
</ul>
<div class="tut-shot">📸 Cargo tab with a hold row showing a green profit figure and a Sell button</div>
<p>Click <strong>Sell</strong> on a row to open the confirmation. Review the total payout
and net profit, then click <strong>Confirm</strong>. Credits are added to the ship's
account and a trade record is logged automatically.</p>
<p>A brief flash in the bottom-right corner confirms the profit or loss. Repeat for each
cargo row you want to sell.</p>
<p>Once you're trading regularly, check your ship's overall standing — including any debt
or shared ownership — in
<a href="#" data-tut="player-fleet-organizations" data-sec="check-net-worth">Fleet &amp; Organizations → Check Your Net Worth</a>.</p>
`
      }
    ]
  },

  // ── Player: Passengers, Fuel & Mail ────────────────────────────────────────
  {
    id: 'player-services',
    title: 'Passengers, Fuel & Mail',
    role: 'Player',
    sections: [
      {
        id: 'services-overview',
        title: 'Overview',
        body: `
<p>Beyond cargo trading, your ship can earn income through three additional services:</p>
<ul>
  <li><strong>Passengers</strong> — fare collected upfront at embarkation; auto-delivered on arrival</li>
  <li><strong>Fuel</strong> — purchased at starports to keep the ship running</li>
  <li><strong>Mail contracts</strong> — payment on delivery; low risk, predictable income</li>
</ul>
<p>All three are found under the <strong>Port</strong> top-level tab: <strong>Passengers</strong>,
<strong>Mail</strong>, and <strong>Services</strong> (fuel) each have their own sub-tab.</p>
`
      },
      {
        id: 'book-passengers',
        title: '1. Book Passengers',
        body: `
<p>Open <strong>Port → Passengers</strong>. The booking form shows your ship's current
stateroom and low berth occupancy.</p>
<div class="tut-shot">📸 Passengers sub-tab showing capacity summary and booking form</div>
<table class="tut-table">
  <thead><tr><th>Field</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>Passage Type</td><td>High / Middle / Low. High and Middle share staterooms; Low uses cryo-berths.</td></tr>
    <tr><td>Count</td><td>Number of passengers. Must not exceed available berths.</td></tr>
    <tr><td>Parsecs</td><td>T5 and MgT2022 campaigns — jump distance determines the fare. MgT2022 also offers a fourth <strong>Basic Passage</strong> tier that consumes cargo tonnage instead of a stateroom/berth.</td></tr>
    <tr><td>Destination</td><td>Destination world hex and sector. Optional name for display.</td></tr>
  </tbody>
</table>
<p>The <strong>fare preview</strong> updates as you enter details. Click <strong>Book</strong>
to confirm. The fare is credited to the ship immediately and passengers appear on the
<strong>Ship → Manifest</strong> tab.</p>
<p class="tut-note">ℹ CT7 fares are flat per jump (High Cr10,000 · Middle Cr8,000 · Low Cr1,000).
T5 and MgT2022 fares for High and Middle (and, for MgT2022, Basic) scale with parsecs; Low is always flat.
MgT2022 campaigns also cap each tier's count against that tick's rolled traffic availability.</p>
`
      },
      {
        id: 'passenger-delivery',
        title: '2. Delivering Passengers',
        body: `
<p>Passengers are delivered automatically when the ship arrives at their destination world.
Use <strong>Jump → Select</strong> on the destination to trigger auto-delivery, or ask
your Referee to move the ship via the campaign management panel.</p>
<p class="tut-note">ℹ Just browsing a world in the sidebar does not count as arriving — if
you're looking at a world with a passenger, mail, or freight obligation still waiting for
it, a small badge appears next to the zone indicator in the world header to remind you.</p>
<p>After delivery, the passengers disappear from the Manifest tab. No extra action is
required — the fare was already collected at boarding.</p>
<p>If a passenger needs to disembark early, your Referee can issue a refund from the
campaign management panel. The fare will be reversed from the ship account.</p>
`
      },
      {
        id: 'purchase-fuel',
        title: '3. Purchase Fuel',
        body: `
<p>Open <strong>Port → Services</strong>. The Fuel section shows what types of fuel are
available at the current starport.</p>
<div class="tut-shot">📸 Services tab fuel section showing availability badges and stepper</div>
<table class="tut-table">
  <thead><tr><th>Starport</th><th>Available</th><th>Price</th></tr></thead>
  <tbody>
    <tr><td>A, B</td><td>Refined</td><td>Cr500/t</td></tr>
    <tr><td>C, D</td><td>Unrefined</td><td>Cr100/t</td></tr>
    <tr><td>E, X</td><td>None</td><td>—</td></tr>
  </tbody>
</table>
<p>The <strong>tank fill bar</strong> shows your current/maximum fuel level. The stepper
is capped at remaining tank space so you cannot over-fill.</p>
<p>Click <strong>Fill for jump</strong> to automatically set the tons to exactly what a
single jump at your ship's jump rating requires (or less, if the tank is nearly full).</p>
<p class="tut-note">ℹ Jump fuel = hull tons × 10% × parsecs. A J-2 jump in a 200t ship
uses 40 tons.</p>
`
      },
      {
        id: 'accept-mail',
        title: '4. Accept a Mail Contract',
        body: `
<p>Open <strong>Port → Mail</strong>.
Mail is an Imperial obligation — once accepted it must be delivered.</p>
<div class="tut-shot">📸 Mail tab showing destination fields and payment preview</div>
<p>Enter the <strong>destination hex</strong> and <strong>sector</strong>.
For T5 and MgT2022 campaigns, enter the <strong>parsecs</strong> (jump distance) — this sets the payment
for T5. MgT2022 mail instead pays a flat rate per rolled container and is only offered when the
world's tick roll succeeds — see the Book Freight section below for the sibling MgT2022-only
cargo-lot system.
An optional destination name helps you identify the contract later.</p>
<p>The <strong>payment preview</strong> shows what you will receive on delivery:
CT7 flat Cr25,000; T5 Cr25,000 × parsecs; MgT2022 Cr25,000 × the tick's rolled container count.</p>
<p>Click <strong>Accept Mail Contract</strong>. The contract appears on
<strong>Ship → Contracts</strong>. <strong>No credits are transferred yet</strong> —
payment is on delivery only.</p>
`
      },
      {
        id: 'mail-delivery',
        title: '5. Mail Delivery',
        body: `
<p>Mail is delivered automatically when the ship arrives at the destination world, the
same way as passengers. Use <strong>Jump → Select</strong> or ask your Referee to move
the ship.</p>
<p>On delivery, the payment is credited to the ship account and the contract disappears
from the Contracts tab.</p>
<p>Mail contracts are an Imperial obligation — there is no cancellation mechanic.</p>
`
      },
      {
        id: 'book-freight',
        title: '6. Book Freight (MgT2022 only)',
        body: `
<p>Open <strong>Port → Freight</strong> — visible only in MgT2022 campaigns. Pick a lot
size, tonnage, parsecs, and a destination.</p>
<table class="tut-table">
  <tr><th>Field</th><th>Notes</th></tr>
  <tr><td>Lot Size</td><td><strong>Major</strong>, <strong>Minor</strong>, or <strong>Incidental</strong> — smaller lots pay a higher rate per ton.</td></tr>
  <tr><td>Tons</td><td>Capped by free cargo space and this tick's rolled availability for that lot size.</td></tr>
  <tr><td>Parsecs</td><td>Sets both the rate and the delivery deadline (due tick).</td></tr>
  <tr><td>Destination</td><td>Hex and sector of the delivery world.</td></tr>
</table>
<p>The charge is <strong>collected upfront</strong>, like passenger fares. The lot appears
in <strong>Ship → Aboard → Freight in Transit</strong> with its due tick.</p>
<p>Freight auto-delivers on arrival, the same as passengers and mail. Arriving
<strong>after</strong> the due tick applies a randomized late-delivery penalty — a portion
of the already-collected charge is deducted from the ship's credits at that point. Arriving
on time costs nothing extra.</p>
<p>You (or your Referee) can cancel a pending freight lot for a full refund before it
delivers.</p>
`
      },
      {
        id: 'track-contracts',
        title: '7. Track Passengers, Mail, and Freight',
        body: `
<p><strong>Ship → Manifest</strong> shows all passengers currently in transit:</p>
<ul>
  <li>Passage type and count</li>
  <li>Destination world</li>
  <li>Fare collected and when they boarded</li>
</ul>
<p><strong>Ship → Contracts</strong> shows all mail contracts currently in transit:</p>
<ul>
  <li>Origin and destination worlds</li>
  <li>Jump distance (parsecs)</li>
  <li>Payment due on delivery</li>
  <li>Total pending payment footer</li>
</ul>
<p><strong>Ship → Aboard → Freight in Transit</strong> (MgT2022 only) shows all freight
lots currently in transit: lot size, tonnage, destination, charge already collected, and
due tick.</p>
<div class="tut-shot">📸 Contracts sub-tab showing in-transit mail contracts table</div>
<p>All lists clear an entry automatically once it's delivered.</p>
`
      }
    ]
  },

  // ── Player: Route Analysis ──────────────────────────────────────────────────
  {
    id: 'player-route-analysis',
    title: 'Route Analysis',
    role: 'Player',
    sections: [
      {
        id: 'when-to-use',
        title: 'When to Use Route Analysis',
        body: `
<p>The Jump tab gives you two views depending on whether cargo is loaded:</p>
<ul>
  <li><strong>Before buying</strong> — browse reachable worlds to understand your options;
      check starport classes; note which worlds have high sell prices on the Market tab</li>
  <li><strong>After buying</strong> — the Profit column shows the actual projected earnings
      from selling your current hold at each destination; the list sorts by profit so the
      best option is always at the top</li>
</ul>
<p>To begin, select the world you are <em>departing from</em> in the left sidebar, then
open the Jump tab. The route list is always relative to the selected world, not
necessarily your ship's recorded location.</p>
`
      },
      {
        id: 'read-route-table',
        title: '1. Reading the Route Table',
        body: `
<p>Each row represents a reachable destination:</p>
<div class="tut-shot">📸 Jump tab with several destination rows including the Profit column (some green, some red)</div>
<table class="tut-table">
  <thead><tr><th>Column</th><th>What it means</th></tr></thead>
  <tbody>
    <tr><td>World</td><td>Destination world name</td></tr>
    <tr><td>Hex</td><td>Hex coordinate in the sector grid</td></tr>
    <tr><td>Jump</td><td>Parsecs required. Must be ≤ your ship's jump rating for a direct jump.</td></tr>
    <tr><td>Port</td><td>Starport class (A–X). A and B ports offer larger quantities and generally better prices.</td></tr>
    <tr><td>Profit</td><td>Net projected profit from selling your entire hold at this world. Green = profit, red = loss. Only shown when cargo is loaded.</td></tr>
  </tbody>
</table>
<p><strong>Sort order:</strong> cargo loaded → sorted by profit (highest first). Empty hold →
sorted by jump distance then name.</p>
`
      },
      {
        id: 'adjust-range',
        title: '2. Adjust Jump Range',
        body: `
<p>The <strong>−</strong> / <strong>+</strong> stepper below the route table temporarily
overrides your ship's jump rating for planning. This does not change the ship's actual
rating or commit anything.</p>
<p>Use a higher range to scout multi-hop routes — worlds your ship cannot reach in a
single jump but that might be worth a layover at an intermediate world. Use a lower
range to focus on the nearest options only.</p>
<p class="tut-note">ℹ Clicking Select does not enforce the range check — the sim trusts
you to play within your ship's actual capabilities. Your Referee is the arbiter.</p>
`
      },
      {
        id: 'read-price-chart',
        title: '3. Use the Price Chart',
        body: `
<p>In the <strong>Market</strong> tab, check any row's <strong>Plot</strong> checkbox to
add it to the chart below the table. This shows the good's price history so you can spot
trends before buying.</p>
<p>Three time frames are available when a single good is selected:</p>
<ul>
  <li><strong>Weekly</strong> — one data point per tick; line chart of buy price. Event
      markers appear at the tick the event fired: blue circle = Minor, amber square = Major,
      red arrow = Crisis.</li>
  <li><strong>Monthly</strong> — one candlestick per Imperial month (4 ticks)</li>
  <li><strong>Annual</strong> — one candlestick per Imperial year (48 ticks)</li>
</ul>
<p>Plot multiple goods simultaneously to compare them. Drag the divider between the table
and chart to resize both panels.</p>
<div class="tut-shot">📸 Price chart showing a weekly line with event markers, alongside the market table above it</div>
`
      },
      {
        id: 'commit-jump',
        title: '4. Commit the Jump',
        body: `
<p>Click <strong>Select</strong> on the destination row. The sim will:</p>
<ol>
  <li>Update your ship's location to the destination world</li>
  <li>Select that world in the sidebar</li>
  <li>Switch to the Market tab for the new world</li>
</ol>
<p>You can now sell your cargo at the destination. See
<a href="#" data-tut="player-first-trade" data-sec="sell-cargo">Your First Trade → Sell at the Destination</a>.</p>
<p>If you navigated to the destination manually via the sidebar, use the
<strong>Set Here</strong> button in the Cargo tab status bar instead — this updates your
ship's recorded location without going through the Jump tab.</p>
`
      }
    ]
  },

  // ── Player: Fleet & Organizations ───────────────────────────────────────────
  {
    id: 'player-fleet-organizations',
    title: 'Fleet & Organizations',
    role: 'Player',
    sections: [
      {
        id: 'overview',
        title: 'Overview',
        body: `
<p>Beyond buying and selling, your ship has an overall financial standing — value, debt,
and (if it's shared) ownership shares — and you can found or join an
<strong>Organization</strong>: a corporation, confederation, or trade union that pools ships
together with a shared treasury, dues, and disbursement.</p>
<p>You'll need a ship assigned first — see
<a href="#" data-tut="player-getting-started" data-sec="find-your-ship">Getting Started → Find Your Ship</a>.</p>
`
      },
      {
        id: 'check-net-worth',
        title: '1. Check Your Net Worth',
        body: `
<p>Open <strong>Ship → Reports → Net Worth</strong>.</p>
<div class="tut-shot">📸 Net Worth tab showing Assets, Liabilities, Net Worth, and Your Share</div>
<p>Net Worth combines your ship's credits, its Referee-assessed market value, and its cargo
(valued at what you paid), minus any outstanding debt. If the ship is jointly owned — or
owned outright by an Organization — a <strong>Your Share</strong> row scales the total by
your recorded percentage.</p>
`
      },
      {
        id: 'pay-down-debt',
        title: '2. Pay Down a Debt',
        body: `
<p>Open <strong>Ship → Reports → Debts</strong>. Any debts your Referee has recorded against
the ship are listed with their current balance.</p>
<p>Enter an amount and confirm to pay it down. Ship credits and the debt's balance both
decrease by the amount paid.</p>
<p class="tut-warn">⚠ A payment is rejected if it's more than your ship's available
credits, or more than the debt's remaining balance — whichever is smaller.</p>
`
      },
      {
        id: 'found-organization',
        title: '3. Found an Organization',
        body: `
<p>Open <strong>Ship → Organizations</strong> and click <strong>+ Found Organization</strong>.</p>
<table class="tut-table">
  <thead><tr><th>Field</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>Name</td><td>Must be unique within the campaign.</td></tr>
    <tr><td>Treasury</td><td>Starting balance, in credits.</td></tr>
    <tr><td>Dues Rate</td><td>Optional flat rate — leave 0 if you don't want to charge dues yet.</td></tr>
    <tr><td>Notes</td><td>Free text.</td></tr>
  </tbody>
</table>
<p>You become the organization's first <strong>officer</strong> automatically. Any player
can found an organization — it isn't a Referee-only action.</p>
`
      },
      {
        id: 'manage-officers-members',
        title: '4. Manage Officers and Member Ships',
        body: `
<p>Expand your organization and use the <strong>Officers</strong> and
<strong>Member Ships</strong> sections. Any officer can add or remove other officers, and
add or remove member ships — there's no rank among officers.</p>
<p class="tut-warn">⚠ An organization's last officer can't be removed (the Referee can
still delete the organization outright). This avoids leaving it unmanageable.</p>
<p>When adding your own ship as a member, choose whether the organization
<strong>owns it outright</strong>. A ship can be owned outright by only one organization at
a time — marking it here when it's already claimed elsewhere is rejected.</p>
`
      },
      {
        id: 'collect-dues-disburse',
        title: '5. Collect Dues and Disburse Funds',
        body: `
<p>With a dues rate and collection frequency set (in ticks), the organization panel shows
whether dues are currently due. Nothing is collected automatically — click
<strong>Collect Dues</strong> when you're ready. Every member ship is charged the flat rate
independently; a ship without enough credits is skipped and reported, not blocked.</p>
<p class="tut-note">ℹ Collecting again before the configured interval has passed since the
last collection is rejected — this guards against accidentally double-collecting.</p>
<p><strong>Disbursement</strong> is separate and ad hoc: send funds from the treasury to any
member ship at any time, capped at the treasury's current balance.</p>
`
      },
      {
        id: 'record-equity',
        title: '6. Record Organization Equity',
        body: `
<p>In the <strong>Equity</strong> section, record a player and a percentage stake in the
organization — the same 100%-ceiling rule as ship ownership applies.</p>
<p>This matters most for ships the organization owns outright: that ship's contribution to
your personal Net Worth comes from your equity percentage <em>in the organization</em>,
not from any ownership record on the ship itself. See
<a href="#" data-tut="gm-ship-templates-debts-ownership" data-sec="record-ownership">GM: Ship Templates, Debts &amp; Ownership → Record Ship Ownership Shares</a>
for how the two compare.</p>
`
      },
      {
        id: 'view-fleet-report',
        title: '7. View the Fleet Report',
        body: `
<p>Click <strong>Show Fleet Report</strong> on the organization panel.</p>
<div class="tut-shot">📸 Fleet Report showing a per-ship breakdown and fleet-wide totals</div>
<p>This consolidates every member ship's credits, market value, cargo value, and debt into
fleet-wide totals plus an income/expense breakdown. It's visible only to the organization's
officers and the Referee, since it shows financial detail for ships you might not
personally crew.</p>
`
      }
    ]
  }
]

// Flat lookup map for quick navigation
export const TUTORIAL_MAP = Object.fromEntries(TUTORIALS.map(t => [t.id, t]))
