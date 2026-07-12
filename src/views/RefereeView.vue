<template>
  <!-- ── Header ──────────────────────────────────────────────────────────── -->
  <header class="ref-header">
    <button class="back-btn" @click="router.push({ name: 'map' })">← Map</button>
    <div class="header-title">
      <h1>Campaign Management</h1>
      <span class="header-sub">{{ auth.campaign?.label }} · {{ auth.campaign?.code }}</span>
    </div>
    <div class="header-meta">
      <span class="rules-badge">{{ auth.campaign?.trade_rules }}</span>
      <span class="tick-badge">Tick {{ tick.currentTick }}</span>
    </div>
  </header>

  <!-- ── Tab bar ─────────────────────────────────────────────────────────── -->
  <nav class="ref-tabs" role="tablist">
    <button v-for="t in TABS" :key="t.key"
            role="tab"
            :aria-selected="activeTab === t.key"
            :class="['rtab', { active: activeTab === t.key }]"
            @click="switchTab(t.key)">
      {{ t.label }}
    </button>
  </nav>

  <main class="ref-body">

    <!-- ════════════════════════════════════════════════════════════════════ -->
    <!-- SHIPS TAB                                                            -->
    <!-- ════════════════════════════════════════════════════════════════════ -->
    <section v-if="activeTab === 'ships'" class="tab-pane">
      <div class="ships-layout">

        <!-- Ship list -->
        <div class="ship-list-col">
          <div class="col-header">
            <h2>Ships</h2>
            <div class="col-header-actions">
              <button class="btn-ghost btn-sm" @click="openManageTemplates">Templates</button>
              <button class="btn-primary btn-sm" @click="openNewShip">+ New Ship</button>
            </div>
          </div>

          <div v-if="referee.loading" class="placeholder">Loading…</div>
          <div v-else-if="!referee.ships.length" class="placeholder">No ships yet</div>
          <ul v-else class="ship-list">
            <li v-for="s in referee.ships" :key="s.id"
                :class="['ship-item', { active: selectedShipId === s.id }]"
                @click="selectShip(s.id)">
              <span class="ship-name">{{ s.name }}</span>
              <span class="ship-type">{{ s.hull_type || '—' }}</span>
              <span class="ship-crew-count">{{ s.crew.length }} crew</span>
            </li>
          </ul>
        </div>

        <!-- Ship detail / create form -->
        <div class="ship-detail-col">

          <!-- Create form -->
          <template v-if="showNewShipForm">
            <h2>New Ship</h2>
            <form class="detail-form" @submit.prevent="submitNewShip">
              <div class="form-row">
                <label>Template</label>
                <select v-model="selectedTemplateId" @change="applyTemplate(selectedTemplateId)">
                  <option value="">Custom Design</option>
                  <option v-for="t in referee.templates" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </div>
              <div class="form-row">
                <label>Name <span class="req">*</span></label>
                <input v-model="newShip.name" required placeholder="Free Trader Beowulf" />
              </div>
              <div class="form-row">
                <label>Hull Type</label>
                <input v-model="newShip.hullType" placeholder="Free Trader, Scout/Courier…" />
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Hull Tons</label>
                  <input v-model.number="newShip.hullTons" type="number" min="1" />
                </div>
                <div>
                  <label>Cargo Capacity (t)</label>
                  <input v-model.number="newShip.cargoCapacity" type="number" min="0" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Starting Credits (Cr)</label>
                  <input v-model.number="newShip.credits" type="number" min="0" />
                </div>
                <div>
                  <label>Market Value (Cr)</label>
                  <input v-model.number="newShip.marketValue" type="number" min="0" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Jump Rating (J-1–J-6)</label>
                  <input v-model.number="newShip.jumpRating" type="number" min="1" max="6" placeholder="—" />
                </div>
                <div>
                  <label>Maneuver Drive (1–9)</label>
                  <input v-model.number="newShip.maneuverRating" type="number" min="1" max="9" placeholder="—" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Staterooms</label>
                  <input v-model.number="newShip.staterooms" type="number" min="0" placeholder="0" />
                </div>
                <div>
                  <label>Low Berths</label>
                  <input v-model.number="newShip.lowBerths" type="number" min="0" placeholder="0" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Fuel Capacity (t)</label>
                  <input v-model.number="newShip.fuelCapacity" type="number" min="0" placeholder="0" />
                </div>
                <div>
                  <label>Current Fuel (t)</label>
                  <input v-model.number="newShip.fuelCurrent" type="number" min="0" placeholder="0" />
                </div>
              </div>
              <div class="form-actions">
                <button type="button" class="btn-ghost" @click="cancelNewShip">Cancel</button>
                <button type="submit" class="btn-primary" :disabled="!newShip.name.trim()">Create Ship</button>
              </div>
              <p v-if="shipError" class="form-error">{{ shipError }}</p>
            </form>
          </template>

          <!-- Manage Templates panel -->
          <template v-if="showManageTemplates">
            <div class="detail-header-row">
              <h2>Ship Templates</h2>
              <button class="btn-ghost btn-sm" @click="closeManageTemplates">Close</button>
            </div>

            <div v-if="!referee.templates.length" class="placeholder sm">No templates yet</div>
            <table v-else class="crew-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Hull</th>
                  <th class="right">Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in referee.templates" :key="t.id">
                  <td>{{ t.name }}</td>
                  <td>{{ t.hull_tons }}t</td>
                  <td class="right">Cr{{ t.market_value.toLocaleString() }}</td>
                  <td>
                    <button class="btn-ghost btn-xs" @click="startEditTemplate(t)">Edit</button>
                    <button class="btn-danger btn-xs" @click="removeTemplate(t)">Delete</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="referee.templates.some(t => t.notes)" class="hint-note">
              Starter templates are reference designs — verify against your own rulebook before relying on them.
            </p>

            <h3 class="template-form-heading">{{ editingTemplateId ? 'Edit Template' : 'New Template' }}</h3>
            <form class="detail-form" @submit.prevent="submitTemplateForm">
              <div class="form-row">
                <label>Name <span class="req">*</span></label>
                <input v-model="templateForm.name" required placeholder="Type A Free Trader" />
              </div>
              <div class="form-row">
                <label>Hull Type</label>
                <input v-model="templateForm.hullType" placeholder="Free Trader, Scout/Courier…" />
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Hull Tons</label>
                  <input v-model.number="templateForm.hullTons" type="number" min="1" />
                </div>
                <div>
                  <label>Cargo Capacity (t)</label>
                  <input v-model.number="templateForm.cargoCapacity" type="number" min="0" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Jump Rating (J-1–J-6)</label>
                  <input v-model.number="templateForm.jumpRating" type="number" min="1" max="6" placeholder="—" />
                </div>
                <div>
                  <label>Maneuver Drive (1–9)</label>
                  <input v-model.number="templateForm.maneuverRating" type="number" min="1" max="9" placeholder="—" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Staterooms</label>
                  <input v-model.number="templateForm.staterooms" type="number" min="0" placeholder="0" />
                </div>
                <div>
                  <label>Low Berths</label>
                  <input v-model.number="templateForm.lowBerths" type="number" min="0" placeholder="0" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Fuel Capacity (t)</label>
                  <input v-model.number="templateForm.fuelCapacity" type="number" min="0" placeholder="0" />
                </div>
                <div>
                  <label>Market Value (Cr)</label>
                  <input v-model.number="templateForm.marketValue" type="number" min="0" />
                </div>
              </div>
              <div class="form-row">
                <label>Notes</label>
                <input v-model="templateForm.notes" placeholder="Optional" />
              </div>
              <div class="form-actions">
                <button v-if="editingTemplateId" type="button" class="btn-ghost" @click="cancelEditTemplate">Cancel</button>
                <button type="submit" class="btn-primary" :disabled="!templateForm.name.trim()">
                  {{ editingTemplateId ? 'Save' : 'Add Template' }}
                </button>
              </div>
              <p v-if="templateError" class="form-error">{{ templateError }}</p>
            </form>
          </template>

          <!-- Ship detail + crew -->
          <template v-if="!showNewShipForm && !showManageTemplates && selectedShip">
            <div class="detail-header-row">
              <h2>{{ selectedShip.name }}</h2>
              <div class="col-header-actions">
                <button v-if="!editingShip" class="btn-ghost btn-sm" @click="showSaveTemplate = !showSaveTemplate">
                  {{ showSaveTemplate ? 'Cancel' : 'Save as Template' }}
                </button>
                <button class="btn-ghost btn-sm" @click="editingShip = !editingShip">
                  {{ editingShip ? 'Cancel' : 'Edit' }}
                </button>
              </div>
            </div>

            <!-- Save as Template inline form -->
            <form v-if="showSaveTemplate" class="detail-form" @submit.prevent="submitSaveAsTemplate">
              <div class="form-row">
                <label>Template Name <span class="req">*</span></label>
                <input v-model="saveTemplateName" required placeholder="e.g. Modified Free Trader" />
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary" :disabled="!saveTemplateName.trim()">Save Template</button>
              </div>
              <p v-if="saveTemplateError" class="form-error">{{ saveTemplateError }}</p>
              <p v-if="saveTemplateSuccess" class="form-success">{{ saveTemplateSuccess }}</p>
            </form>

            <!-- Inline edit form -->
            <form v-if="editingShip" class="detail-form" @submit.prevent="submitEditShip">
              <div class="form-row">
                <label>Hull Type</label>
                <input v-model="editShipFields.hullType" />
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Hull Tons</label>
                  <input v-model.number="editShipFields.hullTons" type="number" min="1" />
                </div>
                <div>
                  <label>Cargo Capacity (t)</label>
                  <input v-model.number="editShipFields.cargoCapacity" type="number" min="0" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Credits (Cr)</label>
                  <input v-model.number="editShipFields.credits" type="number" />
                </div>
                <div>
                  <label>Market Value (Cr)</label>
                  <input v-model.number="editShipFields.marketValue" type="number" min="0" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Jump Rating (J-1–J-6)</label>
                  <input v-model.number="editShipFields.jumpRating" type="number" min="1" max="6" placeholder="—" />
                </div>
                <div>
                  <label>Maneuver Drive (1–9)</label>
                  <input v-model.number="editShipFields.maneuverRating" type="number" min="1" max="9" placeholder="—" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Staterooms</label>
                  <input v-model.number="editShipFields.stateroomCapacity" type="number" min="0" placeholder="0" />
                </div>
                <div>
                  <label>Low Berths</label>
                  <input v-model.number="editShipFields.lowBerthCapacity" type="number" min="0" placeholder="0" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Fuel Capacity (t)</label>
                  <input v-model.number="editShipFields.fuelCapacity" type="number" min="0" placeholder="0" />
                </div>
                <div>
                  <label>Current Fuel (t)</label>
                  <input v-model.number="editShipFields.fuelCurrent" type="number" min="0" placeholder="0" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Location Hex</label>
                  <input v-model="editShipFields.currentWorld" placeholder="e.g. 1910" maxlength="4" />
                </div>
                <div>
                  <label>Sector</label>
                  <input v-model="editShipFields.currentSector" placeholder="Spinward Marches" />
                </div>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary">Save</button>
              </div>
            </form>

            <!-- Ship stats -->
            <div v-else class="stat-grid">
              <div class="stat"><label>Hull Type</label><span>{{ selectedShip.hull_type || '—' }}</span></div>
              <div class="stat"><label>Hull Tons</label><span>{{ selectedShip.hull_tons }}t</span></div>
              <div class="stat"><label>Cargo Capacity</label><span>{{ selectedShip.cargo_capacity }}t</span></div>
              <div class="stat"><label>Credits</label><span>Cr{{ selectedShip.credits.toLocaleString() }}</span></div>
              <div class="stat"><label>Market Value</label><span>Cr{{ (selectedShip.market_value ?? 0).toLocaleString() }}</span></div>
              <div class="stat"><label>Jump Rating</label><span>{{ selectedShip.jump_rating ? 'J-' + selectedShip.jump_rating : '—' }}</span></div>
              <div class="stat"><label>Maneuver</label><span>{{ selectedShip.maneuver_drive_rating ? selectedShip.maneuver_drive_rating + 'G' : '—' }}</span></div>
              <div class="stat"><label>Location</label>
                <span>{{ selectedShip.current_world || '—' }}
                  <span v-if="selectedShip.current_sector"> · {{ selectedShip.current_sector }}</span>
                </span>
              </div>
            </div>

            <!-- Stateroom / berth / fuel (edit form shows these) -->
            <div v-if="!editingShip" class="stat-grid" style="margin-top:0.5rem">
              <div class="stat"><label>Staterooms</label><span>{{ selectedShip.stateroom_capacity }}</span></div>
              <div class="stat"><label>Low Berths</label><span>{{ selectedShip.low_berth_capacity }}</span></div>
              <div class="stat"><label>Fuel Capacity</label><span>{{ selectedShip.fuel_capacity }}t</span></div>
              <div class="stat"><label>Current Fuel</label><span>{{ selectedShip.fuel_current }}t</span></div>
            </div>

            <!-- Crew roster -->
            <div class="crew-section">
              <div class="col-header">
                <h3>Crew</h3>
                <button class="btn-ghost btn-sm" @click="showAddCrew = !showAddCrew">
                  {{ showAddCrew ? 'Cancel' : '+ Add Crew' }}
                </button>
              </div>

              <!-- Add crew form -->
              <form v-if="showAddCrew" class="crew-add-form" @submit.prevent="submitAddCrew">
                <select v-model="newCrewPlayerId" required>
                  <option value="">— Select player —</option>
                  <option v-for="p in unassignedPlayers" :key="p.id" :value="p.id">
                    {{ p.character_name }}
                  </option>
                </select>
                <select v-model="newCrewRole">
                  <option v-for="r in CREW_ROLES" :key="r" :value="r">{{ r }}</option>
                </select>
                <button type="submit" class="btn-primary btn-sm"
                        :disabled="!newCrewPlayerId">Add</button>
                <p v-if="crewError" class="form-error">{{ crewError }}</p>
              </form>

              <div v-if="!selectedShip.crew.length" class="placeholder sm">No crew assigned</div>
              <table v-else class="crew-table">
                <thead>
                  <tr>
                    <th>Character</th>
                    <th>Role</th>
                    <th class="center">Can Trade</th>
                    <th class="center" title="Occupies a stateroom (uncheck to double-bunk)">Stateroom</th>
                    <th>Since Tick</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in selectedShip.crew" :key="c.id">
                    <td>{{ c.players?.character_name ?? '—' }}</td>
                    <td>
                      <select :value="c.role"
                              @change="changeCrewRole(c, $event.target.value)">
                        <option v-for="r in CREW_ROLES" :key="r" :value="r">{{ r }}</option>
                      </select>
                    </td>
                    <td class="center">
                      <input type="checkbox"
                             :checked="c.can_trade"
                             class="trade-check"
                             @change="referee.setCrewCanTrade(c, $event.target.checked)" />
                    </td>
                    <td class="center">
                      <input type="checkbox"
                             :checked="c.has_stateroom !== false"
                             class="trade-check"
                             @change="referee.setCrewStateroomOccupancy(c, $event.target.checked)" />
                    </td>
                    <td>{{ c.joined_tick }}</td>
                    <td>
                      <button class="btn-danger btn-xs"
                              @click="confirmRemoveCrew(c)">Remove</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Passenger manifest (referee refund) -->
            <div v-if="!editingShip" class="crew-section">
              <div class="col-header">
                <h3>Passengers In Transit</h3>
              </div>
              <div v-if="refPassengerLoading" class="placeholder sm">Loading…</div>
              <div v-else-if="!shipPassengers.length" class="placeholder sm">No passengers in transit</div>
              <table v-else class="crew-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th class="center">Count</th>
                    <th>Destination</th>
                    <th class="right">Fare</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in shipPassengers" :key="p.id">
                    <td>{{ p.passage_type }}</td>
                    <td class="center">{{ p.count }}</td>
                    <td>{{ p.dest_world_name || p.dest_world_hex }} · {{ p.dest_sector }}</td>
                    <td class="right">Cr{{ p.fare_total.toLocaleString() }}</td>
                    <td>
                      <button class="btn-danger btn-xs"
                              @click="doRefundPassenger(p)">Refund</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-if="refPassengerError" class="form-error">{{ refPassengerError }}</p>
            </div>

            <!-- Debts -->
            <div v-if="!editingShip" class="crew-section">
              <div class="col-header">
                <h3>Debts</h3>
                <button class="btn-ghost btn-sm" @click="showAddDebt ? cancelDebtForm() : openAddDebt()">
                  {{ showAddDebt ? 'Cancel' : '+ Add Debt' }}
                </button>
              </div>

              <form v-if="showAddDebt" class="detail-form" @submit.prevent="submitDebtForm">
                <div class="form-row two-col">
                  <div>
                    <label>Type</label>
                    <select v-model="debtForm.type">
                      <option value="mortgage">Mortgage</option>
                      <option value="loan">Loan</option>
                      <option value="obligation">Obligation</option>
                    </select>
                  </div>
                  <div>
                    <label>Creditor</label>
                    <input v-model="debtForm.creditorName" placeholder="Bank of Regina" />
                  </div>
                </div>
                <div class="form-row two-col">
                  <div>
                    <label>Principal (Cr)</label>
                    <input v-model.number="debtForm.principal" type="number" min="0" />
                  </div>
                  <div>
                    <label>Current Balance (Cr)</label>
                    <input v-model.number="debtForm.currentBalance" type="number" min="0" />
                  </div>
                </div>
                <div class="form-row">
                  <label>Due Tick</label>
                  <input v-model.number="debtForm.dueTick" type="number" min="0" placeholder="Optional" />
                </div>
                <div class="form-row">
                  <label>Notes</label>
                  <input v-model="debtForm.notes" placeholder="Optional" />
                </div>
                <div class="form-actions">
                  <button type="submit" class="btn-primary">{{ editingDebtId ? 'Save' : 'Add Debt' }}</button>
                </div>
              </form>

              <div v-if="debtsLoading" class="placeholder sm">Loading…</div>
              <div v-else-if="!shipDebts.length" class="placeholder sm">No debts recorded</div>
              <table v-else class="crew-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Creditor</th>
                    <th class="right">Principal</th>
                    <th class="right">Balance</th>
                    <th>Due</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="d in shipDebts" :key="d.id">
                    <td>{{ d.type }}</td>
                    <td>{{ d.creditor_name || '—' }}</td>
                    <td class="right">Cr{{ d.principal.toLocaleString() }}</td>
                    <td class="right">Cr{{ d.current_balance.toLocaleString() }}</td>
                    <td>{{ d.due_tick ?? '—' }}</td>
                    <td>
                      <button class="btn-ghost btn-xs" @click="startEditDebt(d)">Edit</button>
                      <button class="btn-danger btn-xs" @click="removeDebt(d)">Delete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-if="debtsError" class="form-error">{{ debtsError }}</p>
            </div>

            <!-- Ownership -->
            <div v-if="!editingShip" class="crew-section">
              <div class="col-header">
                <h3>Ownership</h3>
                <button class="btn-ghost btn-sm" @click="showAddOwnership ? cancelOwnershipForm() : openAddOwnership()">
                  {{ showAddOwnership ? 'Cancel' : '+ Add Owner' }}
                </button>
              </div>

              <form v-if="showAddOwnership" class="detail-form" @submit.prevent="submitOwnershipForm">
                <div class="form-row two-col">
                  <div>
                    <label>Player</label>
                    <select v-if="!editingOwnershipId" v-model="ownershipForm.playerId" required>
                      <option value="">— Select player —</option>
                      <option v-for="p in referee.players" :key="p.id" :value="p.id">{{ p.character_name }}</option>
                    </select>
                    <input v-else :value="shipOwnership.find(o => o.id === editingOwnershipId)?.character_name" disabled />
                  </div>
                  <div>
                    <label>Percentage</label>
                    <input v-model.number="ownershipForm.percentage" type="number" min="1" max="100" />
                  </div>
                </div>
                <div class="form-actions">
                  <button type="submit" class="btn-primary" :disabled="!editingOwnershipId && !ownershipForm.playerId">
                    {{ editingOwnershipId ? 'Save' : 'Add Owner' }}
                  </button>
                </div>
              </form>

              <div v-if="ownershipLoading" class="placeholder sm">Loading…</div>
              <div v-else-if="!shipOwnership.length" class="placeholder sm">100% owned by the assigned crew — no shares recorded</div>
              <table v-else class="crew-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th class="right">Share</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="o in shipOwnership" :key="o.id">
                    <td>{{ o.character_name }}</td>
                    <td class="right">{{ o.percentage }}%</td>
                    <td>
                      <button class="btn-ghost btn-xs" @click="startEditOwnership(o)">Edit</button>
                      <button class="btn-danger btn-xs" @click="removeOwnership(o)">Delete</button>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td class="total-label">Total</td>
                    <td class="right total-val">{{ ownershipTotal }}%</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <p v-if="ownershipError" class="form-error">{{ ownershipError }}</p>
            </div>

          </template>

          <div v-else class="placeholder">Select a ship or create a new one</div>
        </div>
      </div>
    </section>

    <!-- ════════════════════════════════════════════════════════════════════ -->
    <!-- PLAYERS TAB                                                          -->
    <!-- ════════════════════════════════════════════════════════════════════ -->
    <section v-if="activeTab === 'players'" class="tab-pane">
      <div v-if="referee.loading" class="placeholder">Loading…</div>
      <div v-else-if="!referee.players.length" class="placeholder">No players yet</div>

      <div v-else class="player-list">
        <div v-for="p in referee.players" :key="p.id" class="player-card">
          <div class="player-card-header" @click="togglePlayer(p.id)">
            <div class="player-identity">
              <span class="player-name">{{ p.character_name }}</span>
              <span class="role-badge" :class="p.role">{{ p.role }}</span>
              <span v-if="p.current_ship" class="ship-badge">{{ p.current_ship }}</span>
            </div>
            <span class="expand-icon">{{ expandedPlayerId === p.id ? '▲' : '▼' }}</span>
          </div>

          <div v-if="expandedPlayerId === p.id" class="player-skills">
            <h4>Skills</h4>
            <table v-if="p.skills.length" class="skills-table">
              <thead><tr><th>Skill</th><th>Level</th><th></th></tr></thead>
              <tbody>
                <tr v-for="s in p.skills" :key="s.id">
                  <td>{{ s.skill }}</td>
                  <td>
                    <input type="number" :value="s.level" min="0" max="10"
                           class="level-input"
                           @change="saveSkill(p, s.skill, +$event.target.value)" />
                  </td>
                  <td>
                    <button class="btn-danger btn-xs" @click="deleteSkill(p, s.id)">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="placeholder sm">No skills recorded</div>

            <!-- Add skill row -->
            <form class="add-skill-form" @submit.prevent="addSkill(p)">
              <input v-model="newSkillName[p.id]" placeholder="Skill name" />
              <input v-model.number="newSkillLevel[p.id]" type="number" min="0" max="10"
                     placeholder="Lvl" class="level-input" />
              <button type="submit" class="btn-ghost btn-sm"
                      :disabled="!newSkillName[p.id]?.trim()">Add</button>
            </form>
            <p v-if="skillError[p.id]" class="form-error">{{ skillError[p.id] }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ════════════════════════════════════════════════════════════════════ -->
    <!-- ORGANIZATIONS TAB                                                    -->
    <!-- ════════════════════════════════════════════════════════════════════ -->
    <section v-if="activeTab === 'organizations'" class="tab-pane">
      <div class="col-header">
        <h2>Organizations</h2>
        <button class="btn-primary btn-sm" @click="showNewOrg = !showNewOrg">
          {{ showNewOrg ? 'Cancel' : '+ New Organization' }}
        </button>
      </div>

      <form v-if="showNewOrg" class="detail-form" @submit.prevent="submitNewOrg">
        <div class="form-row">
          <label>Name <span class="req">*</span></label>
          <input v-model="newOrg.name" required placeholder="Spinward Traders' Guild" />
        </div>
        <div class="form-row two-col">
          <div>
            <label>Treasury (Cr)</label>
            <input v-model.number="newOrg.treasuryCredits" type="number" min="0" />
          </div>
          <div>
            <label>Dues Rate (Cr, flat)</label>
            <input v-model.number="newOrg.duesRate" type="number" min="0" placeholder="Optional" />
          </div>
        </div>
        <div class="form-row">
          <label>Notes</label>
          <input v-model="newOrg.notes" placeholder="Optional" />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="!newOrg.name.trim()">Create</button>
        </div>
        <p v-if="orgError" class="form-error">{{ orgError }}</p>
      </form>

      <div v-if="referee.loading" class="placeholder">Loading…</div>
      <div v-else-if="!referee.organizations.length" class="placeholder">No organizations yet</div>

      <div v-else class="player-list">
        <div v-for="o in referee.organizations" :key="o.id" class="player-card">
          <div class="player-card-header" @click="toggleOrg(o.id)">
            <div class="player-identity">
              <span class="player-name">{{ o.name }}</span>
              <span class="ship-badge">Cr{{ o.treasury_credits.toLocaleString() }}</span>
              <span v-if="o.dues_rate" class="ship-badge">Dues Cr{{ o.dues_rate.toLocaleString() }}</span>
            </div>
            <span class="expand-icon">{{ expandedOrgId === o.id ? '▲' : '▼' }}</span>
          </div>

          <div v-if="expandedOrgId === o.id" class="player-skills">
            <form class="detail-form" @submit.prevent="submitEditOrg(o)">
              <div class="form-row two-col">
                <div>
                  <label>Treasury (Cr)</label>
                  <input v-model.number="orgEditFields[o.id].treasuryCredits" type="number" min="0" />
                </div>
                <div>
                  <label>Dues Rate (Cr, flat)</label>
                  <input v-model.number="orgEditFields[o.id].duesRate" type="number" min="0" placeholder="None" />
                </div>
              </div>
              <div class="form-row two-col">
                <div>
                  <label>Dues Frequency (ticks)</label>
                  <input v-model.number="orgEditFields[o.id].duesFrequencyTicks" type="number" min="1" />
                </div>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-ghost btn-sm">Save</button>
                <button type="button" class="btn-danger btn-sm" @click="removeOrg(o)">Delete Organization</button>
              </div>
            </form>

            <h4>Dues</h4>
            <p class="dues-status">
              <template v-if="o.dues_rate">
                Cr{{ o.dues_rate.toLocaleString() }} every {{ o.dues_frequency_ticks }} ticks —
                <span :class="{ 'due-now': isOrgDuesDue(o) }">{{ isOrgDuesDue(o) ? 'due now' : `next due at tick ${orgNextDueTick(o)}` }}</span>
              </template>
              <template v-else>No dues configured</template>
            </p>
            <div class="form-actions">
              <button class="btn-ghost btn-sm" :disabled="!o.dues_rate || orgDuesBusy[o.id]" @click="collectOrgDues(o)">
                Collect Dues
              </button>
            </div>
            <p v-if="orgDuesResult[o.id]" class="dues-result">{{ orgDuesResult[o.id] }}</p>
            <p v-if="orgDuesError[o.id]" class="form-error">{{ orgDuesError[o.id] }}</p>

            <h4>Officers</h4>
            <table v-if="orgOfficers[o.id]?.length" class="skills-table">
              <thead><tr><th>Player</th><th></th></tr></thead>
              <tbody>
                <tr v-for="off in orgOfficers[o.id]" :key="off.id">
                  <td>{{ off.character_name }}</td>
                  <td><button class="btn-danger btn-xs" @click="removeOrgOfficer(o.id, off)">Remove</button></td>
                </tr>
              </tbody>
            </table>
            <div v-else class="placeholder sm">No officers</div>

            <form class="add-skill-form" @submit.prevent="addOrgOfficer(o.id)">
              <select v-model="newOfficerPlayerId[o.id]">
                <option value="">— Select player —</option>
                <option v-for="p in referee.players" :key="p.id" :value="p.id">{{ p.character_name }}</option>
              </select>
              <button type="submit" class="btn-ghost btn-sm" :disabled="!newOfficerPlayerId[o.id]">Add</button>
            </form>
            <p v-if="orgOfficerError[o.id]" class="form-error">{{ orgOfficerError[o.id] }}</p>

            <h4>Member Ships</h4>
            <table v-if="orgMembers[o.id]?.length" class="skills-table">
              <thead><tr><th>Ship</th><th class="center">Owns Assets</th><th></th></tr></thead>
              <tbody>
                <tr v-for="m in orgMembers[o.id]" :key="m.id">
                  <td>{{ m.ship_name }}</td>
                  <td class="center">
                    <input type="checkbox" :checked="!!m.owns_ship" @change="toggleOrgMemberOwnsShip(o.id, m, $event.target.checked)" />
                  </td>
                  <td><button class="btn-danger btn-xs" @click="removeOrgMember(o.id, m)">Remove</button></td>
                </tr>
              </tbody>
            </table>
            <div v-else class="placeholder sm">No ships in this organization</div>

            <form class="add-skill-form" @submit.prevent="addOrgMember(o.id)">
              <select v-model="newMemberShipId[o.id]">
                <option value="">— Select ship —</option>
                <option v-for="s in referee.ships" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
              <label class="owns-check-label">
                <input type="checkbox" v-model="newMemberOwnsShip[o.id]" /> Owns
              </label>
              <button type="submit" class="btn-ghost btn-sm" :disabled="!newMemberShipId[o.id]">Add</button>
            </form>
            <p v-if="orgMemberError[o.id]" class="form-error">{{ orgMemberError[o.id] }}</p>

            <h4>Disbursement</h4>
            <form class="add-skill-form" @submit.prevent="submitOrgDisburse(o)">
              <select v-model="orgDisburseShipId[o.id]">
                <option value="">— Select ship —</option>
                <option v-for="m in orgMembers[o.id] ?? []" :key="m.id" :value="m.ship_id">{{ m.ship_name }}</option>
              </select>
              <input v-model.number="orgDisburseAmount[o.id]" type="number" min="1" placeholder="Amount" class="amount-input" />
              <button type="submit" class="btn-ghost btn-sm" :disabled="!orgDisburseShipId[o.id] || !orgDisburseAmount[o.id]">Disburse</button>
            </form>
            <p v-if="orgDisburseError[o.id]" class="form-error">{{ orgDisburseError[o.id] }}</p>

            <h4>Equity</h4>
            <table v-if="orgEquity[o.id]?.length" class="skills-table">
              <thead><tr><th>Player</th><th class="center">%</th><th></th></tr></thead>
              <tbody>
                <tr v-for="eq in orgEquity[o.id]" :key="eq.id">
                  <td>{{ eq.character_name }}</td>
                  <td class="center">{{ eq.percentage }}%</td>
                  <td><button class="btn-danger btn-xs" @click="removeOrgEquity(o.id, eq)">Remove</button></td>
                </tr>
              </tbody>
            </table>
            <div v-else class="placeholder sm">No equity holders recorded</div>

            <form class="add-skill-form" @submit.prevent="addOrgEquity(o.id)">
              <select v-model="newEquityPlayerId[o.id]">
                <option value="">— Select player —</option>
                <option v-for="p in referee.players" :key="p.id" :value="p.id">{{ p.character_name }}</option>
              </select>
              <input v-model.number="newEquityPercentage[o.id]" type="number" min="1" max="100" placeholder="%" class="amount-input" />
              <button type="submit" class="btn-ghost btn-sm" :disabled="!newEquityPlayerId[o.id] || !newEquityPercentage[o.id]">Add</button>
            </form>
            <p v-if="orgEquityError[o.id]" class="form-error">{{ orgEquityError[o.id] }}</p>

            <h4>Fleet Report</h4>
            <button class="btn-ghost btn-sm" @click="toggleOrgFleetReport(o.id)">
              {{ orgFleetReportOpen[o.id] ? 'Hide Fleet Report' : 'Show Fleet Report' }}
            </button>
            <div v-if="orgFleetReportOpen[o.id]">
              <div v-if="orgFleetReportLoading[o.id]" class="placeholder sm">Loading…</div>
              <template v-else-if="orgFleetReport[o.id]">
                <table class="skills-table">
                  <thead>
                    <tr><th>Ship</th><th class="right">Credits</th><th class="right">Value</th><th class="right">Cargo</th><th class="right">Debt</th><th class="right">Net</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in orgFleetReport[o.id].ships" :key="s.id">
                      <td>{{ s.name }}</td>
                      <td class="right mono">Cr{{ s.credits.toLocaleString() }}</td>
                      <td class="right mono">Cr{{ s.market_value.toLocaleString() }}</td>
                      <td class="right mono">Cr{{ s.cargo_value.toLocaleString() }}</td>
                      <td class="right mono">Cr{{ s.debt.toLocaleString() }}</td>
                      <td class="right mono">Cr{{ s.net_contribution.toLocaleString() }}</td>
                    </tr>
                  </tbody>
                </table>
                <p class="fleet-total">Org Treasury: Cr{{ orgFleetReport[o.id].organization_treasury.toLocaleString() }}</p>
                <p class="fleet-total">Fleet Net Worth: Cr{{ orgFleetReport[o.id].fleet_net_worth.toLocaleString() }}</p>
                <div class="income-breakdown">
                  <div v-for="[type, label] in INCOME_ENTRIES" :key="type" class="breakdown-row">
                    <span>{{ label }}</span><span class="mono pos">+Cr{{ (orgFleetReport[o.id].income_by_type[type] ?? 0).toLocaleString() }}</span>
                  </div>
                  <div v-for="[type, label] in EXPENSE_ENTRIES" :key="type" class="breakdown-row">
                    <span>{{ label }}</span><span class="mono neg">-Cr{{ Math.abs(orgFleetReport[o.id].income_by_type[type] ?? 0).toLocaleString() }}</span>
                  </div>
                </div>
              </template>
              <p v-if="orgFleetReportError[o.id]" class="form-error">{{ orgFleetReportError[o.id] }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ════════════════════════════════════════════════════════════════════ -->
    <!-- EVENTS TAB                                                           -->
    <!-- ════════════════════════════════════════════════════════════════════ -->
    <section v-if="activeTab === 'events'" class="tab-pane">
      <div class="events-layout">

        <!-- Active events -->
        <div class="events-col">
          <h2>Active Events</h2>
          <div v-if="!activeEvents.length" class="placeholder">No active events</div>
          <div v-else class="event-list">
            <div v-for="ev in activeEvents" :key="ev.id" class="event-card"
                 :class="ev.severity">
              <div class="event-card-body">
                <span class="event-desc">{{ ev.description }}</span>
                <span class="event-meta">
                  {{ ev.scope === 'local' ? ev.world_hex : 'Subsector' }}
                  <template v-if="ev.buy_modifier_pct != null">· Buy {{ ev.buy_modifier_pct > 0 ? '+' : '' }}{{ ev.buy_modifier_pct }}%</template>
                  <template v-if="ev.sell_modifier_pct != null">· Sell {{ ev.sell_modifier_pct > 0 ? '+' : '' }}{{ ev.sell_modifier_pct }}%</template>
                  · expires tick {{ ev.expires_tick }}
                </span>
              </div>
              <button class="btn-danger btn-xs"
                      @click="doExpireEvent(ev.id)">Expire</button>
            </div>
          </div>
        </div>

        <!-- Create event form -->
        <div class="events-col">
          <h2>Create Event</h2>
          <form class="detail-form" @submit.prevent="submitEvent">
            <div class="form-row">
              <label>Scope</label>
              <select v-model="newEvent.scope">
                <option value="local">Local (single world)</option>
                <option value="subsector">Subsector-wide</option>
              </select>
            </div>
            <div v-if="newEvent.scope === 'local'" class="form-row two-col">
              <div>
                <label>World Hex</label>
                <input v-model="newEvent.worldHex" placeholder="e.g. 1910" />
              </div>
              <div>
                <label>Sector</label>
                <input v-model="newEvent.sector" placeholder="e.g. Spinward Marches" />
              </div>
            </div>
            <div v-else class="form-row">
              <label>Sector</label>
              <input v-model="newEvent.sector" placeholder="e.g. Spinward Marches" />
            </div>
            <div class="form-row">
              <label>Description <span class="req">*</span></label>
              <input v-model="newEvent.description" required placeholder="What's happening?" />
            </div>
            <div class="form-row two-col">
              <div>
                <label>Buy modifier %</label>
                <input v-model.number="newEvent.buyModifierPct" type="number"
                       placeholder="+20 or -15" />
              </div>
              <div>
                <label>Sell modifier %</label>
                <input v-model.number="newEvent.sellModifierPct" type="number"
                       placeholder="+20 or -15" />
              </div>
            </div>
            <div class="form-row two-col">
              <div>
                <label>Duration (ticks)</label>
                <input v-model.number="newEvent.durationTicks" type="number" min="1" />
              </div>
            </div>
            <div class="form-row">
              <label>Trade Good Die</label>
              <input v-model="newEvent.tradeGoodDie" placeholder="e.g. 36 — leave blank for all" />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary"
                      :disabled="!newEvent.description.trim()">Create Event</button>
            </div>
            <p v-if="eventError" class="form-error">{{ eventError }}</p>
            <p v-if="eventSuccess" class="form-success">Event created.</p>
          </form>
        </div>

        <!-- Catalogue -->
        <div class="events-col">
          <h2>Quick Events</h2>
          <p class="cat-hint">Click a preset to pre-fill the form — then set scope/world and create.</p>
          <div class="catalogue-list">
            <button v-for="e in EVENT_CATALOGUE" :key="e.description"
                    class="cat-entry"
                    @click="loadCatalogueEntry(e)">
              <span class="cat-desc">{{ e.description }}</span>
              <span class="cat-meta">
                <span v-if="e.buyModifierPct != null" :class="e.buyModifierPct > 0 ? 'mod-up' : 'mod-down'">
                  Buy {{ e.buyModifierPct > 0 ? '+' : '' }}{{ e.buyModifierPct }}%
                </span>
                <span v-if="e.sellModifierPct != null" :class="e.sellModifierPct > 0 ? 'mod-up' : 'mod-down'">
                  Sell {{ e.sellModifierPct > 0 ? '+' : '' }}{{ e.sellModifierPct }}%
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ════════════════════════════════════════════════════════════════════ -->
    <!-- CAMPAIGN TAB                                                         -->
    <!-- ════════════════════════════════════════════════════════════════════ -->
    <section v-if="activeTab === 'campaign'" class="tab-pane">
      <div class="campaign-settings">
        <h2>Campaign Settings</h2>
        <div class="stat-grid wide">
          <div class="stat"><label>Campaign Code</label><span>{{ auth.campaign?.code }}</span></div>
          <div class="stat">
            <label>Label</label>
            <form v-if="editingLabel" class="inline-label-form" @submit.prevent="submitLabel">
              <input v-model="labelDraft" class="label-input" required />
              <button type="submit" class="btn-primary btn-xs" :disabled="labelSaving">Save</button>
              <button type="button" class="btn-ghost btn-xs" @click="cancelLabel">Cancel</button>
            </form>
            <span v-else class="label-display">
              {{ auth.campaign?.label }}
              <button class="edit-inline-btn" @click="startEditLabel">Edit</button>
            </span>
            <p v-if="labelError" class="form-error">{{ labelError }}</p>
          </div>
          <div class="stat"><label>Milieu</label><span>{{ auth.campaign?.milieu }}</span></div>
          <div class="stat locked">
            <label>Trade Rules</label>
            <span>{{ auth.campaign?.trade_rules }}
              <span class="lock-note">locked at creation</span>
            </span>
          </div>
        </div>

        <div class="campaign-traveller-map">
          <h3>Traveller Map</h3>
          <p>View the sector map and world details on the official Traveller Map.</p>
          <a :href="travellerMapUrl" target="_blank" rel="noopener" class="btn-primary external-link">
            Open Traveller Map ↗
          </a>
        </div>

        <div class="campaign-security">
          <h3>Security</h3>
          <p>The recovery code lets you reset any character's PIN from the sign-in screen without database access.</p>
          <p class="security-warn">Generating a new code immediately invalidates the previous one.</p>
          <button class="btn-secondary" :disabled="regenLoading" @click="doRegenerate">
            {{ regenLoading ? 'Generating…' : 'Generate New Recovery Code' }}
          </button>
          <div v-if="regenError" class="regen-error">{{ regenError }}</div>
        </div>

        <div class="campaign-danger">
          <h3>Danger Zone</h3>
          <p>Permanently delete this campaign and all its data — ships, cargo, market history, players, and events. This action cannot be undone.</p>
          <template v-if="!showDeleteConfirm">
            <button class="btn-danger btn-delete" @click="openDeleteConfirm">Delete Campaign…</button>
          </template>
          <template v-else>
            <p class="delete-warn">Enter your Referee PIN to confirm deletion.</p>
            <div class="delete-form">
              <input v-model="deletePin"
                     type="password"
                     placeholder="Referee PIN"
                     autocomplete="current-password"
                     class="delete-pin-input"
                     @keydown.enter.prevent="doDeleteCampaign"
                     @keydown.escape.prevent="cancelDelete" />
              <button class="btn-danger"
                      :disabled="!deletePin.trim() || deleteLoading"
                      @click="doDeleteCampaign">
                {{ deleteLoading ? 'Deleting…' : 'Confirm Delete' }}
              </button>
              <button class="btn-ghost" @click="cancelDelete">Cancel</button>
            </div>
            <p v-if="deleteError" class="form-error">{{ deleteError }}</p>
          </template>
        </div>
      </div>
    </section>

  </main>

  <RecoveryCodeDialog
    v-if="newRecoveryCode"
    :code="newRecoveryCode"
    @close="newRecoveryCode = null"
  />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useTickStore } from '../stores/tick.js'
import { useRefereeStore } from '../stores/referee.js'
import { api } from '../lib/api.js'
import RecoveryCodeDialog from '../components/RecoveryCodeDialog.vue'
import { INCOME_TYPES, EXPENSE_TYPES } from '../lib/reports.js'

const router = useRouter()
const auth   = useAuthStore()
const tick   = useTickStore()
const referee = useRefereeStore()

const INCOME_ENTRIES  = Object.entries(INCOME_TYPES)
const EXPENSE_ENTRIES = Object.entries(EXPENSE_TYPES)

const TABS = [
  { key: 'ships',         label: 'Ships'         },
  { key: 'players',       label: 'Players'       },
  { key: 'organizations', label: 'Organizations' },
  { key: 'events',        label: 'Events'        },
  { key: 'campaign',      label: 'Campaign'      },
]

const CREW_ROLES = ['captain', 'pilot', 'navigator', 'engineer', 'medic', 'steward', 'gunner', 'cargo-master', 'crew']

const activeTab = ref('ships')

function switchTab(key) {
  activeTab.value = key
  if (key === 'players') loadPlayers()
}

// ── Campaign tab state ───────────────────────────────────────────────────────

const newRecoveryCode  = ref(null)
const regenLoading     = ref(false)
const regenError       = ref('')
const showDeleteConfirm = ref(false)
const deletePin        = ref('')
const deleteLoading    = ref(false)
const deleteError      = ref('')

async function doRegenerate() {
  regenLoading.value = true
  regenError.value   = ''
  const result = await auth.regenerateRecoveryCode()
  regenLoading.value = false
  if (result.ok) newRecoveryCode.value = result.recoveryCode
  else regenError.value = result.error ?? 'Failed to regenerate'
}

function openDeleteConfirm() {
  showDeleteConfirm.value = true
  deletePin.value         = ''
  deleteError.value       = ''
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deletePin.value         = ''
  deleteError.value       = ''
}

async function doDeleteCampaign() {
  if (!deletePin.value.trim()) return
  deleteLoading.value = true
  deleteError.value   = ''
  const result = await auth.deleteCampaign({ pin: deletePin.value })
  deleteLoading.value = false
  if (result.ok) {
    router.push({ name: 'login' })
  } else {
    deleteError.value = result.error ?? 'Deletion failed'
    deletePin.value   = ''
  }
}

// ── Ships tab state ──────────────────────────────────────────────────────────

const selectedShipId  = ref(null)
const showNewShipForm = ref(false)
const editingShip     = ref(false)
const showAddCrew     = ref(false)
const shipError       = ref('')
const crewError       = ref('')

const showSaveTemplate   = ref(false)
const saveTemplateName   = ref('')
const saveTemplateError  = ref('')
const saveTemplateSuccess = ref('')

const newCrewPlayerId = ref('')
const newCrewRole     = ref('crew')

const NEW_SHIP_DEFAULTS = {
  name: '', hullType: '', hullTons: 200, cargoCapacity: 80, credits: 0,
  jumpRating: null, maneuverRating: null, staterooms: 0, lowBerths: 0,
  fuelCapacity: 0, fuelCurrent: 0, marketValue: 0,
}
const newShip = ref({ ...NEW_SHIP_DEFAULTS })
const editShipFields = ref({})

const selectedTemplateId = ref('')   // '' = Custom Design

function applyTemplate(templateId) {
  if (!templateId) { newShip.value = { ...NEW_SHIP_DEFAULTS }; return }
  const t = referee.templates.find(t => t.id === templateId)
  if (!t) return
  newShip.value = {
    ...newShip.value,
    hullType:      t.hull_type ?? '',
    hullTons:      t.hull_tons,
    cargoCapacity: t.cargo_capacity,
    jumpRating:    t.jump_rating,
    maneuverRating: t.maneuver_drive_rating,
    staterooms:    t.stateroom_capacity,
    lowBerths:     t.low_berth_capacity,
    fuelCapacity:  t.fuel_capacity,
    marketValue:   t.market_value,
  }
}

// ── Manage Templates panel ────────────────────────────────────────────────
const showManageTemplates = ref(false)
const templateError       = ref('')
const editingTemplateId   = ref(null)

const TEMPLATE_DEFAULTS = {
  name: '', hullType: '', hullTons: 200, cargoCapacity: 80,
  jumpRating: null, maneuverRating: null, staterooms: 0, lowBerths: 0,
  fuelCapacity: 0, marketValue: 0, notes: '',
}
const templateForm = ref({ ...TEMPLATE_DEFAULTS })

function openManageTemplates() {
  showManageTemplates.value = true
  showNewShipForm.value     = false
  selectedShipId.value      = null
  templateError.value       = ''
  editingTemplateId.value   = null
  templateForm.value        = { ...TEMPLATE_DEFAULTS }
}

function closeManageTemplates() {
  showManageTemplates.value = false
}

function startEditTemplate(t) {
  editingTemplateId.value = t.id
  templateForm.value = {
    name: t.name, hullType: t.hull_type ?? '', hullTons: t.hull_tons,
    cargoCapacity: t.cargo_capacity, jumpRating: t.jump_rating,
    maneuverRating: t.maneuver_drive_rating, staterooms: t.stateroom_capacity,
    lowBerths: t.low_berth_capacity, fuelCapacity: t.fuel_capacity,
    marketValue: t.market_value, notes: t.notes ?? '',
  }
}

function cancelEditTemplate() {
  editingTemplateId.value = null
  templateForm.value      = { ...TEMPLATE_DEFAULTS }
}

async function submitTemplateForm() {
  templateError.value = ''
  const f = templateForm.value
  const payload = {
    name: f.name, hullType: f.hullType, hullTons: f.hullTons, cargoCapacity: f.cargoCapacity,
    jumpRating: f.jumpRating, maneuverRating: f.maneuverRating, staterooms: f.staterooms,
    lowBerths: f.lowBerths, fuelCapacity: f.fuelCapacity, marketValue: f.marketValue, notes: f.notes,
  }
  try {
    if (editingTemplateId.value) {
      await referee.updateShipTemplate(editingTemplateId.value, {
        name: f.name.trim(), hull_type: f.hullType || null, hull_tons: f.hullTons,
        cargo_capacity: f.cargoCapacity, jump_rating: f.jumpRating || null,
        maneuver_drive_rating: f.maneuverRating || null, stateroom_capacity: f.staterooms,
        low_berth_capacity: f.lowBerths, fuel_capacity: f.fuelCapacity,
        market_value: f.marketValue, notes: f.notes || null,
      })
    } else {
      await referee.createShipTemplate(payload)
    }
    cancelEditTemplate()
  } catch (e) {
    templateError.value = e.message
  }
}

async function removeTemplate(t) {
  if (!confirm(`Delete template "${t.name}"?`)) return
  templateError.value = ''
  try {
    await referee.deleteShipTemplate(t.id)
  } catch (e) {
    templateError.value = e.message
  }
}

const selectedShip = computed(() => referee.ships.find(s => s.id === selectedShipId.value) ?? null)

const unassignedPlayers = computed(() => {
  const assignedIds = new Set(referee.ships.flatMap(s => s.crew.map(c => c.players?.id)))
  return referee.players.filter(p => !assignedIds.has(p.id))
})

const shipPassengers      = ref([])
const refPassengerLoading = ref(false)
const refPassengerError   = ref('')

async function loadShipPassengers(shipId) {
  if (!shipId) { shipPassengers.value = []; return }
  refPassengerLoading.value = true
  refPassengerError.value   = ''
  const { data, error: err } = await api.get(`/api/ships/${shipId}/passengers`, {
    campaign_id: auth.campaign.id,
  })
  refPassengerLoading.value = false
  if (err) { refPassengerError.value = err; return }
  shipPassengers.value = data ?? []
}

async function doRefundPassenger(manifest) {
  if (!confirm(`Refund ${manifest.count}× ${manifest.passage_type} passage (Cr${manifest.fare_total.toLocaleString()})?`)) return
  refPassengerError.value = ''

  const { error } = await api.post(`/api/referee/ships/${manifest.ship_id}/refund-passenger`, {
    manifest_id: manifest.id,
    tick:        tick.currentTick,
    campaign_id: auth.campaign.id,
    player_id:   manifest.player_id,
  })

  if (error) { refPassengerError.value = error; return }

  // Update referee store local state
  const s = referee.ships.find(sh => sh.id === manifest.ship_id)
  if (s) s.credits = (s.credits ?? 0) - manifest.fare_total

  shipPassengers.value = shipPassengers.value.filter(p => p.id !== manifest.id)
}

const shipDebts     = ref([])
const debtsLoading  = ref(false)
const debtsError    = ref('')
const showAddDebt   = ref(false)
const editingDebtId = ref(null)

const DEBT_DEFAULTS = { type: 'loan', creditorName: '', principal: 0, currentBalance: 0, dueTick: null, notes: '' }
const debtForm       = ref({ ...DEBT_DEFAULTS })

async function loadShipDebts(shipId) {
  if (!shipId) { shipDebts.value = []; return }
  debtsLoading.value = true
  debtsError.value   = ''
  const { data, error: err } = await api.get('/api/referee/ship-debts', { ship_id: shipId })
  debtsLoading.value = false
  if (err) { debtsError.value = err; return }
  shipDebts.value = data ?? []
}

function openAddDebt() {
  showAddDebt.value   = true
  editingDebtId.value = null
  debtForm.value      = { ...DEBT_DEFAULTS }
}

function startEditDebt(d) {
  showAddDebt.value   = true
  editingDebtId.value = d.id
  debtForm.value = {
    type: d.type, creditorName: d.creditor_name ?? '', principal: d.principal,
    currentBalance: d.current_balance, dueTick: d.due_tick, notes: d.notes ?? '',
  }
}

function cancelDebtForm() {
  showAddDebt.value   = false
  editingDebtId.value = null
  debtForm.value      = { ...DEBT_DEFAULTS }
}

async function submitDebtForm() {
  debtsError.value = ''
  const f = debtForm.value
  const payload = {
    type: f.type, creditor_name: f.creditorName || null, principal: f.principal,
    current_balance: f.currentBalance, due_tick: f.dueTick, notes: f.notes || null,
  }
  try {
    if (editingDebtId.value) {
      const { error: err } = await api.patch(`/api/referee/ship-debts/${editingDebtId.value}`, payload)
      if (err) throw new Error(err)
    } else {
      const { error: err } = await api.post('/api/referee/ship-debts', {
        ship_id: selectedShipId.value, ...payload,
      })
      if (err) throw new Error(err)
    }
    cancelDebtForm()
    await loadShipDebts(selectedShipId.value)
  } catch (e) {
    debtsError.value = e.message
  }
}

async function removeDebt(d) {
  if (!confirm(`Delete debt "${d.creditor_name || d.type}"?`)) return
  debtsError.value = ''
  const { error: err } = await api.delete(`/api/referee/ship-debts/${d.id}`)
  if (err) { debtsError.value = err; return }
  shipDebts.value = shipDebts.value.filter(x => x.id !== d.id)
}

const shipOwnership      = ref([])
const ownershipLoading   = ref(false)
const ownershipError     = ref('')
const showAddOwnership   = ref(false)
const editingOwnershipId = ref(null)

const OWNERSHIP_DEFAULTS = { playerId: '', percentage: 100 }
const ownershipForm      = ref({ ...OWNERSHIP_DEFAULTS })

const ownershipTotal = computed(() => shipOwnership.value.reduce((s, o) => s + o.percentage, 0))

async function loadShipOwnership(shipId) {
  if (!shipId) { shipOwnership.value = []; return }
  ownershipLoading.value = true
  ownershipError.value   = ''
  const { data, error: err } = await api.get('/api/referee/ship-ownership', { ship_id: shipId })
  ownershipLoading.value = false
  if (err) { ownershipError.value = err; return }
  shipOwnership.value = data ?? []
}

function openAddOwnership() {
  showAddOwnership.value   = true
  editingOwnershipId.value = null
  ownershipForm.value      = { ...OWNERSHIP_DEFAULTS }
}

function cancelOwnershipForm() {
  showAddOwnership.value   = false
  editingOwnershipId.value = null
  ownershipForm.value      = { ...OWNERSHIP_DEFAULTS }
}

function startEditOwnership(o) {
  showAddOwnership.value   = true
  editingOwnershipId.value = o.id
  ownershipForm.value      = { playerId: o.player_id, percentage: o.percentage }
}

async function submitOwnershipForm() {
  ownershipError.value = ''
  try {
    if (editingOwnershipId.value) {
      const { error: err } = await api.patch(`/api/referee/ship-ownership/${editingOwnershipId.value}`, {
        percentage: ownershipForm.value.percentage,
      })
      if (err) throw new Error(err)
    } else {
      const { error: err } = await api.post('/api/referee/ship-ownership', {
        ship_id:    selectedShipId.value,
        player_id:  ownershipForm.value.playerId,
        percentage: ownershipForm.value.percentage,
      })
      if (err) throw new Error(err)
    }
    cancelOwnershipForm()
    await loadShipOwnership(selectedShipId.value)
  } catch (e) {
    ownershipError.value = e.message
  }
}

async function removeOwnership(o) {
  if (!confirm(`Remove ${o.character_name}'s ${o.percentage}% share?`)) return
  ownershipError.value = ''
  const { error: err } = await api.delete(`/api/referee/ship-ownership/${o.id}`)
  if (err) { ownershipError.value = err; return }
  shipOwnership.value = shipOwnership.value.filter(x => x.id !== o.id)
}

function selectShip(id) {
  selectedShipId.value = id
  showNewShipForm.value = false
  showManageTemplates.value = false
  editingShip.value     = false
  showAddCrew.value     = false
  shipError.value       = ''
  crewError.value       = ''
  shipPassengers.value  = []
  showAddDebt.value      = false
  editingDebtId.value    = null
  showSaveTemplate.value    = false
  saveTemplateName.value    = ''
  saveTemplateError.value   = ''
  saveTemplateSuccess.value = ''
  showAddOwnership.value    = false
  editingOwnershipId.value  = null
  if (selectedShip.value) {
    const s = selectedShip.value
    editShipFields.value = {
      hullType:          s.hull_type             ?? '',
      hullTons:          s.hull_tons             ?? 200,
      cargoCapacity:     s.cargo_capacity        ?? 80,
      stateroomCapacity: s.stateroom_capacity    ?? 0,
      lowBerthCapacity:  s.low_berth_capacity    ?? 0,
      fuelCapacity:      s.fuel_capacity         ?? 0,
      fuelCurrent:       s.fuel_current          ?? 0,
      credits:           s.credits               ?? 0,
      jumpRating:        s.jump_rating           ?? null,
      maneuverRating:    s.maneuver_drive_rating ?? null,
      marketValue:       s.market_value          ?? 0,
      currentWorld:      s.current_world         ?? '',
      currentSector:     s.current_sector        ?? '',
    }
  }
  loadShipPassengers(id)
  loadShipDebts(id)
  loadShipOwnership(id)
}

function openNewShip() {
  showNewShipForm.value      = true
  showManageTemplates.value  = false
  selectedShipId.value       = null
  shipError.value            = ''
  selectedTemplateId.value   = ''
  newShip.value = { ...NEW_SHIP_DEFAULTS }
}

function cancelNewShip() {
  showNewShipForm.value = false
  shipError.value       = ''
}

async function submitNewShip() {
  shipError.value = ''
  try {
    const created = await referee.createShip(auth.campaign.id, newShip.value)
    showNewShipForm.value = false
    selectShip(created.id)
  } catch (e) {
    shipError.value = e.message
  }
}

async function submitEditShip() {
  const prevWorld  = selectedShip.value?.current_world  ?? null
  const prevSector = selectedShip.value?.current_sector ?? null
  const newWorld   = editShipFields.value.currentWorld  || null
  const newSector  = editShipFields.value.currentSector || null

  try {
    await referee.updateShip(selectedShipId.value, {
      hull_type:             editShipFields.value.hullType           || null,
      hull_tons:             editShipFields.value.hullTons,
      cargo_capacity:        editShipFields.value.cargoCapacity,
      stateroom_capacity:    editShipFields.value.stateroomCapacity  ?? 0,
      low_berth_capacity:    editShipFields.value.lowBerthCapacity   ?? 0,
      fuel_capacity:         editShipFields.value.fuelCapacity       ?? 0,
      fuel_current:          editShipFields.value.fuelCurrent        ?? 0,
      credits:               editShipFields.value.credits,
      jump_rating:           editShipFields.value.jumpRating          || null,
      maneuver_drive_rating: editShipFields.value.maneuverRating      || null,
      market_value:          editShipFields.value.marketValue         ?? 0,
      current_world:         newWorld,
      current_sector:        newSector,
    })
    editingShip.value = false

    // Auto-deliver passengers/mail if ship moved to a new world
    if (newWorld && newSector && (newWorld !== prevWorld || newSector !== prevSector)) {
      await autoDeliverOnMove(selectedShipId.value, newWorld, newSector)
      await loadShipPassengers(selectedShipId.value)
    }
  } catch (e) {
    shipError.value = e.message
  }
}

async function submitSaveAsTemplate() {
  saveTemplateError.value   = ''
  saveTemplateSuccess.value = ''
  const s = selectedShip.value
  if (!s) return

  try {
    await referee.createShipTemplate({
      name:           saveTemplateName.value,
      hullType:       s.hull_type,
      hullTons:       s.hull_tons,
      cargoCapacity:  s.cargo_capacity,
      jumpRating:     s.jump_rating,
      maneuverRating: s.maneuver_drive_rating,
      staterooms:     s.stateroom_capacity,
      lowBerths:      s.low_berth_capacity,
      fuelCapacity:   s.fuel_capacity,
      marketValue:    s.market_value,
      notes:          `Saved from ship "${s.name}"`,
    })
    saveTemplateSuccess.value = `Saved as template "${saveTemplateName.value.trim()}"`
    saveTemplateName.value    = ''
    setTimeout(() => {
      showSaveTemplate.value    = false
      saveTemplateSuccess.value = ''
    }, 2000)
  } catch (e) {
    saveTemplateError.value = e.message
  }
}

async function autoDeliverOnMove(shipId, worldHex, sector) {
  const { data } = await api.post(`/api/referee/ships/${shipId}/auto-deliver`, {
    world_hex:   worldHex,
    sector,
    tick:        tick.currentTick,
    campaign_id: auth.campaign.id,
    player_id:   auth.player.id,
  })

  // Update referee store local state for mail payments
  if (data?.mail_delivered > 0) {
    const s = referee.ships.find(sh => sh.id === shipId)
    if (s) {
      // Reload ship to get accurate credits (auto-deliver batched the update)
      await referee.loadShips(auth.campaign.id)
    }
  }
}

async function submitAddCrew() {
  crewError.value = ''
  try {
    await referee.assignCrew(
      auth.campaign.id,
      selectedShipId.value,
      newCrewPlayerId.value,
      newCrewRole.value,
      tick.currentTick,
    )
    showAddCrew.value   = false
    newCrewPlayerId.value = ''
    newCrewRole.value     = 'crew'
  } catch (e) {
    crewError.value = e.message
  }
}

async function changeCrewRole(crewRow, newRole) {
  await referee.updateCrewRole(crewRow, newRole)
}

async function confirmRemoveCrew(c) {
  const name = c.players?.character_name ?? 'this crew member'
  if (!confirm(`Remove ${name} from ${selectedShip.value?.name}?`)) return
  try {
    await referee.removeCrew(c.id, tick.currentTick)
  } catch (e) {
    crewError.value = e.message
  }
}

// ── Players tab state ────────────────────────────────────────────────────────

const expandedPlayerId = ref(null)
const newSkillName     = ref({})
const newSkillLevel    = ref({})
const skillError       = ref({})

function togglePlayer(id) {
  expandedPlayerId.value = expandedPlayerId.value === id ? null : id
}

async function loadPlayers() {
  await referee.loadPlayers(auth.campaign.id)
}

async function saveSkill(player, skillName, level) {
  skillError.value[player.id] = ''
  try {
    await referee.upsertSkill(auth.campaign.id, player.id, skillName, level)
  } catch (e) {
    skillError.value[player.id] = e.message
  }
}

async function addSkill(player) {
  const name  = newSkillName.value[player.id]?.trim()
  const level = newSkillLevel.value[player.id] ?? 0
  if (!name) return
  skillError.value[player.id] = ''
  try {
    await referee.upsertSkill(auth.campaign.id, player.id, name, level)
    newSkillName.value[player.id]  = ''
    newSkillLevel.value[player.id] = 0
  } catch (e) {
    skillError.value[player.id] = e.message
  }
}

async function deleteSkill(player, skillId) {
  skillError.value[player.id] = ''
  try {
    await referee.removeSkill(player.id, skillId)
  } catch (e) {
    skillError.value[player.id] = e.message
  }
}

// ── Organizations tab state ──────────────────────────────────────────────────

const showNewOrg = ref(false)
const orgError   = ref('')
const NEW_ORG_DEFAULTS = { name: '', treasuryCredits: 0, duesRate: null, notes: '' }
const newOrg = ref({ ...NEW_ORG_DEFAULTS })

const expandedOrgId     = ref(null)
const orgEditFields     = ref({})   // { [orgId]: { treasuryCredits, duesRate, duesFrequencyTicks } }
const orgMembers        = ref({})   // { [orgId]: [...] }
const newMemberShipId   = ref({})   // { [orgId]: shipId }
const newMemberOwnsShip = ref({})   // { [orgId]: bool }
const orgMemberError    = ref({})   // { [orgId]: string }
const orgOfficers        = ref({})   // { [orgId]: [...] }
const newOfficerPlayerId = ref({})   // { [orgId]: playerId }
const orgOfficerError    = ref({})   // { [orgId]: string }

const orgDuesBusy    = ref({})   // { [orgId]: bool }
const orgDuesResult  = ref({})   // { [orgId]: string }
const orgDuesError   = ref({})   // { [orgId]: string }

const orgDisburseShipId = ref({})   // { [orgId]: shipId }
const orgDisburseAmount = ref({})   // { [orgId]: number }
const orgDisburseError  = ref({})   // { [orgId]: string }

const orgEquity           = ref({})   // { [orgId]: [...] }
const newEquityPlayerId   = ref({})   // { [orgId]: playerId }
const newEquityPercentage = ref({})   // { [orgId]: number }
const orgEquityError      = ref({})   // { [orgId]: string }

const orgFleetReport        = ref({})   // { [orgId]: {...} }
const orgFleetReportOpen    = ref({})   // { [orgId]: bool }
const orgFleetReportLoading = ref({})   // { [orgId]: bool }
const orgFleetReportError   = ref({})   // { [orgId]: string }

function orgNextDueTick(o) {
  if (o.last_dues_tick == null) return null
  return o.last_dues_tick + o.dues_frequency_ticks
}

function isOrgDuesDue(o) {
  const next = orgNextDueTick(o)
  return next == null || tick.currentTick >= next
}

async function submitNewOrg() {
  orgError.value = ''
  try {
    await referee.createOrganization(newOrg.value)
    showNewOrg.value = false
    newOrg.value = { ...NEW_ORG_DEFAULTS }
  } catch (e) {
    orgError.value = e.message
  }
}

async function toggleOrg(orgId) {
  if (expandedOrgId.value === orgId) { expandedOrgId.value = null; return }
  expandedOrgId.value = orgId
  const org = referee.organizations.find(o => o.id === orgId)
  orgEditFields.value[orgId] = {
    treasuryCredits: org.treasury_credits, duesRate: org.dues_rate,
    duesFrequencyTicks: org.dues_frequency_ticks,
  }
  await Promise.all([loadOrgMembers(orgId), loadOrgOfficers(orgId), loadOrgEquity(orgId)])
}

async function loadOrgMembers(orgId) {
  const { data, error: err } = await api.get(`/api/organizations/${orgId}/members`)
  if (err) { orgMemberError.value[orgId] = err; return }
  orgMembers.value[orgId] = data ?? []
}

async function loadOrgOfficers(orgId) {
  const { data, error: err } = await api.get(`/api/organizations/${orgId}/officers`)
  if (err) { orgOfficerError.value[orgId] = err; return }
  orgOfficers.value[orgId] = data ?? []
}

async function submitEditOrg(o) {
  orgError.value = ''
  try {
    await referee.updateOrganization(o.id, {
      treasury_credits:     orgEditFields.value[o.id].treasuryCredits,
      dues_rate:            orgEditFields.value[o.id].duesRate,
      dues_frequency_ticks: orgEditFields.value[o.id].duesFrequencyTicks,
    })
  } catch (e) {
    orgError.value = e.message
  }
}

async function removeOrg(o) {
  if (!confirm(`Delete organization "${o.name}"?`)) return
  try {
    await referee.deleteOrganization(o.id)
    if (expandedOrgId.value === o.id) expandedOrgId.value = null
  } catch (e) {
    orgError.value = e.message
  }
}

async function addOrgMember(orgId) {
  orgMemberError.value[orgId] = ''
  try {
    const { data, error: err } = await api.post(`/api/organizations/${orgId}/members`, {
      ship_id:   newMemberShipId.value[orgId],
      owns_ship: !!newMemberOwnsShip.value[orgId],
    })
    if (err) throw new Error(err)
    orgMembers.value[orgId] = [...(orgMembers.value[orgId] ?? []), data]
    newMemberShipId.value[orgId]   = ''
    newMemberOwnsShip.value[orgId] = false
  } catch (e) {
    orgMemberError.value[orgId] = e.message
  }
}

async function removeOrgMember(orgId, m) {
  if (!confirm(`Remove ${m.ship_name} from this organization?`)) return
  const { error: err } = await api.delete(`/api/organizations/${orgId}/members/${m.id}`)
  if (err) { orgMemberError.value[orgId] = err; return }
  orgMembers.value[orgId] = orgMembers.value[orgId].filter(x => x.id !== m.id)
}

async function toggleOrgMemberOwnsShip(orgId, m, ownsShip) {
  orgMemberError.value[orgId] = ''
  const { data, error: err } = await api.patch(`/api/organizations/${orgId}/members/${m.id}`, { owns_ship: ownsShip })
  if (err) { orgMemberError.value[orgId] = err; return }
  orgMembers.value[orgId] = orgMembers.value[orgId].map(x => x.id === m.id ? data : x)
}

async function addOrgOfficer(orgId) {
  orgOfficerError.value[orgId] = ''
  try {
    const { data, error: err } = await api.post(`/api/organizations/${orgId}/officers`, {
      player_id: newOfficerPlayerId.value[orgId],
    })
    if (err) throw new Error(err)
    orgOfficers.value[orgId] = [...(orgOfficers.value[orgId] ?? []), data]
    newOfficerPlayerId.value[orgId] = ''
  } catch (e) {
    orgOfficerError.value[orgId] = e.message
  }
}

async function removeOrgOfficer(orgId, off) {
  if (!confirm(`Remove ${off.character_name} as an officer of this organization?`)) return
  const { error: err } = await api.delete(`/api/organizations/${orgId}/officers/${off.player_id}`)
  if (err) { orgOfficerError.value[orgId] = err; return }
  orgOfficers.value[orgId] = orgOfficers.value[orgId].filter(x => x.id !== off.id)
}

async function collectOrgDues(o) {
  orgDuesError.value[o.id]  = ''
  orgDuesResult.value[o.id] = ''
  orgDuesBusy.value[o.id]   = true
  const { data, error: err } = await api.post(`/api/organizations/${o.id}/collect-dues`, { tick: tick.currentTick })
  orgDuesBusy.value[o.id] = false
  if (err) { orgDuesError.value[o.id] = err; return }
  referee.organizations = referee.organizations.map(x => x.id === o.id ? { ...x, ...data.organization } : x)
  orgDuesResult.value[o.id] =
    `Collected Cr${data.collected_total.toLocaleString()} from ${data.paid_ship_ids.length} ship(s)` +
    (data.failed_ship_ids.length ? ` — ${data.failed_ship_ids.length} unable to pay` : '')
}

async function submitOrgDisburse(o) {
  orgDisburseError.value[o.id] = ''
  const { data, error: err } = await api.post(`/api/organizations/${o.id}/disburse`, {
    ship_id: orgDisburseShipId.value[o.id],
    amount:  orgDisburseAmount.value[o.id],
    tick:    tick.currentTick,
  })
  if (err) { orgDisburseError.value[o.id] = err; return }
  referee.organizations = referee.organizations.map(x => x.id === o.id ? { ...x, ...data.organization } : x)
  orgDisburseShipId.value[o.id] = ''
  orgDisburseAmount.value[o.id] = null
}

async function loadOrgEquity(orgId) {
  const { data, error: err } = await api.get(`/api/organizations/${orgId}/ownership`)
  if (err) { orgEquityError.value[orgId] = err; return }
  orgEquity.value[orgId] = data ?? []
}

async function addOrgEquity(orgId) {
  orgEquityError.value[orgId] = ''
  const { data, error: err } = await api.post(`/api/organizations/${orgId}/ownership`, {
    player_id:  newEquityPlayerId.value[orgId],
    percentage: newEquityPercentage.value[orgId],
  })
  if (err) { orgEquityError.value[orgId] = err; return }
  orgEquity.value[orgId] = [...(orgEquity.value[orgId] ?? []), data]
  newEquityPlayerId.value[orgId]   = ''
  newEquityPercentage.value[orgId] = null
}

async function removeOrgEquity(orgId, eq) {
  if (!confirm(`Remove ${eq.character_name}'s equity stake?`)) return
  const { error: err } = await api.delete(`/api/organizations/${orgId}/ownership/${eq.id}`)
  if (err) { orgEquityError.value[orgId] = err; return }
  orgEquity.value[orgId] = orgEquity.value[orgId].filter(x => x.id !== eq.id)
}

async function toggleOrgFleetReport(orgId) {
  orgFleetReportOpen.value[orgId] = !orgFleetReportOpen.value[orgId]
  if (orgFleetReportOpen.value[orgId] && !orgFleetReport.value[orgId]) {
    orgFleetReportLoading.value[orgId] = true
    const { data, error: err } = await api.get(`/api/organizations/${orgId}/fleet-report`)
    orgFleetReportLoading.value[orgId] = false
    if (err) { orgFleetReportError.value[orgId] = err; return }
    orgFleetReport.value[orgId] = data
  }
}

// ── Events tab state ─────────────────────────────────────────────────────────

const eventError   = ref('')
const eventSuccess = ref(false)

const newEvent = ref({
  scope: 'local', worldHex: '', sector: '', description: '',
  buyModifierPct: null, sellModifierPct: null, durationTicks: 4, tradeGoodDie: '',
})

// Pre-built M.U.L.E.-style events. Referee selects one to pre-fill the form,
// then sets the world/scope/duration before creating.
const EVENT_CATALOGUE = [
  { description: 'Pirate raid disrupts supply lines',       buyModifierPct:  30, sellModifierPct: null, durationTicks: 4 },
  { description: 'Trade embargo imposed',                   buyModifierPct:  20, sellModifierPct: -20,  durationTicks: 8 },
  { description: 'Bumper harvest floods the market',        buyModifierPct: -20, sellModifierPct: -30,  durationTicks: 4 },
  { description: 'Drought: food & consumables scarce',      buyModifierPct:  25, sellModifierPct:  25,  durationTicks: 6 },
  { description: 'Tech festival drives demand',             buyModifierPct:  15, sellModifierPct:  20,  durationTicks: 3 },
  { description: 'Port workers strike',                     buyModifierPct:  10, sellModifierPct: -10,  durationTicks: 3 },
  { description: 'Imperial subsidy lowers prices',          buyModifierPct: -15, sellModifierPct: null, durationTicks: 4 },
  { description: 'Megacorp buyout: prices spike',           buyModifierPct:  20, sellModifierPct:  20,  durationTicks: 6 },
  { description: 'Military contract boosts demand',         buyModifierPct:  20, sellModifierPct:  25,  durationTicks: 4 },
  { description: 'Misjump quarantine: traffic halted',      buyModifierPct:  15, sellModifierPct: -25,  durationTicks: 5 },
  { description: 'New refinery opens: fuel costs drop',     buyModifierPct: -10, sellModifierPct: null, durationTicks: 8 },
  { description: 'Scout survey finds rich lode',            buyModifierPct: -20, sellModifierPct:  15,  durationTicks: 6 },
  { description: 'Political unrest disrupts distribution',  buyModifierPct:  15, sellModifierPct: -15,  durationTicks: 4 },
  { description: 'Festival of the Traveller: demand surge', buyModifierPct:  10, sellModifierPct:  15,  durationTicks: 2 },
  { description: 'Counterfeit goods scandal',               buyModifierPct: null, sellModifierPct: -20,  durationTicks: 4 },
  { description: 'Pandemic scare: medical goods scarce',    buyModifierPct:  30, sellModifierPct:  30,  durationTicks: 6 },
  { description: 'Surplus clearance: bulk discount',        buyModifierPct: -25, sellModifierPct: -15,  durationTicks: 3 },
  { description: 'Noble house patronage: luxury demand up', buyModifierPct:  15, sellModifierPct:  25,  durationTicks: 4 },
  { description: 'Wormhole route opens: competition rises', buyModifierPct: -10, sellModifierPct: -10,  durationTicks: 12 },
  { description: 'Natural disaster: relief goods needed',   buyModifierPct:  35, sellModifierPct:  35,  durationTicks: 6 },
]

function loadCatalogueEntry(entry) {
  newEvent.value = {
    ...newEvent.value,
    description:     entry.description,
    buyModifierPct:  entry.buyModifierPct  ?? null,
    sellModifierPct: entry.sellModifierPct ?? null,
    durationTicks:   entry.durationTicks   ?? 4,
  }
}

const activeEvents = computed(() => tick.activeEvents ?? [])

async function doExpireEvent(eventId) {
  try {
    await referee.expireEvent(eventId, tick.currentTick)
    // Remove from tick store's local list immediately
    if (tick.activeEvents) {
      tick.activeEvents = tick.activeEvents.filter(e => e.id !== eventId)
    }
  } catch (e) {
    eventError.value = e.message
  }
}

async function submitEvent() {
  eventError.value   = ''
  eventSuccess.value = false
  try {
    await referee.createEvent(auth.campaign.id, {
      ...newEvent.value,
      currentTick: tick.currentTick,
    })
    eventSuccess.value = true
    newEvent.value = {
      scope: 'local', worldHex: '', sector: '', description: '',
      buyModifierPct: null, sellModifierPct: null, durationTicks: 4, tradeGoodDie: '',
    }
    setTimeout(() => { eventSuccess.value = false }, 3000)
  } catch (e) {
    eventError.value = e.message
  }
}

// ── Campaign tab ─────────────────────────────────────────────────────────────

const editingLabel = ref(false)
const labelDraft   = ref('')
const labelSaving  = ref(false)
const labelError   = ref('')

function startEditLabel() {
  labelDraft.value   = auth.campaign?.label ?? ''
  editingLabel.value = true
  labelError.value   = ''
}

function cancelLabel() {
  editingLabel.value = false
  labelError.value   = ''
}

async function submitLabel() {
  const trimmed = labelDraft.value.trim()
  if (!trimmed) return
  labelSaving.value = true
  labelError.value  = ''
  const { error: err } = await api.patch(`/api/campaigns/${auth.campaign.id}`, { label: trimmed })
  labelSaving.value = false
  if (err) { labelError.value = err; return }
  auth.campaign = { ...auth.campaign, label: trimmed }
  editingLabel.value = false
}

const travellerMapUrl = computed(() => {
  const milieu = auth.campaign?.milieu ?? 'M1105'
  return `https://travellermap.com/?milieu=${milieu}`
})

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  if (!auth.isReferee) { router.push({ name: 'map' }); return }
  await referee.loadShips(auth.campaign.id)
  await referee.loadPlayers(auth.campaign.id)
  await referee.loadShipTemplates()
  await referee.loadOrganizations()
})
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────── */

