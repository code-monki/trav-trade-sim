// @vitest-environment happy-dom
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { api } from '../src/lib/api.js'
import { useShipStore } from '../src/stores/ship.js'

vi.mock('../src/lib/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setUnauthorizedHandler: vi.fn(),
}))

const WORLD_HEX = '0101'
const SECTOR    = 'Spinward Marches'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.patch.mockResolvedValue({ data: {}, error: null })
})

describe('autoDeliver — mail delivery failure is not treated as success', () => {
  it('keeps the mail contract and does not credit the ship when delivery fails', async () => {
    const ship = useShipStore()
    ship.ship = { id: 'ship1', credits: 100 }
    ship.mailContracts = [
      { id: 'm1', dest_world_hex: WORLD_HEX, dest_sector: SECTOR, payment: 500 },
    ]

    api.post.mockResolvedValue({ data: null, error: 'Contract already delivered' })

    const result = await ship.updateLocation(WORLD_HEX, SECTOR, {
      tick: 5, campaignId: 'c1', playerId: 'p1',
    })

    expect(result.ok).toBe(true)
    expect(result.deliveryError).toMatch(/Mail delivery failed/)
    expect(ship.mailContracts).toHaveLength(1)
    expect(ship.ship.credits).toBe(100)
  })

  it('removes the mail contract and credits the ship when delivery succeeds', async () => {
    const ship = useShipStore()
    ship.ship = { id: 'ship1', credits: 100 }
    ship.mailContracts = [
      { id: 'm1', dest_world_hex: WORLD_HEX, dest_sector: SECTOR, payment: 500 },
    ]

    api.post.mockResolvedValue({ data: { ok: true }, error: null })

    const result = await ship.updateLocation(WORLD_HEX, SECTOR, {
      tick: 5, campaignId: 'c1', playerId: 'p1',
    })

    expect(result.ok).toBe(true)
    expect(result.deliveryError).toBeUndefined()
    expect(ship.mailContracts).toHaveLength(0)
    expect(ship.ship.credits).toBe(600)
  })
})

describe('autoDeliver — freight delivery failure is not treated as success', () => {
  it('keeps the freight lot when delivery fails', async () => {
    const ship = useShipStore()
    ship.ship = { id: 'ship1', credits: 100 }
    ship.freight = [
      { id: 'f1', dest_world_hex: WORLD_HEX, dest_sector: SECTOR, charge: 300 },
    ]

    api.post.mockResolvedValue({ data: null, error: 'Network error' })

    const result = await ship.updateLocation(WORLD_HEX, SECTOR, {
      tick: 5, campaignId: 'c1', playerId: 'p1',
    })

    expect(result.deliveryError).toMatch(/Freight delivery failed/)
    expect(ship.freight).toHaveLength(1)
    expect(ship.ship.credits).toBe(100)
  })
})
