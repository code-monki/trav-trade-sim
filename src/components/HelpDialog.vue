<template>
  <Teleport to="body">
    <div v-if="modelValue" class="overlay" @mousedown.self="close">
      <div class="dialog" role="dialog" aria-modal="true"
           aria-labelledby="help-dialog-title" ref="dialogEl">

        <div class="dialog-header" id="help-dialog-title">
          <div class="help-tabs">
            <button v-for="t in tabs" :key="t.key"
                    :class="['htab', { active: activeTab === t.key }]"
                    @click="activeTab = t.key">
              {{ t.label }}
            </button>
          </div>
          <button class="close-btn" @click="close" aria-label="Close">✕</button>
        </div>

        <!-- ── Getting Started ───────────────────────────────────────────── -->
        <div v-if="activeTab === 'start'" class="dialog-body">

          <section class="help-section">
            <h3>Overview</h3>
            <p>
              Traveller Trade Simulator is a speculative trade dashboard for Classic
              Traveller campaigns. The Referee advances the in-game clock one
              jump-week at a time; commodity prices shift with each tick based on
              world trade codes, market events, and seeded randomness. Players
              identify profitable trade routes, fill their holds, and sell high.
            </p>
          </section>

          <section class="help-section">
            <h3>Campaigns</h3>
            <p>
              Create a campaign from the login screen to receive a shareable
              campaign code. Other players join with that code and a character name.
              All accounts require a PIN. The character who creates the campaign is
              automatically assigned the Referee role.
            </p>
            <p>
              At creation a one-time <strong>Recovery Code</strong> is displayed —
              save it somewhere safe. It can be used from the <strong>Reset PIN</strong>
              login tab to reset any character's PIN in the campaign. The Referee can
              generate a new recovery code at any time from Manage Campaign → Campaign tab.
            </p>
            <p>
              Trade rules (CT7, T5, or MgT2022) and the starting milieu/year are selected at
              campaign creation and cannot be changed later.
            </p>
          </section>

          <section class="help-section">
            <h3>Navigating the Galaxy</h3>
            <p>
              Select a sector from the dropdown to load its worlds. Use the filter
              box above the sector list to search by sector name. Click any world
              in the world list to open its detail panel; filter worlds by name or
              hex coordinate. Worlds with a red or amber travel zone are highlighted
              accordingly.
            </p>
            <p>
              The world detail panel has five tabs: <strong>Overview</strong>,
              <strong>Market</strong>, <strong>Cargo</strong>,
              <strong>Events</strong>, and <strong>Jump</strong>.
            </p>
            <p>
              The UWP badge in the world header is a link to the Traveller Map for
              that world.
            </p>
          </section>

          <section class="help-section">
            <h3>Imperial Calendar</h3>
            <p>
              Time is displayed as <code>DDD-YYYY</code> (day of year – year).
              1 tick = 1 jump-week (7 days). There are 4 ticks per Imperial month
              and 48 ticks per Imperial year. The campaign's starting year is set
              by the Referee at creation; the default is 1105.
            </p>
          </section>

        </div>

        <!-- ── Trading ───────────────────────────────────────────────────── -->
        <div v-if="activeTab === 'trading'" class="dialog-body">

          <section class="help-section">
            <h3>The Cargo Tab</h3>
            <p>
              The <strong>Cargo</strong> tab (keyboard <kbd>C</kbd>) shows your
              ship's status and everything currently in the hold. The status bar
              displays ship name, available credits, and hold usage in tons.
            </p>
            <p>
              Each cargo row shows the good name, tonnage, purchase price per ton,
              the <strong>Source</strong> world (hex and name, e.g.
              <code>1910-Regina</code>), current sell price at the selected world,
              and projected profit or loss. Select a destination in the world list
              to see sell prices before committing to a sale.
            </p>
          </section>

          <section class="help-section">
            <h3>Buying Cargo</h3>
            <p>
              Go to the <strong>Market</strong> tab. Each trade good row has a
              <strong>Buy</strong> button on the right — click it to open the
              purchase dialog directly. The button is only shown when you have a
              ship assigned and trading authorization; it is disabled for goods
              with no stock available.
            </p>
            <p>
              The dialog shows the purchase price, available quantity, your free
              hold space, and your current credits. Enter the number of tons (or
              click <strong>Max</strong>) and confirm. Credits are debited from
              the ship's account immediately.
            </p>
          </section>

          <section class="help-section">
            <h3>Selling Cargo</h3>
            <p>
              Select the destination world in the world list, then open the
              <strong>Cargo</strong> tab. Each item in the hold shows the sell
              price at the current world and the projected profit or loss. Click
              <strong>Sell</strong> on any row, review the confirmation, then click
              <strong>Confirm</strong>. Credits are credited to the ship's account
              and a trade record is logged automatically.
            </p>
          </section>

          <section class="help-section">
            <h3>Trading Authorization</h3>
            <p>
              Only crew members with the <strong>Can Trade</strong> flag set by
              the Referee may buy or sell cargo. Captains receive this flag
              automatically when assigned or promoted. Other crew members must be
              granted it explicitly in the Referee panel (Ships tab → crew row →
              Can Trade checkbox).
            </p>
            <p>
              If the Buy button is not visible or the Sell button is disabled,
              ask your Referee to check your trading authorization.
            </p>
          </section>

          <section class="help-section">
            <h3>Passengers</h3>
            <p>
              Book passengers at the <strong>Port &gt; Passengers</strong> tab —
              choose High, Middle, or Low passage (MgT2022 campaigns add a fourth
              tier, <strong>Basic Passage</strong>), a passenger count, and a
              destination. The booking form checks that enough stateroom or low
              berth capacity is free before accepting it — Basic Passage instead
              checks general cargo space, since it has no dedicated berth.
            </p>
            <p>
              Fares are collected up front: CT7 charges a flat rate per passenger
              regardless of distance; T5 and MgT2022 charge per parsec for High
              and Middle passage (MgT2022 also scales Basic by parsec), and a flat
              rate for Low. Passengers deliver themselves automatically — and
              their fare is already paid — when the ship arrives at their
              destination. The Ship &gt; Aboard tab shows current occupancy and
              everyone still in transit. The Referee can issue a refund for any
              in-transit passenger from the Referee panel.
            </p>
          </section>

          <section class="help-section">
            <h3>Fuel &amp; Mail Contracts</h3>
            <p>
              The <strong>Port &gt; Services</strong> tab has two sections. Fuel
              availability and price depend on the world's starport class:
              refined fuel at Class A/B starports, unrefined at Class C/D, and no
              commercial fuel at all at Class E/X. Purchases are capped at the
              ship's remaining tank space; the <strong>Fill for jump</strong>
              button computes the tons needed for one jump at your ship's jump
              rating and purchases them immediately.
            </p>
            <p>
              Mail contracts are accepted the same way — pick a destination (and,
              for T5, a parsec count) and accept. There's no upfront payment;
              like passengers, a mail contract pays out and clears itself
              automatically the moment the ship arrives at its destination. The
              Ship &gt; Aboard tab lists any contracts still in transit.
            </p>
            <p>
              <strong>MgT2022 mail</strong> works differently: each tick, the
              world rolls whether any mail is on offer at all (2D, needing 12+)
              and, if so, how many 5-ton containers are available. Accepting is
              take-all-or-none for that tick's container count, and payment is
              flat Cr25,000 per container regardless of distance.
            </p>
          </section>

          <section class="help-section">
            <h3>Freight (MgT2022 only)</h3>
            <p>
              MgT2022 campaigns get a fourth Port sub-tab, <strong>Freight</strong>,
              for bulk cargo lots — Major, Minor, or Incidental — booked and paid
              for like passengers/mail but priced per ton per parsec (smaller
              lots pay a higher per-ton rate). Freight auto-delivers on arrival
              like passengers and mail, but carries a deadline: delivering after
              its due tick applies a randomized late-delivery penalty, clawed
              back from the ship's credits at that time.
            </p>
            <p>
              How many lots of each size — and how many passengers of each
              tier, and mail containers — are actually on offer at a world this
              tick is itself a deterministic per-tick roll (population and
              starport class driven), shown as an availability count next to
              each option in the Passengers/Freight/Services forms.
            </p>
          </section>

          <section class="help-section">
            <h3>Jump Tab</h3>
            <p>
              The <strong>Jump</strong> tab (keyboard <kbd>J</kbd>) shows all
              worlds reachable from the current world within your ship's jump range.
              Each row shows the destination world name, hex, jump distance,
              starport class, and — when you have cargo in the hold — the total
              projected profit from selling your current hold at that destination.
              When cargo is loaded the list is sorted by profit; otherwise by
              distance then name.
            </p>
            <p>
              Use the <strong>−</strong> / <strong>+</strong> stepper to
              temporarily override your ship's jump rating and explore longer or
              shorter routes without committing. Click <strong>Select</strong> on
              any row to commit that world as your ship's location and switch to
              the Market tab for that destination. This represents completing the
              jump — use it when you arrive at a new world.
            </p>
          </section>

        </div>

        <!-- ── Market & Events ───────────────────────────────────────────── -->
        <div v-if="activeTab === 'market'" class="dialog-body">

          <section class="help-section">
            <h3>Market Tab</h3>
            <p>
              Shows current buy and sell prices for all trade goods. Price colours
              indicate deviation from the ruleset's base price (CT7's Cost of
              Goods/Market Price tables, T5's Trade Chart-2, or MgT2022's Base
              Price per good) — green means below base (buyer's market), red
              means above (seller's market).
            </p>
            <p>
              Goods affected by an active market event are highlighted with a left
              amber border; the event details appear in the banner above the table.
              Market data is generated lazily — prices are first recorded when the
              Market tab is opened, and backfilled for the entire current year on
              that first visit so charts have immediate context.
            </p>
            <table class="col-table">
              <thead><tr><th>Column</th><th>Description</th></tr></thead>
              <tbody>
                <tr>
                  <td><strong>Plot</strong></td>
                  <td>Checkbox — tick to add this good to the price chart below the table. Multiple goods can be plotted simultaneously.</td>
                </tr>
                <tr>
                  <td><strong>Good</strong></td>
                  <td>Trade good name.</td>
                </tr>
                <tr>
                  <td><strong>Die</strong></td>
                  <td>The d66 roll that identifies this good (e.g. 11–66).</td>
                </tr>
                <tr>
                  <td><strong>Buy (Cr/t)</strong></td>
                  <td>Purchase price per ton at this world this tick, derived from trade codes, starport class, and tech level per CT7/T5/MgT2022 rules.</td>
                </tr>
                <tr>
                  <td><strong>Sell (Cr/t)</strong></td>
                  <td>Sale price per ton — what you would receive selling here this tick.</td>
                </tr>
                <tr>
                  <td><strong>Spread</strong></td>
                  <td>Sell minus Buy per ton. Positive = profitable local round-trip.</td>
                </tr>
                <tr>
                  <td><strong>Qty (t)</strong></td>
                  <td>Available tons this tick. Stock does not carry over — a fresh quantity is rolled each tick.</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="help-section">
            <h3>Price Charts</h3>
            <p>
              Check any row's <strong>Plot</strong> checkbox to add it to the chart.
              Multiple goods can be plotted at once as a line chart for comparison.
              When only one good is selected, three time frames are available:
            </p>
            <ul>
              <li><strong>Weekly</strong> — one point per tick; line chart of purchase price.</li>
              <li><strong>Monthly</strong> — one candlestick per Imperial month (4 ticks).</li>
              <li><strong>Annual</strong> — one candlestick per Imperial year (48 ticks).</li>
            </ul>
            <p>
              Event markers appear on the weekly chart at the tick the event fired.
              Blue circles = Minor, amber squares = Major, red arrows = Crisis.
              Drag the divider between the table and chart to resize both panels.
            </p>
          </section>

          <section class="help-section">
            <h3>Events Tab</h3>
            <p>
              Shows the full event history for the selected world — both local
              events and subsector-wide events. Severity is shown as a coloured
              badge: blue (Minor), amber (Major), red (Crisis). Each entry shows
              the Imperial date, scope, price effect, and whether the event is
              still active or has expired.
            </p>
            <p>
              Event history is retained for the current year plus one prior year;
              older records are compacted automatically during the annual rollup.
            </p>
          </section>

        </div>

        <!-- ── Fleet & Finance ───────────────────────────────────────────── -->
        <div v-if="activeTab === 'fleet'" class="dialog-body">

          <section class="help-section">
            <h3>Ship Value &amp; Net Worth</h3>
            <p>
              Ships carry a Referee-entered <strong>market value</strong>, set
              either by picking a ship template or entering a number directly.
              The Ship &gt; Reports &gt; Net Worth tab combines that value with
              your ship's credits and its cargo (valued at what you paid for
              it), then subtracts any outstanding debt to give a total Net Worth.
            </p>
            <p>
              If the ship is jointly owned, or owned outright by an organization,
              Net Worth also shows <strong>Your Share</strong> — the total
              scaled by your recorded ownership percentage.
            </p>
          </section>

          <section class="help-section">
            <h3>Debts</h3>
            <p>
              The Referee can record a debt against your ship — a mortgage,
              loan, or other obligation with a principal, a current balance, and
              an optional due date. Debts don't accrue interest; the Referee
              adjusts the balance directly if needed.
            </p>
            <p>
              Pay one down from the Ship &gt; Reports &gt; Debts tab: enter an
              amount and confirm. A payment is rejected if it's more than your
              ship's available credits, or more than the debt's remaining
              balance — whichever is smaller.
            </p>
          </section>

          <section class="help-section">
            <h3>Ownership Shares</h3>
            <p>
              The Referee can record multiple players as joint owners of one
              ship, each with a percentage share. Recorded shares can never add
              up to more than 100%.
            </p>
            <p>
              If you don't have an explicit share recorded on a ship, you're
              treated as owning whatever percentage is <em>left over</em> after
              everyone else's recorded shares — not automatically 100% yourself.
              A ship with no ownership records at all still behaves as if its
              crew owns it outright.
            </p>
          </section>

          <section class="help-section">
            <h3>Organizations</h3>
            <p>
              Any player can found an Organization from the Ship &gt;
              Organizations tab — give it a name, a starting treasury, and
              (optionally) a flat dues rate. You automatically become its first
              <strong>officer</strong>.
            </p>
            <p>
              An organization can have several officers; any one of them can
              manage it fully, including adding or removing other officers (the
              last officer can't be removed — the Referee can always delete the
              organization outright instead). Officers add or remove member
              ships and decide, per ship, whether the organization
              <strong>owns it outright</strong> or the ship just stays
              affiliated while remaining independently owned. A ship can be
              owned outright by only one organization at a time.
            </p>
          </section>

          <section class="help-section">
            <h3>Dues &amp; Disbursement</h3>
            <p>
              An organization's dues are a single flat rate an officer sets,
              collected from every member ship at a configurable interval (in
              ticks). The panel shows whether dues are currently due, but
              nothing is collected automatically — an officer clicks
              <strong>Collect Dues</strong> when ready. A member ship without
              enough credits is simply skipped that round rather than blocking
              everyone else.
            </p>
            <p>
              <strong>Note:</strong> collecting again before the configured
              interval has passed since the last collection is rejected — this
              prevents accidentally double-collecting.
            </p>
            <p>
              <strong>Disbursement</strong> is separate and ad hoc: an officer
              can send funds from the organization's treasury to any member ship
              at any time, capped at whatever the treasury currently holds.
            </p>
          </section>

          <section class="help-section">
            <h3>Fleet Report &amp; Chained Ownership</h3>
            <p>
              The <strong>Fleet Report</strong> shows every member ship's
              credits, value, cargo, and debt alongside fleet-wide totals and an
              income/expense breakdown. It's visible only to the organization's
              officers and the Referee, since it exposes financial detail for
              ships you might not personally crew.
            </p>
            <p>
              For a ship owned outright by an organization, your personal Net
              Worth share of that ship comes from your recorded equity
              percentage <em>in the organization</em> — not from any ownership
              record on the ship itself. Organization equity is recorded the
              same way as ship ownership shares, and is also capped at 100%
              between all recorded stakeholders.
            </p>
          </section>

        </div>

        <!-- ── Referee ───────────────────────────────────────────────────── -->
        <div v-if="activeTab === 'referee'" class="dialog-body">

          <section class="help-section">
            <h3>Referee Panel</h3>
            <p>
              Access the Referee panel from the hamburger menu → Manage Campaign,
              or navigate directly to <code>/referee</code>. It is only accessible
              to the campaign's Referee character.
            </p>
          </section>

          <section class="help-section">
            <h3>Ships &amp; Crew</h3>
            <p>
              Create ships in the <strong>Ships</strong> tab. Each ship has a
              name, hull type, hull tonnage, cargo capacity, and a credit balance.
              Players are assigned to a ship as crew; a player may only be on one
              ship at a time.
            </p>
            <p>
              Each crew member has a role (captain, pilot, engineer, etc.) and a
              <strong>Can Trade</strong> flag. Captains receive <em>Can Trade</em>
              automatically; it can be toggled for any crew member via the
              checkbox in the crew table. Promoting a crew member to captain
              auto-grants the flag; demoting does not remove it — adjust manually
              if needed.
            </p>
          </section>

          <section class="help-section">
            <h3>Ship Templates</h3>
            <p>
              Manage a catalogue of reusable ship designs from Campaign
              Management → Ships → Templates, tagged for the campaign's ruleset
              (CT7, T5, or MgT2022). The New Ship form's Template dropdown pre-fills every
              stat field (hull tons, cargo, staterooms, fuel, drives, market
              value) from a selection — pick <strong>Custom Design</strong> to
              fill the form blank instead. There's no ongoing link between a
              ship and the template it was created from.
            </p>
            <p>
              You can also capture an existing ship's current stats as a new
              template via <strong>Save as Template</strong> on its detail view.
              Template names must be unique within the campaign.
            </p>
          </section>

          <section class="help-section">
            <h3>Debts &amp; Ownership</h3>
            <p>
              Record a ship debt or an ownership share from the ship's detail
              view (Ships tab → Debts / Ownership sections). See the
              <strong>Fleet &amp; Finance</strong> tab for what these mean from
              a player's side — payment validation, the 100%-ceiling on shares,
              and how an unrecorded share defaults to the remainder.
            </p>
            <p>
              Ownership shares recorded here are independent of Organizations —
              they're a straightforward partnership in one ship, arbitrated by
              you the same way a debt is, rather than something players manage
              themselves.
            </p>
          </section>

          <section class="help-section">
            <h3>Market Events</h3>
            <p>
              Create events in the <strong>Events</strong> tab. Events apply
              independent <strong>Buy</strong> and <strong>Sell</strong> price
              modifiers to one trade good (or all goods) at a local world or
              across an entire subsector — allowing asymmetric effects such as a
              shortage that drives up sell prices without affecting what merchants
              charge buyers. Set a duration in ticks; the event expires
              automatically at that tick. Expire an event early with the
              <strong>Expire</strong> button.
            </p>
            <p>
              Events fire automatically at random (M.U.L.E.-style) on a world's
              first market visit each tick, in addition to any you create manually.
            </p>
          </section>

          <section class="help-section">
            <h3>Advancing the Tick</h3>
            <p>
              Click <strong>Advance Tick</strong> in the map header, or press
              <kbd>T</kbd>. Each tick is one jump-week (7 Imperial days). Prices
              update, random events may fire, and monthly or annual OHLC rollups
              trigger at the appropriate intervals. Only the Referee can advance
              the tick.
            </p>
          </section>

          <section class="help-section">
            <h3>Players Tab</h3>
            <p>
              The <strong>Players</strong> tab shows every character in the
              campaign with their current ship assignment and skill list. You can
              add, edit, or remove skills here. Skills are free-form text — any
              name is valid. Trade-relevant skills include Broker, Trader, Liaison,
              Admin, Steward, and Streetwise.
            </p>
          </section>

          <section class="help-section">
            <h3>Campaign Tab &amp; Recovery Code</h3>
            <p>
              The <strong>Campaign</strong> tab shows campaign details and lets you
              generate a new recovery code. Use this if the original code was lost.
              Generating a new code immediately invalidates the old one.
            </p>
            <p>
              The recovery code can be used from the <strong>Reset PIN</strong> tab
              on the login screen to reset any character's PIN without knowing the
              old PIN. It is campaign-scoped, so the Referee can use it to help
              locked-out players as well.
            </p>
          </section>

          <section class="help-section">
            <h3>Deleting a Campaign</h3>
            <p>
              The <strong>Danger Zone</strong> section at the bottom of the Campaign
              tab lets the Referee permanently delete the campaign. This removes all
              associated data — ships, cargo, market history, players, events, and
              trade records — and cannot be undone.
            </p>
            <p>
              Click <strong>Delete Campaign…</strong> to reveal the confirmation
              form, then enter your Referee PIN and click
              <strong>Confirm Delete</strong>. You will be signed out and returned
              to the login screen. The campaign code is freed for reuse.
            </p>
          </section>

        </div>

        <!-- ── Shortcuts ─────────────────────────────────────────────────── -->
        <div v-if="activeTab === 'shortcuts'" class="dialog-body shortcuts-body">
          <table class="shortcuts-table">
            <thead>
              <tr><th>Key</th><th>Action</th></tr>
            </thead>
            <tbody>
              <tr v-for="s in SHORTCUTS" :key="s.key">
                <td><kbd>{{ s.key }}</kbd></td>
                <td>{{ s.action }}</td>
              </tr>
            </tbody>
          </table>
          <p class="shortcuts-note">
            Keyboard shortcuts are inactive while an input field has focus.
          </p>
        </div>

        <div class="dialog-footer">
          <button class="btn-primary" @click="close">Close</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useFocusTrap } from '../composables/useFocusTrap.js'

