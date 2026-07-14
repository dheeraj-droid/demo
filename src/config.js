import dotenv from 'dotenv';

dotenv.config();

/**
 * Central configuration. Environment-driven values are resolved here once so
 * the rest of the app imports plain constants instead of touching process.env.
 */

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() || '';

// Default dark-store coordinates. Quick-commerce catalogs and prices are
// localized per dark store, so this GPS position is injected into the browser
// (geolocation override) before scraping so the site resolves to one store.
export const DEFAULT_COORDS = {
  lat: Number(process.env.DEFAULT_LAT) || 12.9716, // Bangalore city center
  lng: Number(process.env.DEFAULT_LNG) || 77.5946,
};

// Headless toggle + per-navigation timeout for the scraper.
export const HEADLESS = process.env.HEADLESS !== 'false';
export const SCRAPE_TIMEOUT = Number(process.env.SCRAPE_TIMEOUT) || 20000;

/**
 * Per-platform scraping config.
 *  - searchUrl(q): live search page for a query.
 *  - fee: baseline delivery + handling, in INR, added to the basket subtotal.
 *  - cardSelectors: candidate product-card selectors, tried in order. These are
 *    best-effort and WILL need tuning when the sites change their markup; the
 *    scraper also falls back to a generic ₹-price text scan.
 */
export const PLATFORMS = {
  blinkit: {
    name: 'Blinkit',
    emoji: '🟡',
    fee: 35,
    deepLink: 'https://blinkit.com/',
    searchUrl: (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`,
    cardSelectors: [
      '[data-test-id="plp-product"]',
      '[data-pf="reset"]',
      '.Product__UpdatedPlpProductContainer-sc-11dk8zk-0',
    ],
  },
  zepto: {
    name: 'Zepto',
    emoji: '🟣',
    fee: 29,
    deepLink: 'https://www.zeptonow.com/',
    searchUrl: (q) => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}`,
    cardSelectors: [
      '[data-testid="product-card"]',
      'a[href*="/pn/"]',
    ],
  },
};
