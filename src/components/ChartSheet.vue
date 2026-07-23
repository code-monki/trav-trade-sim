<template>
  <Teleport to="body">
    <div v-if="detent === 'full'" class="sheet-scrim" aria-hidden="true" @click="dismiss"></div>
    <section
      ref="sheetEl"
      class="chart-sheet"
      :class="{ 'sheet-animating': animating }"
      :style="{ height: fullPx + 'px', transform: `translateY(${offsetY}px)` }"
      role="dialog"
      :aria-modal="detent === 'full' ? 'true' : undefined"
      aria-labelledby="chart-sheet-title"
      @keydown="onSheetKeydown"
      @transitionend.self="onTransitionEnd"
    >
      <div
        ref="handleEl"
        class="sheet-handle"
        role="separator"
        aria-orientation="horizontal"
        :aria-valuenow="detentIndex"
        aria-valuemin="0"
        aria-valuemax="2"
        :aria-valuetext="`Chart height: ${detent}`"
        aria-label="Chart panel height — arrow keys resize, Escape closes"
        tabindex="0"
        @keydown="onHandleKeydown"
        @pointerdown="onHandlePointerDown"
      >
        <span class="grabber" aria-hidden="true"></span>
      </div>
      <h2 id="chart-sheet-title" class="sr-only">Price history chart</h2>
      <div ref="bodyEl" class="sheet-body" :style="{ height: bodyPx + 'px' }">
        <slot :paused="paused"></slot>
      </div>
    </section>
  </Teleport>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'

// A detented bottom sheet (peek / half / full) for the mobile price chart.
// The sheet is a fixed-height element pinned to the bottom of the viewport;
// detents only change how far it is translated down, so dragging is a pure
// transform (no layout). The slotted chart is told to freeze interactions and
// canvas resizing while the sheet is moving (`paused`), and the body is
// re-measured exactly once when the sheet settles on a detent.

const props = defineProps({
  initialDetent: { type: String, default: 'half' },
})

const emit = defineEmits(['dismiss', 'inset-change'])

const DETENTS = ['peek', 'half', 'full']

const sheetEl  = ref(null)
const handleEl = ref(null)
const bodyEl   = ref(null)

const detent    = ref(props.initialDetent)
const dragging  = ref(false)
const animating = ref(false)
const paused    = computed(() => dragging.value || animating.value)

const detentIndex = computed(() => DETENTS.indexOf(detent.value))

// ── Geometry ──────────────────────────────────────────────────────────────────
const TOP_SAFE  = 64   // px always left clear above the sheet at full
const HANDLE_H  = 44   // drag affordance height (touch-target minimum)

const viewportH = ref(typeof window !== 'undefined' ? window.innerHeight : 800)

const fullPx = computed(() => Math.max(200, viewportH.value - TOP_SAFE))

const detentPx = computed(() => ({
  peek: Math.max(132, Math.round(viewportH.value * 0.18)),
  half: Math.round(viewportH.value * 0.46),
  full: fullPx.value,
}))

// Distance the sheet is translated down from fully open.
const offsetY = ref(0)
// Height of the chart area — updated only when the sheet settles, never
// per-frame during a drag or transition.
const bodyPx = ref(200)

function visibleFor(d) { return detentPx.value[d] }
function offsetFor(d)  { return fullPx.value - visibleFor(d) }

let settleTimer = null

function settle() {
  clearTimeout(settleTimer)
  bodyPx.value = visibleFor(detent.value) - HANDLE_H
  // Unpause on the next tick so the chart resumes at the final layout and
  // performs a single resize.
  nextTick(() => { animating.value = false })
}

function applyDetent(d, { animate = true } = {}) {
  detent.value = d
  emit('inset-change', visibleFor(d))
  const target = offsetFor(d)
  clearTimeout(settleTimer)
  if (!animate || target === offsetY.value) {
    offsetY.value = target
    settle()
    return
  }
  animating.value = true
  offsetY.value = target
  // Fallback in case transitionend is missed (tab hidden, transition removed).
  settleTimer = setTimeout(settle, 400)
}

function onTransitionEnd(e) {
  if (e.propertyName === 'transform') settle()
}

function dismiss() { emit('dismiss') }

// ── Dragging (handle: any pointer; body: touch with directional lock) ────────
let dragStartY      = 0
let dragStartOffset = 0
let samples         = []   // recent {t, y} pairs for release velocity

function beginDrag(y) {
  dragging.value  = true
  animating.value = false
  dragStartY      = y
  dragStartOffset = offsetY.value
  samples = [{ t: performance.now(), y }]
}

function moveDrag(y) {
  const maxOffset = offsetFor('peek')
  const next      = dragStartOffset + (y - dragStartY)
  // Allow a little travel past peek so drag-to-dismiss reads as a gesture.
  offsetY.value = Math.min(Math.max(next, 0), maxOffset + 80)
  samples.push({ t: performance.now(), y })
  if (samples.length > 8) samples.shift()
}

function releaseVelocity() {
  if (samples.length < 2) return 0
  const last = samples[samples.length - 1]
  let i = samples.length - 2
  while (i > 0 && last.t - samples[i].t < 80) i--
  const dt = last.t - samples[i].t
  return dt > 0 ? (last.y - samples[i].y) / dt : 0   // px/ms, + is downward
}

