import { test, expect } from '@playwright/test';

test.describe('AI-Powered Marketplace E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('Homepage loads with AI dashboard', async ({ page }) => {
    await expect(page.getByText('Awesome Sauce Token Marketplace')).toBeVisible();
    await expect(page.getByText('AI Monetization Status')).toBeVisible();
    
    // Check for AI rate displays
    await expect(page.locator('#featured-rate')).toBeVisible();
    await expect(page.locator('#sponsored-rate')).toBeVisible();
  });

  test('AI force adjustment works', async ({ page }) => {
    const forceAdjustButton = page.getByText('Force AI Adjustment');
    await expect(forceAdjustButton).toBeVisible();
    
    await forceAdjustButton.click();
    
    // Wait for potential UI updates
    await page.waitForTimeout(1000);
    
    // Check that rates might have changed (they're within bounds)
    const featuredRate = await page.locator('#featured-rate').textContent();
    const sponsoredRate = await page.locator('#sponsored-rate').textContent();
    
    expect(featuredRate).toBeTruthy();
    expect(sponsoredRate).toBeTruthy();
  });

  test('Live event stream displays updates', async ({ page }) => {
    // Wait for event stream to initialize
    await page.waitForTimeout(2000);
    
    const eventLog = page.locator('#live-events-log');
    await expect(eventLog).toBeVisible();
    
    // Check for initial connection event
    await expect(eventLog).toContainText('Connected to event stream');
  });

  test('AI suggestions panel shows recommendations', async ({ page }) => {
    const suggestionsPanel = page.locator('#ai-suggestions-panel');
    await expect(suggestionsPanel).toBeVisible();
    
    // Wait for AI suggestions to load
    await page.waitForTimeout(3000);
    
    const suggestionsList = page.locator('#ai-suggestions-list');
    await expect(suggestionsList).toBeVisible();
  });

  test('Marketplace listings load', async ({ page }) => {
    const listingsSection = page.locator('#marketplace-listings');
    await expect(listingsSection).toBeVisible();
    
    // Wait for listings to load
    await page.waitForTimeout(2000);
    
    // Check that some listings are displayed
    const listings = page.locator('.listing-item');
    await expect(listings).toHaveCountGreaterThan(0);
  });

  test('Search functionality works', async ({ page }) => {
    const searchInput = page.locator('#search-input');
    const searchButton = page.getByText('Search');
    
    await searchInput.fill('token');
    await searchButton.click();
    
    // Wait for search results
    await page.waitForTimeout(2000);
    
    // Verify search was performed
    const url = page.url();
    expect(url).toContain('search=token');
  });

  test('Responsive design works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await expect(page.getByText('Awesome Sauce Token Marketplace')).toBeVisible();
    await expect(page.getByText('AI Monetization Status')).toBeVisible();
    
    // Check that mobile navigation works
    const mobileMenu = page.locator('.mobile-menu');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.locator('.nav-menu')).toBeVisible();
    }
  });
});
