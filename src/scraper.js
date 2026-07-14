import puppeteer from 'puppeteer';
import {
  DEFAULT_COORDS,
  HEADLESS,
  SCRAPE_TIMEOUT,
  PUPPETEER_EXECUTABLE_PATH,
  PROXY_SERVER,
  PROXY_USERNAME,
  PROXY_PASSWORD,
} from './config.js';

/**
 * Headless-browser price scraper. Drives a real Chromium instance against the
 * live Blinkit/Zepto search pages, overrides geolocation so the location-gated
 * catalog resolves to our dark store, and extracts the first product's price.
 *
 * Price extraction is deliberately text-based (matching the ₹ pattern in the
 * rendered card) rather than relying only on brittle class names — this is the
 * part most likely to survive the sites' frequent markup changes.
 */

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--window-size=1280,900',
  // Route the scraper through a residential proxy when configured (VPS path).
  ...(PROXY_SERVER ? [`--proxy-server=${PROXY_SERVER}`] : []),
];

// A realistic desktop UA reduces trivial headless-bot flags.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

let browserPromise = null;

/** Lazily launch and reuse a single shared browser instance. */
export function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: HEADLESS ? 'new' : false,
      args: LAUNCH_ARGS,
      executablePath: PUPPETEER_EXECUTABLE_PATH, // undefined → puppeteer's own Chromium
    });
  }
  return browserPromise;
}

/** Close the shared browser (call on shutdown). */
export async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close().catch(() => {});
    browserPromise = null;
  }
}

async function preparePage(browser, origin) {
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1280, height: 900 });
  page.setDefaultNavigationTimeout(SCRAPE_TIMEOUT);

  // Authenticate to the residential proxy if credentials are configured.
  if (PROXY_SERVER && PROXY_USERNAME) {
    await page.authenticate({ username: PROXY_USERNAME, password: PROXY_PASSWORD });
  }

  // Grant + override geolocation so the site skips the "select location" wall
  // and loads the catalog for our configured dark store.
  try {
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(origin, ['geolocation']);
    await page.setGeolocation({
      latitude: DEFAULT_COORDS.lat,
      longitude: DEFAULT_COORDS.lng,
    });
  } catch (err) {
    console.warn('[scraper] geolocation setup failed:', err.message);
  }
  return page;
}

/**
 * Extract the first product's { name, price } from the current page.
 * Runs in the page context; tries each candidate selector, then falls back to
 * the first ₹-price found anywhere in the body.
 */
function extractFirstProduct(page, cardSelectors) {
  return page.evaluate((selectors) => {
    const priceRe = /₹\s*([\d,]+)/;
    const toInt = (s) => parseInt(s.replace(/,/g, ''), 10);

    for (const sel of selectors) {
      for (const node of document.querySelectorAll(sel)) {
        const text = node.innerText || '';
        const pm = text.match(priceRe);
        if (pm) {
          const name =
            text
              .split('\n')
              .map((l) => l.trim())
              .find((l) => l && !priceRe.test(l)) || null;
          return { name, price: toInt(pm[1]) };
        }
      }
    }
    // Generic fallback: first price anywhere on the page.
    const body = document.body ? document.body.innerText : '';
    const pm = body.match(priceRe);
    return pm ? { name: null, price: toInt(pm[1]) } : null;
  }, cardSelectors);
}

/**
 * Scrape one platform for a list of items, reusing a single page.
 * @param {object} platform - a PLATFORMS entry (name, searchUrl, cardSelectors, deepLink)
 * @param {Array<{item_name: string, quantity: number}>} items
 * @returns {Promise<Array>} per-item results with unitPrice / available flags
 */
export async function scrapePlatform(platform, items) {
  const browser = await getBrowser();
  const origin = new URL(platform.deepLink).origin;
  const page = await preparePage(browser, origin);
  const results = [];

  try {
    for (const { item_name, quantity } of items) {
      let unitPrice = null;
      let matchedName = null;
      try {
        await page.goto(platform.searchUrl(item_name), {
          waitUntil: 'domcontentloaded',
        });
        // Wait for the SPA to render at least one price, but don't hard-fail
        // if it never does — treat that as "unavailable".
        await page
          .waitForFunction(() => /₹\s*\d/.test(document.body?.innerText || ''), {
            timeout: SCRAPE_TIMEOUT,
          })
          .catch(() => {});

        const found = await extractFirstProduct(page, platform.cardSelectors);
        if (found && Number.isFinite(found.price)) {
          unitPrice = found.price;
          matchedName = found.name;
        }
      } catch (err) {
        console.warn(`[scraper] ${platform.name} "${item_name}" failed:`, err.message);
      }

      results.push({
        item_name,
        matchedName,
        quantity,
        unitPrice,
        available: unitPrice != null,
        lineTotal: unitPrice != null ? unitPrice * quantity : 0,
      });
    }
  } finally {
    await page.close().catch(() => {});
  }

  return results;
}
