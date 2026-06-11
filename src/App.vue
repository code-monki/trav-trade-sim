<template>
  <header>
    <h1>Traveller Map Explorer</h1>
    <div class="milieu-control">
      <label for="milieu-select">Milieu</label>
      <select
        id="milieu-select"
        class="milieu-select"
        v-model="map.selectedMilieu"
        @change="map.onMilieuChange"
        :disabled="map.loading"
      >
        <option v-for="m in map.MILIEUS" :key="m.code" :value="m.code">{{ m.label }}</option>
      </select>
    </div>
  </header>

  <div class="layout">
    <!-- Left sidebar: sector selector + world list -->
    <aside class="sidebar">
      <section class="panel">
        <h2>Sector</h2>
        <div v-if="map.loading && !map.sectors.length" class="loading">Loading sectors…</div>
        <select
          v-else
          v-model="map.selectedSectorName"
          @change="map.onSectorChange"
          :disabled="map.loading"
        >
          <option value="">— Select a Sector —</option>
          <option v-for="sector in map.sectors" :key="sector.name" :value="sector.name">
            {{ sector.name }}
          </option>
        </select>
        <div v-if="map.selectedSectorInfo" class="sector-meta">
          <span>Coordinates: ({{ map.selectedSectorInfo.x }}, {{ map.selectedSectorInfo.y }})</span>
          <span v-if="map.selectedSectorInfo.abbreviation">Abbrev: {{ map.selectedSectorInfo.abbreviation }}</span>
        </div>
      </section>

      <section class="panel world-list-panel">
        <h2>
          Worlds
          <span v-if="map.worlds.length" class="count">({{ map.filteredWorlds.length }} / {{ map.worlds.length }})</span>
        </h2>
        <input
          v-if="map.worlds.length"
          v-model="map.searchQuery"
          placeholder="Filter worlds…"
          class="search-input"
          type="search"
        />
        <div v-if="map.loading && map.selectedSectorName && !map.worlds.length" class="loading">Loading worlds…</div>
        <div v-else-if="!map.selectedSectorName" class="placeholder">Select a sector above</div>
        <div v-else-if="map.worlds.length === 0" class="placeholder">No worlds found</div>
        <ul v-else class="world-list">
          <li
            v-for="world in map.filteredWorlds"
            :key="world.Hex"
            :class="{
              selected: map.selectedWorld && map.selectedWorld.Hex === world.Hex,
              'zone-red': world.Zone === 'R',
              'zone-amber': world.Zone === 'A',
            }"
            @click="map.selectWorld(world)"
          >
            <span class="world-name">{{ world.Name || '(unnamed)' }}</span>
            <span class="world-hex">{{ world.Hex }}</span>
          </li>
        </ul>
      </section>
    </aside>

    <!-- Main panel: world detail -->
    <main class="detail">
      <div v-if="!map.selectedWorld" class="placeholder large">
        <p>Select a world from the list to view its data</p>
      </div>

      <div v-else class="world-detail">
        <!-- Title & UWP -->
        <div class="detail-header">
          <div>
            <h2>{{ map.selectedWorld.Name || '(unnamed)' }}</h2>
            <div class="location-line">
              <span>{{ map.selectedSectorName }}</span>
              <span class="sep">·</span>
              <span>Hex {{ map.selectedWorld.Hex }}</span>
              <span v-if="map.selectedWorld.SS" class="sep">·</span>
              <span v-if="map.selectedWorld.SS">Subsector {{ map.selectedWorld.SS }}</span>
            </div>
          </div>
          <div class="uwp-badge">
            <span class="uwp-code">{{ map.selectedWorld.UWP }}</span>
            <span class="zone-badge" :class="map.zoneBadgeClass">{{ map.travelZoneLabel }}</span>
          </div>
        </div>

        <!-- UWP breakdown -->
        <section class="field-group" v-if="map.selectedWorld.UWP">
          <h3>Universal World Profile</h3>
          <div class="field-grid">
            <div class="field" v-for="item in map.decodedUWP" :key="item.label">
              <label>{{ item.label }}</label>
              <div class="field-value">
                <span class="code-val">{{ item.value }}</span>
                <span class="desc-val">{{ item.description }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- System overview -->
        <section class="field-group">
          <h3>System Data</h3>
          <div class="field-grid">
            <div class="field">
              <label>Allegiance</label>
              <div class="field-value">
                <span class="code-val">{{ map.selectedWorld.Allegiance || '—' }}</span>
              </div>
            </div>
            <div class="field">
              <label>Stellar Data</label>
              <div class="field-value">{{ map.selectedWorld.Stars || '—' }}</div>
            </div>
            <div class="field">
              <label>Bases</label>
              <div class="field-value">
                <span class="code-val">{{ map.selectedWorld.Bases || 'None' }}</span>
                <span v-if="map.decodedBases" class="desc-val">{{ map.decodedBases }}</span>
              </div>
            </div>
            <div class="field">
              <label>Trade Codes / Remarks</label>
              <div class="field-value">{{ map.selectedWorld.Remarks || '—' }}</div>
            </div>
            <div class="field">
              <label>Pop. Multiplier / Belts / Gas Giants</label>
              <div class="field-value">{{ map.selectedWorld.PBG || '—' }}</div>
            </div>
            <div class="field">
              <label>Worlds in System</label>
              <div class="field-value">{{ map.selectedWorld.W || '—' }}</div>
            </div>
            <div class="field">
              <label>Resource Units</label>
              <div class="field-value">{{ map.selectedWorld.RU || '—' }}</div>
            </div>
          </div>
        </section>

        <!-- T5 Extensions -->
        <section class="field-group" v-if="map.hasExtensions">
          <h3>T5 Extensions</h3>
          <div class="field-grid">
            <div class="field" v-for="ext in map.extensionFields" :key="ext.key">
              <label>{{ ext.label }}</label>
              <div class="field-value">
                <span class="code-val">{{ map.selectedWorld[ext.key] || '—' }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Routes -->
        <section class="field-group">
          <h3>
            Routes
            <span class="count">({{ map.selectedWorldRoutes.length }})</span>
          </h3>
          <div v-if="map.selectedWorldRoutes.length === 0" class="placeholder">No routes defined for this world</div>
          <div v-else class="route-list">
            <div
              class="route-entry"
              v-for="(route, i) in map.selectedWorldRoutes"
              :key="i"
              :style="route.color ? { borderLeftColor: route.color } : {}"
            >
              <div class="route-dest">
                <span class="route-name">{{ route.partnerName || '(unnamed)' }}</span>
                <span class="route-hex">{{ route.partnerHex }}</span>
                <span v-if="route.crossSector" class="cross-sector-badge">cross-sector</span>
              </div>
              <div class="route-meta">
                <span v-if="route.partnerUWP" class="code-val">{{ route.partnerUWP }}</span>
                <span v-if="route.allegiance" class="route-tag">{{ route.allegiance }}</span>
                <span v-if="route.type" class="route-tag">{{ route.type }}</span>
                <span v-if="route.style" class="route-tag muted">{{ route.style }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- All raw fields -->
        <section class="field-group raw-section">
          <h3>
            All Fields
            <button class="toggle-btn" @click="map.showRaw = !map.showRaw">
              {{ map.showRaw ? 'Hide' : 'Show' }}
            </button>
          </h3>
          <div v-if="map.showRaw" class="field-grid">
            <div class="field" v-for="key in map.worldHeaders" :key="key">
              <label>{{ key }}</label>
              <div class="field-value">{{ map.selectedWorld[key] || '—' }}</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>

  <div v-if="map.error" class="error-banner">
    {{ map.error }}
    <button @click="map.error = null">✕</button>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useMapStore } from './stores/map.js'

const map = useMapStore()
onMounted(() => map.loadSectors())
</script>
