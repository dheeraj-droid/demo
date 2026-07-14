import { PLATFORMS } from './config.js';
import { scrapePlatform } from './scraper.js';

/**
 * Price engine. Orchestrates scraping across all platforms in parallel,
 * aggregates each basket (subtotal + baseline fee), and reports which platform
 * is cheaper and by how much.
 *
 * The scrape function is injectable so the aggregation/comparison logic can be
 * unit-tested without launching a real browser (see scripts/smoke.js).
 */

function summarize(key, platform, lineItems) {
  const subtotal = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);
  const missing = lineItems.filter((li) => !li.available).map((li) => li.item_name);
  return {
    key,
    platform: platform.name,
    emoji: platform.emoji,
    deepLink: platform.deepLink,
    lineItems,
    subtotal,
    fee: platform.fee,
    total: subtotal + platform.fee,
    missing,
    pricedCount: lineItems.length - missing.length,
  };
}

/**
 * Compare a basket across all configured platforms.
 * @param {Array<{item_name: string, quantity: number}>} items
 * @param {{scrape?: Function}} [opts] - inject a scrape fn for testing
 */
export async function comparePrices(items, { scrape = scrapePlatform } = {}) {
  const entries = Object.entries(PLATFORMS);

  const platforms = await Promise.all(
    entries.map(async ([key, platform]) => {
      const lineItems = await scrape(platform, items);
      return summarize(key, platform, lineItems);
    })
  );

  // Only rank platforms that actually returned prices.
  const priced = platforms.filter((p) => p.pricedCount > 0);
  let cheaper = null;
  let savings = 0;

  if (priced.length > 0) {
    const sorted = [...priced].sort((a, b) => a.total - b.total);
    cheaper = sorted[0];
    if (sorted.length > 1) savings = sorted[1].total - sorted[0].total;
  }

  return {
    platforms,
    cheaper: cheaper ? cheaper.platform : null,
    savings,
    anyPriced: priced.length > 0,
  };
}
