// Tutorial content for the in-app TutorialDialog.
// Cross-references use: <a href="#" data-tut="tutorial-id" data-sec="section-id">text</a>
// Screenshot callouts use: <div class="tut-shot">📸 description</div>

export const TUTORIAL_GROUPS = [
  { role: 'GM',     ids: ['gm-campaign-setup', 'gm-running-session'] },
  { role: 'Player', ids: ['player-getting-started', 'player-first-trade', 'player-route-analysis'] },
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
  <li><strong>Trade rules</strong> — CT7 (Classic Traveller Book 7) or T5 (Traveller 5th Edition).
      Cannot be changed after creation.</li>
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
    <tr><td>Trade Rules</td><td>CT7 or T5. <strong>Cannot be changed after creation.</strong></td></tr>
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
    <tr><td>Hull Tons</td><td>Total displacement in tons (cosmetic / reference)</td></tr>
    <tr><td>Cargo Tons</td><td>Available hold — constrains how much players can buy</td></tr>
    <tr><td>Jump Rating</td><td>Maximum parsecs per jump; sets the default in the Jump tab</td></tr>
    <tr><td>Credits</td><td>Starting ship's treasury</td></tr>
  </tbody>
</table>
<p>Click <strong>Create</strong>. The ship appears in the ships list.</p>
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
  <li>Players select worlds, open the Market tab, and buy cargo</li>
  <li>Players use the Jump tab to pick a destination</li>
  <li>You advance the tick (<strong>Advance Tick ›</strong> in the header or press <kbd>T</kbd>)</li>
  <li>Prices shift; random events may fire on next world visits</li>
  <li>Players navigate to the destination and sell their cargo</li>
  <li>Repeat</li>
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
  <li>Prices are recalculated for all worlds using CT7/T5 rules</li>
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
    <tr><td>Effect %</td><td>Price modifier — positive raises price, negative lowers it. E.g. +25 = 25% increase.</td></tr>
    <tr><td>Severity</td><td>Minor / Major / Crisis — controls the badge color and icon on the Market tab</td></tr>
    <tr><td>Duration (ticks)</td><td>How many ticks the event lasts. Closes automatically at that tick.</td></tr>
    <tr><td>Description</td><td>Narrative text shown in the Market tab banner and Events history</td></tr>
  </tbody>
</table>
`
      },
      {
        id: 'expire-events',
        title: '3. Expire Events Early',
        body: `
<p>In the Referee panel → Events tab, each active event has an <strong>Expire</strong> button.
Click it to end the event immediately, regardless of its original duration.</p>
<p>Expired events remain visible in the world's <strong>Events</strong> tab (dimmed) so
players can see the price history context. Use early expiry when a narrative situation
resolves ahead of schedule.</p>
`
      },
      {
        id: 'manage-players',
        title: '4. Manage Players',
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
        id: 'reset-pin',
        title: '5. Reset a Player\'s PIN',
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
<p><strong>Right detail panel — five tabs</strong></p>
<ul>
  <li><strong>Overview</strong> (<kbd>O</kbd>) — world characteristics, UWP, trade codes</li>
  <li><strong>Market</strong> (<kbd>M</kbd>) — current buy/sell prices for all trade goods</li>
  <li><strong>Cargo</strong> (<kbd>C</kbd>) — your ship's hold and running trade ledger</li>
  <li><strong>Events</strong> (<kbd>E</kbd>) — market event history for this world</li>
  <li><strong>Jump</strong> (<kbd>J</kbd>) — worlds reachable within your ship's jump range</li>
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
      specific goods per the CT7/T5 trade tables.</li>
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
    <tr><td>Die</td><td>The d66 result that identifies this good (used in CT7/T5 rules)</td></tr>
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
  }
]

// Flat lookup map for quick navigation
export const TUTORIAL_MAP = Object.fromEntries(TUTORIALS.map(t => [t.id, t]))
