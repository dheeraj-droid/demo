/**
 * Live scrape check — runs the REAL Puppeteer scraper against Blinkit & Zepto
 * for a couple of items and prints what it found. Use this to verify/tune the
 * selectors in src/config.js on a machine with a residential IP.
 *
 *   npm run scrape:check
 *   HEADLESS=false npm run scrape:check   # watch the browser
 *
 * Note: datacenter IPs are routinely bot-blocked, so items may show as
 * "unavailable" even though the code is correct — test locally.
 */
import { comparePrices } from '../src/priceEngine.js';
import { formatComparison } from '../src/formatter.js';
import { closeBrowser } from '../src/scraper.js';

const items = [
  { item_name: 'milk', quantity: 2 },
  { item_name: 'bread', quantity: 1 },
];

try {
  console.log('Scraping live prices for:', items);
  const result = await comparePrices(items);
  console.log(JSON.stringify(result.platforms, null, 2));
  console.log('\n--- WhatsApp reply preview ---\n');
  console.log(formatComparison(result, items));
} catch (err) {
  console.error('Live scrape failed:', err);
} finally {
  await closeBrowser();
}