.ref-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1.25rem;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  min-height: 56px;
}

.back-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-dim);
  font-size: 0.82rem;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
}
.back-btn:hover { color: var(--text); border-color: var(--accent-dim); }

.header-title { flex: 1; }
.header-title h1 { font-size: 1rem; font-weight: 600; margin: 0; }
.header-sub { font-size: 0.78rem; color: var(--text-dim); }

.header-meta { display: flex; gap: 0.5rem; align-items: center; }
.rules-badge, .tick-badge {
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  color: var(--text-dim);
  background: var(--bg-item);
}

.ref-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
  padding: 0 1.25rem;
}

.rtab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-dim);
  font-size: 0.83rem;
  padding: 0.6rem 1rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.rtab:hover   { color: var(--text); }
.rtab.active  { color: var(--accent); border-bottom-color: var(--accent); }

.ref-body { flex: 1; overflow-y: auto; }

.tab-pane {
  padding: 1.25rem;
  max-width: 1100px;
}

/* ── Ships tab ───────────────────────────────────────────────────────────── */

.ships-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 1.5rem;
  align-items: start;
}

.col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.col-header h2, .col-header h3 { margin: 0; font-size: 0.95rem; }

.col-header-actions { display: flex; gap: 0.5rem; }

.template-form-heading {
  margin: 1rem 0 0.5rem;
  font-size: 0.85rem;
  color: var(--text-dim);
}

