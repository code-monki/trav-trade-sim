import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { useTickStore } from '../../src/stores/tick.js'
import MarketTable from '../../src/components/MarketTable.vue'

const WORLD  = { Hex: '0101', UWP: 'B434450-8', Remarks: 'Ag Ni', Name: 'Test World' }
const SECTOR = 'Spinward Marches'

function snap(die, name, purchase, sale, qty) {
  return { trade_good_die: die, trade_good_name: name,
           purchase_price: purchase, sale_price: sale, qty_available: qty }
}

const SNAPS = {
  '11': snap('11', 'Textiles',  3000,  5000, 30),
  '12': snap('12', 'Polymers',  7000,  4000, 20),
  '13': snap('13', 'Liquor',   10000,  8000,  5),
}

function mountTable(snapshots = SNAPS, loading = false, props = {}, mountOpts = {}) {
  const pinia = createTestingPinia({
    initialState: {
      tick: {
        worldSnapshots: snapshots,
        loading,
        activeEvents: [],
        currentTick: 1,
        snapshotWorldKey: '',
      },
    },
    stubActions: true,
    createSpy: vi.fn,
  })

  // Configure stubs before mount so the worldEvents computed doesn't get undefined
  const tickStore = useTickStore(pinia)
  tickStore.eventsForWorld.mockReturnValue([])

  return mount(MarketTable, {
    props: { world: WORLD, sectorName: SECTOR, ...props },
    global: { plugins: [pinia] },
    ...mountOpts,
  })
}

describe('MarketTable — loading / empty states', () => {
  it('shows loading placeholder while tick.loading is true', () => {
    const wrapper = mountTable(SNAPS, true)
    expect(wrapper.find('.market-placeholder').text()).toContain('Generating market data')
  })

  it('shows empty placeholder when there are no snapshots', () => {
    const wrapper = mountTable({})
    expect(wrapper.find('.market-placeholder').text()).toContain('No market data')
  })

  it('does not show placeholders when snapshots are present', () => {
    const wrapper = mountTable()
    expect(wrapper.find('.market-placeholder').exists()).toBe(false)
  })
})

describe('MarketTable — rows', () => {
  it('renders one row per snapshot', () => {
    const wrapper = mountTable()
    expect(wrapper.findAll('.market-row')).toHaveLength(3)
  })

  it('renders good names in the rows', () => {
    const wrapper = mountTable()
    const text = wrapper.find('tbody').text()
    expect(text).toContain('Textiles')
    expect(text).toContain('Polymers')
    expect(text).toContain('Liquor')
  })

  it('shows the row count label', () => {
    const wrapper = mountTable()
    expect(wrapper.find('.row-count').text()).toContain('3 / 3')
  })

  it('emits select-good with the row data when a row is clicked', async () => {
    const wrapper = mountTable()
    await wrapper.find('.market-row').trigger('click')
    const emitted = wrapper.emitted()['select-good']
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toHaveProperty('trade_good_die')
    expect(emitted[0][0]).toHaveProperty('purchase_price')
  })
})

describe('MarketTable — filter', () => {
  it('filters rows by good name (case-insensitive)', async () => {
    const wrapper = mountTable()
    await wrapper.find('.market-search').setValue('tex')
    expect(wrapper.findAll('.market-row')).toHaveLength(1)
    expect(wrapper.find('.market-row').text()).toContain('Textiles')
  })

  it('filters rows by die code', async () => {
    const wrapper = mountTable()
    await wrapper.find('.market-search').setValue('13')
    expect(wrapper.findAll('.market-row')).toHaveLength(1)
    expect(wrapper.find('.market-row').text()).toContain('Liquor')
  })

  it('UPPERCASE query still matches', async () => {
    const wrapper = mountTable()
    await wrapper.find('.market-search').setValue('POLY')
    expect(wrapper.findAll('.market-row')).toHaveLength(1)
    expect(wrapper.find('.market-row').text()).toContain('Polymers')
  })

  it('no match shows zero rows and updates row count', async () => {
    const wrapper = mountTable()
    await wrapper.find('.market-search').setValue('zzznomatch')
    expect(wrapper.findAll('.market-row')).toHaveLength(0)
    expect(wrapper.find('.row-count').text()).toContain('0 / 3')
  })

  it('clearing the filter restores all rows', async () => {
    const wrapper = mountTable()
    await wrapper.find('.market-search').setValue('tex')
    await wrapper.find('.market-search').setValue('')
    expect(wrapper.findAll('.market-row')).toHaveLength(3)
  })
})

describe('MarketTable — desktop Plot column', () => {
  it('shows the Plot checkbox column by default', () => {
    const wrapper = mountTable()
    expect(wrapper.find('.chart-check').exists()).toBe(true)
    expect(wrapper.find('.compare-btn').exists()).toBe(false)
    expect(wrapper.find('.compare-toolbar').exists()).toBe(false)
  })

  it('emits toggle-chart when a Plot checkbox is changed', async () => {
    const wrapper = mountTable()
    await wrapper.find('.chart-check').setValue(true)
    expect(wrapper.emitted()['toggle-chart'][0]).toEqual(['11'])
  })
})

