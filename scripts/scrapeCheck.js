/**
 * Live scrape check — fetches ONE Amazon product page for real and prints what
 * it found. Use this to verify/tune the selectors in src/amazonScraper.js on a
 * machine with a residential IP.
 *
 *   npm run scrape:check "https://www.amazon.in/dp/B0CHX1W1XY"
 *   HEADLESS=false npm run scrape:check "<url>"   # watch the browser
 *
 * Note: datacenter IPs often get a robot-check, so this may fail even though the
 * code is correct — test locally or via a residential PROXY_SERVER.
 */
import { fetchProduct } from '../src/amazonScraper.js';
import { closeBrowser } from '../src/browser.js';

const url = process.argv[2] || 'https://www.amazon.in/dp/B0CHX1W1XY';

try {
  console.log('Fetching:', url);
  const product = await fetchProduct(url);
  console.log(JSON.stringify(product, null, 2));
  if (product.price == null) {
    console.log('\n⚠️ No price found — likely a robot-check or a changed layout.');
  }
} catch (err) {
  console.error('Live scrape failed:', err.message);
} finally {
  await closeBrowser();
}