.hint-note {
  font-size: 0.72rem;
  color: var(--text-dim);
  font-style: italic;
  margin: 0.5rem 0 0;
}

.ship-list { list-style: none; margin: 0; padding: 0; }
.ship-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.1s;
}
.ship-item:hover  { background: var(--bg-item); }
.ship-item.active { background: var(--bg-item); border-left: 2px solid var(--accent); }

.ship-name  { font-size: 0.88rem; font-weight: 500; }
.ship-type  { font-size: 0.75rem; color: var(--text-dim); }
.ship-crew-count { font-size: 0.72rem; color: var(--accent-dim); }

.ship-detail-col { min-width: 0; }
.detail-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.detail-header-row h2 { margin: 0; font-size: 1rem; }

/* ── Forms ───────────────────────────────────────────────────────────────── */

.detail-form { display: flex; flex-direction: column; gap: 0.75rem; max-width: 480px; }

.form-row { display: flex; flex-direction: column; gap: 0.3rem; }
.form-row label { font-size: 0.75rem; color: var(--text-dim); }
.form-row input, .form-row select {
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
}
.form-row.two-col { flex-direction: row; gap: 1rem; }
.form-row.two-col > div { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
.form-row.two-col label { font-size: 0.75rem; color: var(--text-dim); }

.form-actions { display: flex; gap: 0.5rem; margin-top: 0.25rem; }
.req { color: var(--red); }
.form-error   { font-size: 0.78rem; color: var(--red);   margin: 0; }
.form-success { font-size: 0.78rem; color: var(--green); margin: 0; }

/* ── Stat grid ───────────────────────────────────────────────────────────── */

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.stat-grid.wide { grid-template-columns: repeat(2, 1fr); }

.stat {
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
}
.stat label { display: block; font-size: 0.72rem; color: var(--text-dim); margin-bottom: 0.2rem; }
.stat span  { font-size: 0.88rem; }
.stat.locked span { color: var(--text-dim); }
.lock-note { font-size: 0.7rem; color: var(--text-dim); margin-left: 0.4rem; }

/* ── Crew ────────────────────────────────────────────────────────────────── */

.crew-section { margin-top: 1.5rem; }
.crew-section h3 { font-size: 0.9rem; }

.crew-add-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}
.crew-add-form select, .crew-add-form input {
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.83rem;
  padding: 0.35rem 0.6rem;
}