describe('MarketTable — mobile compare mode', () => {
  it('hides the Plot checkbox column and shows the Compare toggle', () => {
    const wrapper = mountTable(SNAPS, false, { mobile: true })
    expect(wrapper.find('.chart-check').exists()).toBe(false)
    expect(wrapper.find('.compare-btn').exists()).toBe(true)
  })

  it('row clicks still select for purchase while compare mode is off', async () => {
    const wrapper = mountTable(SNAPS, false, { mobile: true })
    await wrapper.find('.market-row').trigger('click')
    expect(wrapper.emitted()['select-good']).toBeTruthy()
    expect(wrapper.emitted()['toggle-chart']).toBeFalsy()
  })

  it('in compare mode, row clicks toggle the chart instead of selecting', async () => {
    const wrapper = mountTable(SNAPS, false, { mobile: true })
    await wrapper.find('.compare-btn').trigger('click')
    await wrapper.find('.market-row').trigger('click')
    expect(wrapper.emitted()['toggle-chart'][0]).toEqual(['11'])
    expect(wrapper.emitted()['select-good']).toBeFalsy()
  })

  it('compare mode marks charted rows with a visible checkmark and aria-pressed', async () => {
    const wrapper = mountTable(SNAPS, false, { mobile: true, chartedDies: ['11'] })
    await wrapper.find('.compare-btn').trigger('click')
    const row = wrapper.find('.market-row')
    expect(row.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.compare-mark.on').exists()).toBe(true)
  })

  it('toolbar appears with plotted count and emits view-chart / clear-chart', async () => {
    const wrapper = mountTable(SNAPS, false, { mobile: true, chartedDies: ['11', '12'] })
    const toolbar = wrapper.find('.compare-toolbar')
    expect(toolbar.exists()).toBe(true)
    expect(toolbar.text()).toContain('2 plotted')

    await toolbar.find('.toolbar-btn.primary').trigger('click')
    expect(wrapper.emitted()['view-chart']).toBeTruthy()

    const clearBtn = toolbar.findAll('.toolbar-btn').find(b => b.text() === 'Clear')
    await clearBtn.trigger('click')
    expect(wrapper.emitted()['clear-chart']).toBeTruthy()
  })

  it('toolbar is hidden when nothing is plotted and compare mode is off', () => {
    const wrapper = mountTable(SNAPS, false, { mobile: true })
    expect(wrapper.find('.compare-toolbar').exists()).toBe(false)
  })

  it('Done exits compare mode', async () => {
    const wrapper = mountTable(SNAPS, false, { mobile: true })
    await wrapper.find('.compare-btn').trigger('click')
    const done = wrapper.findAll('.toolbar-btn').find(b => b.text() === 'Done')
    await done.trigger('click')
    expect(wrapper.find('.compare-mark').exists()).toBe(false)
    // rows are back to purchase selection
    await wrapper.find('.market-row').trigger('click')
    expect(wrapper.emitted()['select-good']).toBeTruthy()
  })

  it('ArrowDown moves focus to the next row', async () => {
    const wrapper = mountTable(SNAPS, false, { mobile: true }, { attachTo: document.body })
    const rows = wrapper.findAll('.market-row')
    rows[0].element.focus()
    await rows[0].trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(rows[1].element)
    wrapper.unmount()
  })
})

describe('MarketTable — sort', () => {
  it('default sort is die ascending (11 first)', () => {
    const wrapper = mountTable()
    const first = wrapper.find('.market-row').text()
    expect(first).toContain('Textiles')   // die '11' is lowest
  })

  it('clicking Good header sorts by name ascending', async () => {
    const wrapper = mountTable()
    await wrapper.find('th.sortable').trigger('click') // first header = Good
    const names = wrapper.findAll('.good-name').map(td => td.text())
    expect(names).toEqual([...names].sort())
  })

  it('clicking Buy header sorts by purchase price ascending', async () => {
    const wrapper = mountTable()
    const buyHeader = wrapper.findAll('th.sortable').find(h => h.text().includes('Buy'))
    await buyHeader.trigger('click')
    const firstRow = wrapper.find('.market-row')
    expect(firstRow.text()).toContain('Textiles') // 3000 is lowest
  })

  it('second click on Buy header reverses to descending', async () => {
    const wrapper = mountTable()
    const buyHeader = wrapper.findAll('th.sortable').find(h => h.text().includes('Buy'))
    await buyHeader.trigger('click')
    await buyHeader.trigger('click')
    const firstRow = wrapper.find('.market-row')
    expect(firstRow.text()).toContain('Liquor')   // 10000 is highest
  })

  it('clicking a different header resets to ascending', async () => {
    const wrapper = mountTable()
    const buyHeader  = wrapper.findAll('th.sortable').find(h => h.text().includes('Buy'))
    const sellHeader = wrapper.findAll('th.sortable').find(h => h.text().includes('Sell'))
    await buyHeader.trigger('click')
    await buyHeader.trigger('click')   // now descending
    await sellHeader.trigger('click')  // switch column → back to ascending
    const firstRow = wrapper.find('.market-row')
    expect(firstRow.text()).toContain('Polymers') // sale 4000 is lowest
  })
})