const FLING = 0.4  // px/ms

function chooseDetent(v) {
  const visible = fullPx.value - offsetY.value
  const entries = DETENTS.map(d => [d, detentPx.value[d]])
  if (v > FLING) {          // flung down → next detent below, or dismiss
    const below = entries.filter(([, p]) => p < visible - 10)
    return below.length ? below[below.length - 1][0] : null
  }
  if (v < -FLING) {         // flung up → next detent above
    const above = entries.filter(([, p]) => p > visible + 10)
    return above.length ? above[0][0] : 'full'
  }
  if (visible < detentPx.value.peek * 0.6) return null   // dragged well below peek
  let best = 'half', bestDist = Infinity
  for (const [d, p] of entries) {
    const dist = Math.abs(p - visible)
    if (dist < bestDist) { best = d; bestDist = dist }
  }
  return best
}

function endDrag() {
  dragging.value = false
  const target = chooseDetent(releaseVelocity())
  if (target === null) { dismiss(); return }
  applyDetent(target)
}

function onHandlePointerDown(e) {
  e.preventDefault()
  const el = handleEl.value
  el.setPointerCapture?.(e.pointerId)
  beginDrag(e.clientY)
  const onMove = (ev) => moveDrag(ev.clientY)
  const onUp = () => {
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onUp)
    endDrag()
  }
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)
}

// Directional lock over the chart area: decide the gesture's axis from its
// first ~8px of travel. Vertical drags move the sheet (and the chart is
// paused); horizontal drags fall through to the chart's own pan handling.
let lockAxis    = null   // null (undecided) | 'x' | 'y'
let touchStartX = 0
let touchStartY = 0

function onBodyTouchStart(e) {
  if (dragging.value) return
  if (e.touches.length !== 1) { lockAxis = 'x'; return }   // pinch → chart
  lockAxis    = null
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}

function onBodyTouchMove(e) {
  const t = e.touches[0]
  if (!t) return
  if (lockAxis === null) {
    const dx = t.clientX - touchStartX
    const dy = t.clientY - touchStartY
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    lockAxis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x'
    if (lockAxis === 'y') beginDrag(t.clientY)
  }
  if (lockAxis === 'y') {
    e.preventDefault()
    e.stopPropagation()
    moveDrag(t.clientY)
  }
}

function onBodyTouchEnd() {
  if (lockAxis === 'y' && dragging.value) endDrag()
  lockAxis = null
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
function stepDetent(dir) {
  const i = detentIndex.value + dir
  if (i < 0) { dismiss(); return }
  applyDetent(DETENTS[Math.min(i, DETENTS.length - 1)])
}

function onHandleKeydown(e) {
  if (e.key === 'ArrowUp')        { e.preventDefault(); stepDetent(1) }
  else if (e.key === 'ArrowDown') { e.preventDefault(); stepDetent(-1) }
  else if (e.key === 'Home')      { e.preventDefault(); applyDetent('full') }
  else if (e.key === 'End')       { e.preventDefault(); applyDetent('peek') }
}

function onSheetKeydown(e) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    dismiss()
  } else if (e.key === 'Tab' && detent.value === 'full') {
    trapFocus(e)
  }
}

function trapFocus(e) {
  const focusables = sheetEl.value?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusables?.length) return
  const first = focusables[0]
  const last  = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
let invoker = null

function onViewportResize() {
  viewportH.value = window.innerHeight
  applyDetent(detent.value, { animate: false })
}

onMounted(() => {
  invoker = document.activeElement
  viewportH.value = window.innerHeight
  // Pre-size the body so the chart mounts at (near-)final dimensions, then
  // slide in from offscreen.
  bodyPx.value  = visibleFor(props.initialDetent) - HANDLE_H
  offsetY.value = fullPx.value
  requestAnimationFrame(() => applyDetent(props.initialDetent))
  handleEl.value?.focus()
  window.addEventListener('resize', onViewportResize)
  const body = bodyEl.value
  body.addEventListener('touchstart',  onBodyTouchStart, { passive: true })
  body.addEventListener('touchmove',   onBodyTouchMove,  { passive: false })
  body.addEventListener('touchend',    onBodyTouchEnd)
  body.addEventListener('touchcancel', onBodyTouchEnd)
})

onUnmounted(() => {
  clearTimeout(settleTimer)
  window.removeEventListener('resize', onViewportResize)
  emit('inset-change', 0)
  if (invoker && document.contains(invoker)) invoker.focus?.()
})
</script>

<style scoped>
.sheet-scrim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 89;
}

.chart-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border-top: 1px solid var(--border);
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.35);
  will-change: transform;
  touch-action: none;
}

.sheet-animating {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.sheet-handle {
  flex-shrink: 0;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
}

.sheet-handle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 12px 12px 0 0;
}

.grabber {
  width: 44px;
  height: 5px;
  border-radius: 3px;
  background: var(--border);
}

.sheet-body {
  flex-shrink: 0;
  overflow: hidden;
  padding: 0 0.6rem 0.6rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