.crew-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.83rem;
}
.crew-table th {
  text-align: left;
  font-size: 0.72rem;
  color: var(--text-dim);
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--border);
}
.crew-table td {
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border);
}
.crew-table select {
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.8rem;
  padding: 0.2rem 0.4rem;
}

.crew-table .center { text-align: center; }
.right { text-align: right; }
.total-label { color: var(--text-dim); font-size: 0.72rem; }
.total-val   { font-weight: 600; color: var(--accent); }

.mono { font-family: monospace; }
.pos { color: var(--green, #34d399); }
.neg { color: var(--red, #f87171); }

.dues-status { font-size: 0.82rem; color: var(--text-dim); margin: 0; }
.dues-status .due-now { color: var(--amber); font-weight: 600; }
.dues-result { font-size: 0.78rem; color: var(--green, #34d399); margin: 0.2rem 0 0; }

.amount-input {
  width: 90px;
  padding: 0.25rem 0.4rem;
  background: var(--bg-input, var(--bg-panel));
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.8rem;
}

.fleet-total {
  font-size: 0.82rem;
  font-weight: 600;
  margin: 0.3rem 0 0;
}

.income-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-top: 0.3rem;
}
.breakdown-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
}

.trade-check {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  accent-color: var(--accent);
}

/* ── Players tab ─────────────────────────────────────────────────────────── */

.player-list { display: flex; flex-direction: column; gap: 0.5rem; max-width: 700px; }

.player-card {
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.player-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.9rem;
  cursor: pointer;
  transition: background 0.1s;
}
.player-card-header:hover { background: var(--bg-panel); }

.player-identity { display: flex; align-items: center; gap: 0.5rem; }
.player-name { font-size: 0.88rem; font-weight: 500; }

.role-badge {
  font-size: 0.68rem;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  border: 1px solid var(--border);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.role-badge.referee { color: var(--accent); border-color: var(--accent-dim); }
.role-badge.player  { color: var(--text-dim); }

.ship-badge {
  font-size: 0.72rem;
  color: var(--text-dim);
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 3px;
}

.expand-icon { font-size: 0.7rem; color: var(--text-dim); }

.player-skills {
  padding: 0.75rem 0.9rem;
  border-top: 1px solid var(--border);
}
.player-skills h4 { font-size: 0.78rem; color: var(--text-dim); margin: 0 0 0.5rem; }

.skills-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; margin-bottom: 0.75rem; }
.skills-table th {
  text-align: left;
  font-size: 0.72rem;
  color: var(--text-dim);
  padding: 0.25rem 0.4rem;
  border-bottom: 1px solid var(--border);
}
.skills-table td { padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--border); }

.level-input {
  width: 52px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.83rem;
  padding: 0.2rem 0.4rem;
  text-align: center;
}

.add-skill-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}
.add-skill-form input {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.83rem;
  padding: 0.3rem 0.5rem;
}
.add-skill-form input:first-child { flex: 1; }
.add-skill-form select { flex: 1; }

.owns-check-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--text-dim);
  white-space: nowrap;
}

