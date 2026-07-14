/**
 * Offline smoke test — validates the parse → aggregate → format pipeline
 * WITHOUT launching a browser or hitting the network, by injecting a fake
 * scraper with deterministic prices. Run: `npm run smoke`.
 *
 * (To test the REAL live scraper end-to-end, run `npm run scrape:check` on a
 *  machine with a residential IP.)
 */
import assert from 'node:assert';
import { fallbackParse } from '../src/aiParser.js';
import { comparePrices } from '../src/priceEngine.js';
import { formatComparison } from '../src/formatter.js';

// Deterministic prices keyed by platform + item.
const FAKE = {
  Blinkit: { milk: 54, bread: 45, eggs: 84 },
  Zepto: { milk: 52, bread: 48, eggs: 80 },
};

async function fakeScrape(platform, items) {
  return items.map(({ item_name, quantity }) => {
    const price = FAKE[platform.name]?.[item_name.toLowerCase()] ?? null;
    return {
      item_name,
      matchedName: item_name,
      quantity,
      unitPrice: price,
      available: price != null,
      lineTotal: price != null ? price * quantity : 0,
    };
  });
}

const items = fallbackParse('2 milk, 1 bread, 6 eggs');
console.log('Parsed items:', items);
assert.deepStrictEqual(items, [
  { item_name: 'milk', quantity: 2 },
  { item_name: 'bread', quantity: 1 },
  { item_name: 'eggs', quantity: 6 },
]);

const result = await comparePrices(items, { scrape: fakeScrape });

// Blinkit: 54*2 + 45 + 84*6 + 35 fee = 108 + 45 + 504 + 35 = 692
// Zepto:   52*2 + 48 + 80*6 + 29 fee = 104 + 48 + 480 + 29 = 661
const blinkit = result.platforms.find((p) => p.platform === 'Blinkit');
const zepto = result.platforms.find((p) => p.platform === 'Zepto');
assert.strictEqual(blinkit.total, 692);
assert.strictEqual(zepto.total, 661);
assert.strictEqual(result.cheaper, 'Zepto');
assert.strictEqual(result.savings, 31);

console.log('\n--- WhatsApp reply preview ---\n');
console.log(formatComparison(result, items));

console.log('\n✅ Smoke test passed.');