const props = defineProps({ modelValue: { type: Boolean, required: true } })
const emit  = defineEmits(['update:modelValue'])

const auth      = useAuthStore()
const activeTab = ref('start')
const dialogEl  = ref(null)

const { activate, deactivate } = useFocusTrap(dialogEl)
watch(() => props.modelValue, v => v ? nextTick(activate) : deactivate())

const ALL_TABS = [
  { key: 'start',     label: 'Getting Started' },
  { key: 'trading',   label: 'Trading'         },
  { key: 'market',    label: 'Market & Events' },
  { key: 'fleet',     label: 'Fleet & Finance' },
  { key: 'referee',   label: 'Referee',  refOnly: true },
  { key: 'shortcuts', label: 'Shortcuts'        },
]

const tabs = computed(() =>
  ALL_TABS.filter(t => !t.refOnly || auth.isReferee)
)

const SHORTCUTS = [
  { key: '?',   action: 'Open Help' },
  { key: 'O',   action: 'Switch to Overview tab' },
  { key: 'M',   action: 'Switch to Market tab' },
  { key: 'C',   action: 'Switch to Cargo tab' },
  { key: 'E',   action: 'Switch to Events tab' },
  { key: 'J',   action: 'Switch to Jump tab' },
  { key: 'T',   action: 'Advance Tick (Referee only)' },
  { key: 'Esc', action: 'Close dialog' },
]