/* ── Events tab ──────────────────────────────────────────────────────────── */

.events-layout {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 1.5rem;
  align-items: start;
}

.events-col h2 { font-size: 0.95rem; margin: 0 0 0.75rem; }

.event-list { display: flex; flex-direction: column; gap: 0.5rem; }
.event-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.6rem 0.75rem;
  gap: 0.75rem;
}
.event-card.crisis { border-left: 3px solid var(--red); }
.event-card.major  { border-left: 3px solid var(--amber, #f59e0b); }
.event-card.minor  { border-left: 3px solid var(--border); }

.event-card-body { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.event-desc { font-size: 0.83rem; }
.event-meta { font-size: 0.72rem; color: var(--text-dim); }

/* ── Events catalogue ────────────────────────────────────────────────────── */
.cat-hint { font-size: 0.75rem; color: var(--text-dim); margin: 0 0 0.5rem; }

.catalogue-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  overflow-y: auto;
  max-height: 420px;
}

.cat-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.35rem 0.65rem;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.1s;
}
.cat-entry:hover { border-color: var(--accent-dim); }

.cat-desc { font-size: 0.8rem; color: var(--text); flex: 1; }
.cat-meta { display: flex; gap: 0.4rem; flex-shrink: 0; font-size: 0.72rem; font-family: monospace; }
.mod-up   { color: var(--red, #e05); }
.mod-down { color: var(--accent); }

/* ── Campaign tab ────────────────────────────────────────────────────────── */

.label-display { display: flex; align-items: center; gap: 0.5rem; }
.edit-inline-btn {
  background: transparent;
  border: none;
  color: var(--accent-dim);
  font-size: 0.72rem;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}
.edit-inline-btn:hover { color: var(--accent); }

.inline-label-form { display: flex; align-items: center; gap: 0.4rem; }
.label-input {
  flex: 1;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.83rem;
  padding: 0.25rem 0.5rem;
}
.label-input:focus { border-color: var(--accent-dim); outline: none; }

.campaign-settings { max-width: 560px; }
.campaign-settings h2 { font-size: 0.95rem; margin: 0 0 1rem; }

.campaign-traveller-map {
  margin-top: 1.5rem;
  padding: 1rem;
  background: var(--bg-item);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.campaign-traveller-map h3 { margin: 0 0 0.4rem; font-size: 0.88rem; }
.campaign-traveller-map p  { font-size: 0.83rem; color: var(--text-dim); margin: 0 0 0.75rem; }

.external-link { text-decoration: none; display: inline-block; }

.campaign-security {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}
.campaign-security h3 { margin: 0 0 0.4rem; font-size: 0.88rem; }
.campaign-security p  { font-size: 0.83rem; color: var(--text-dim); margin: 0 0 0.5rem; }

.security-warn {
  font-size: 0.78rem;
  color: var(--amber);
  margin-bottom: 0.75rem !important;
}

.regen-error {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--red);
}

.campaign-danger {
  margin-top: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--red);
  border-radius: var(--radius);
  background: rgba(217, 58, 58, 0.04);
}
.campaign-danger h3 {
  margin: 0 0 0.4rem;
  font-size: 0.88rem;
  color: var(--red);
}
.campaign-danger p {
  font-size: 0.83rem;
  color: var(--text-dim);
  margin: 0 0 0.75rem;
}

.btn-delete {
  font-size: 0.83rem;
  padding: 0.4rem 0.9rem;
}

.delete-warn {
  color: var(--red) !important;
  font-size: 0.82rem !important;
  margin-bottom: 0.5rem !important;
}

.delete-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.delete-pin-input {
  background: var(--bg-item);
  border: 1px solid var(--red);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  width: 160px;
  outline: none;
}
.delete-pin-input:focus { border-color: var(--red); box-shadow: 0 0 0 2px rgba(217,58,58,0.2); }

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: var(--radius);
  padding: 0.4rem 0.9rem;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-secondary:hover:not(:disabled) { border-color: var(--accent-dim); color: var(--accent); }
.btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Shared buttons ──────────────────────────────────────────────────────── */

.btn-primary {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-size: 0.83rem;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:hover    { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.83rem;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: background 0.1s;
}
.btn-ghost:hover { background: var(--bg-item); }

.btn-danger {
  background: transparent;
  border: 1px solid var(--red);
  border-radius: var(--radius);
  color: var(--red);
  cursor: pointer;
  transition: background 0.1s;
}
.btn-danger:hover { background: rgba(217,58,58,0.1); }

.btn-sm  { font-size: 0.78rem; padding: 0.3rem 0.65rem; }
.btn-xs  { font-size: 0.72rem; padding: 0.15rem 0.45rem; }

.placeholder    { color: var(--text-dim); font-size: 0.83rem; padding: 1rem 0; }
.placeholder.sm { padding: 0.4rem 0; }
.placeholder.large { font-size: 1rem; padding: 3rem 0; text-align: center; }
</style>
