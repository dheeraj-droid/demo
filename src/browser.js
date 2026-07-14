import puppeteer from 'puppeteer';
import {
  HEADLESS,
  SCRAPE_TIMEOUT,
  PUPPETEER_EXECUTABLE_PATH,
  PROXY_SERVER,
  PROXY_USERNAME,
  PROXY_PASSWORD,
} from './config.js';

/**
 * Shared headless-browser manager. A single Chromium instance is launched
 * lazily and reused across scrapes; each scrape gets its own page.
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
      executablePath: PUPPETEER_EXECUTABLE_PATH, // undefined → bundled Chromium
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

/** Open a new page pre-configured with UA, viewport, timeout, and proxy auth. */
export async function newPage() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1280, height: 900 });
  page.setDefaultNavigationTimeout(SCRAPE_TIMEOUT);

  if (PROXY_SERVER && PROXY_USERNAME) {
    await page.authenticate({ username: PROXY_USERNAME, password: PROXY_PASSWORD });
  }
  return page;
}