function close() { emit('update:modelValue', false) }

function onKey(e) { if (e.key === 'Escape') close() }
onMounted(()   => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

.dialog {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) * 2);
  width: min(680px, 92vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  gap: 0.5rem;
}

.help-tabs {
  display: flex;
  gap: 0.2rem;
  flex-wrap: wrap;
}

.htab {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-dim);
  font-size: 0.78rem;
  padding: 0.28rem 0.75rem;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.1s;
  white-space: nowrap;
}
.htab:hover { color: var(--text); border-color: var(--border); }
.htab.active {
  background: var(--bg-selected);
  border-color: var(--accent-dim);
  color: var(--accent);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius);
  transition: color 0.15s;
  flex-shrink: 0;
}
.close-btn:hover { color: var(--text); }

/* Body */
.dialog-body {
  padding: 1.1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.help-section {
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(42,48,80,0.6);
}
.help-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }

.help-section h3 {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin: 0 0 0.5rem;
}

.help-section p {
  font-size: 0.83rem;
  color: var(--text);
  line-height: 1.6;
  margin: 0 0 0.5rem;
}
.help-section p:last-child { margin-bottom: 0; }

.help-section ul {
  margin: 0.35rem 0 0.5rem 1.1rem;
  padding: 0;
}
.help-section li {
  font-size: 0.83rem;
  color: var(--text);
  line-height: 1.6;
  margin-bottom: 0.2rem;
}

