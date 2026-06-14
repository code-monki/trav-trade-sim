<template>
  <Teleport to="body">
    <div v-if="modelValue" class="overlay" @mousedown.self="close">
      <div class="dialog" role="dialog" aria-modal="true"
           aria-labelledby="about-dialog-title" ref="dialogEl">
        <div class="dialog-header">
          <div class="app-identity" id="about-dialog-title">
            <span class="app-name">Traveller Trade Simulator</span>
            <span class="app-version">v{{ version }}</span>
          </div>
          <button class="close-btn" @click="close" aria-label="Close">✕</button>
        </div>

        <div class="dialog-body">
          <p class="app-desc">
            A speculative trade dashboard for Classic Traveller campaigns,
            inspired by the market mechanics of M.U.L.E. Track commodity prices,
            analyse market events, and identify profitable trade routes across the
            Third Imperium.
          </p>

          <a class="repo-link"
             href="https://github.com/code-monki/trav-trade-sim"
             target="_blank" rel="noopener noreferrer">
            View source on GitHub
          </a>

          <hr class="section-rule" />

          <div class="legal-block">
            <p class="legal-head">Legal Disclaimer &amp; Fair Use Notice</p>
            <p>
              This application is a completely free, open-source fan creation intended
              solely for personal, non-commercial use to support players and referees of
              the Traveller role-playing game across multiple rulesets.
            </p>
            <p>
              The Traveller game in all forms, editions, and associated universes is owned
              in its entirety by Mongoose Publishing. Traveller is a registered trademark
              of Mongoose Publishing. This project is executed strictly under the
              provisions of the Mongoose Publishing Fair Use Policy for non-commercial
              fan-made materials, utilities, and automated game aids.
            </p>
            <p>
              This application is not authorized, endorsed, approved, or affiliated with
              Mongoose Publishing. Any use of copyrighted material, game system rules
              parameters, or trademarks anywhere within this application and its source
              files is done non-commercially and should not be viewed as a challenge to
              those copyrights or trademarks. All intellectual property remains the
              exclusive property of Mongoose Publishing.
            </p>
          </div>

          <hr class="section-rule" />

          <div class="legal-block">
            <p class="legal-head">Acknowledgements</p>

            <p class="ack-subhead">Foundational Designers</p>
            <p>
              <strong class="ack-name">Marc Miller</strong> — Deepest thanks and
              acknowledgement to Marc Miller, the legendary original creator of Traveller
              and designer of Classic Traveller and Traveller5 (T5). His foundational
              genius in crafting a robust, simulation-focused rules architecture laid the
              groundwork for decades of interstellar charting and made both group and solo
              sandbox play a reality.
            </p>
            <p>
              <strong class="ack-name">Matthew Sprange</strong> — Acknowledgement is
              gratefully extended to Matthew Sprange, the designer of Mongoose Traveller
              and managing director of Mongoose Publishing, whose continuous stewardship,
              modernization, and structural refinement of the core systems keep the Free
              Trader dream thriving.
            </p>

            <p class="ack-subhead">Mechanical Inspiration</p>
            <p>
              <strong class="ack-name">Dani Bunten Berry (Ozark Softscape)</strong> — The
              dynamic, randomized market events subsystem utilized in this simulator was
              directly inspired by the brilliant macroeconomic mechanics of the seminal
              1983 computer game M.U.L.E. Its elegant approach to modeling supply and
              demand shocks remains a gold standard for interactive economic systems.
            </p>

            <p class="ack-subhead">Testing &amp; Development Support</p>
            <p>
              Special thanks are due to Jeff Zeitlin, Timothy Collinson, Thomas
              Jones-Low, and Robert Eaglestone. Their dedicated efforts in testing the
              application, breaking the economic models, identifying edge cases, and
              providing invaluable ideas and structural encouragement were vital to
              transforming this architectural layout into a functional, multi-ruleset
              sandbox.
            </p>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn-primary" @click="close">Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import pkg from '../../package.json'
import { useFocusTrap } from '../composables/useFocusTrap.js'

const props = defineProps({ modelValue: { type: Boolean, required: true } })
const emit  = defineEmits(['update:modelValue'])

const version  = pkg.version
const dialogEl = ref(null)

const { activate, deactivate } = useFocusTrap(dialogEl)
watch(() => props.modelValue, v => v ? nextTick(activate) : deactivate())

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
  width: min(520px, 92vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.app-identity {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.app-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.02em;
}

.app-version {
  font-size: 0.72rem;
  color: var(--text-dim);
  font-family: monospace;
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
}
.close-btn:hover { color: var(--text); }

.dialog-body {
  padding: 1.1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.app-desc {
  font-size: 0.85rem;
  color: var(--text);
  line-height: 1.55;
  margin: 0;
}

.repo-link {
  font-size: 0.8rem;
  color: var(--accent);
  text-decoration: none;
  width: fit-content;
}
.repo-link:hover { text-decoration: underline; }

.section-rule {
  border: none;
  border-top: 1px solid var(--border);
  margin: 0.25rem 0;
}

.legal-block {
  font-size: 0.75rem;
  color: var(--text-dim);
  line-height: 1.55;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.legal-head {
  font-weight: 600;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  margin: 0;
}

.legal-block p { margin: 0; }

.ack-subhead {
  font-weight: 600;
  font-size: 0.72rem;
  color: var(--text);
  margin: 0.75rem 0 0.1rem !important;
  letter-spacing: 0.03em;
}

.ack-name {
  color: var(--text);
  font-weight: 600;
}

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
