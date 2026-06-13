import { test, expect } from '@playwright/test'

// ── App shell navigation (no Supabase required) ────────────────────────────────
// Tests that verify redirect behaviour and the login page is the entry point.
// Tests requiring an authenticated session are marked with a prerequisite comment.

test.describe('App shell', () => {
  test('unauthenticated visit to / redirects to login', async ({ page }) => {
    await page.goto('/')
    // Without a valid session the router guard sends the user to /login
    await expect(page).toHaveURL(/login/)
    await expect(page.locator('h1')).toContainText('Traveller Trade Simulator')
  })

  test('login page is accessible via hash route (no 404)', async ({ page }) => {
    // App uses hash history — real URL is /#/login, not /login
    const response = await page.goto('/#/login')
    expect(response?.status()).toBeLessThan(400)
    await expect(page.locator('h1')).toContainText('Traveller Trade Simulator')
  })

  test('page title includes Traveller', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Traveller/)
  })
})

// ── Help dialog (no Supabase required) ────────────────────────────────────────
// The Help dialog is reachable from the hamburger menu on the map view.
// These tests require an authenticated session — they serve as a scaffold
// for future CI scenarios with a seeded test campaign.

test.describe('Help dialog @requires-auth', () => {
  // Prerequisite: log in as a test Referee before each test in this group.
  // Uncomment and fill in when a stable test campaign exists in Supabase.
  //
  // test.beforeEach(async ({ page }) => {
  //   await page.goto('/login')
  //   await page.fill('input[placeholder*="SPINWARD"]', process.env.TEST_CAMPAIGN_CODE)
  //   await page.fill('input[placeholder*="character"]', process.env.TEST_CHARACTER)
  //   await page.fill('input[type="password"]', process.env.TEST_PIN)
  //   await page.click('button[type="submit"]')
  //   await page.waitForURL(/^\/#\//)
  // })

  test.skip('? keyboard shortcut opens the Help dialog', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.locator('.dialog')).toBeVisible()
  })

  test.skip('Help dialog has User Manual and Keyboard Shortcuts tabs', async ({ page }) => {
    await page.keyboard.press('?')
    const tabs = page.locator('.htab')
    await expect(tabs).toHaveCount(2)
  })

  test.skip('closing the Help dialog via Escape restores focus', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.locator('.dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.dialog')).not.toBeVisible()
  })
})