code {
  font-family: monospace;
  background: var(--bg-item);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.85em;
  color: var(--code);
}

/* Column definitions table */
.col-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  margin-top: 0.75rem;
}
.col-table th {
  text-align: left;
  padding: 0.35rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
}
.col-table td {
  padding: 0.45rem 0.6rem;
  color: var(--text);
  border-bottom: 1px solid rgba(42,48,80,0.3);
  vertical-align: top;
}
.col-table td:first-child {
  white-space: nowrap;
  color: var(--accent);
  width: 9rem;
}
.col-table tr:last-child td { border-bottom: none; }

/* Shortcuts tab */
.shortcuts-body { gap: 1rem; }

.shortcuts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.83rem;
}
.shortcuts-table th {
  text-align: left;
  padding: 0.4rem 0.75rem;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
}
.shortcuts-table td {
  padding: 0.55rem 0.75rem;
  color: var(--text);
  border-bottom: 1px solid rgba(42,48,80,0.4);
}

kbd {
  display: inline-block;
  font-family: monospace;
  font-size: 0.82rem;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 7px;
  color: var(--code);
  min-width: 2rem;
  text-align: center;
}

.shortcuts-note {
  font-size: 0.75rem;
  color: var(--text-dim);
  margin: 0;
}

/* Footer */
.dialog-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.btn-primary {
  background: var(--accent-dim);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 0.35rem 1.1rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover { background: var(--accent); }
</style>
