import { newPage } from './browser.js';

/**
 * Amazon product-page scraper. Given any Amazon product URL, resolves the ASIN,
 * loads the canonical product page, and extracts { title, price, availability }.
 *
 * Price extraction favors Amazon's `.a-offscreen` price nodes but tolerates the
 * several layouts Amazon rotates between. If Amazon serves a robot-check we
 * detect it and surface a clear error instead of silently returning garbage.
 */

/** Extract the 10-char ASIN from any Amazon product URL (or a bare ASIN). */
export function extractAsin(url) {
  const s = String(url);
  const m = s.match(/\/(?:dp|gp\/product|gp\/aw\/d|d)\/([A-Z0-9]{10})/i);
  if (m) return m[1].toUpperCase();
  const bare = s.match(/\b([A-Z0-9]{10})\b/);
  return bare ? bare[1].toUpperCase() : null;
}

/** Amazon domain from a URL (defaults to amazon.in). */
function extractDomain(url) {
  const m = String(url).match(/amazon\.[a-z.]+/i);
  return m ? m[0].toLowerCase().replace(/\.$/, '') : 'amazon.in';
}

/** Build a clean canonical product URL from any messy Amazon link. */
export function canonicalUrl(url) {
  const asin = extractAsin(url);
  const domain = extractDomain(url);
  return asin ? `https://www.${domain}/dp/${asin}` : String(url);
}

// Price nodes, tried in order across Amazon's rotating layouts.
const PRICE_SELECTORS = [
  '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
  '#corePrice_feature_div .a-price .a-offscreen',
  '#priceblock_ourprice',
  '#priceblock_dealprice',
  '#tp_price_block_total_price_ww .a-offscreen',
  '.a-price .a-offscreen',
];

/** Parse "₹4,990.00" / "$1,299.99" → { value, currency }. */
export function parsePrice(text) {
  if (!text) return null;
  const currency = (String(text).match(/[₹$£€]|Rs\.?/i) || [''])[0] || '₹';
  const value = parseFloat(String(text).replace(/[^\d.]/g, ''));
  return Number.isFinite(value) ? { value, currency } : null;
}

/**
 * Fetch a product's current price + metadata.
 * @param {string} url - any Amazon product URL
 * @returns {Promise<{asin, url, title, price, currency, available, availability, checkedAt}>}
 * @throws if Amazon serves a robot-check / CAPTCHA page
 */
export async function fetchProduct(url) {
  const asin = extractAsin(url);
  const target = canonicalUrl(url);
  const page = await newPage();

  try {
    await page.goto(target, { waitUntil: 'domcontentloaded' });

    const blocked = await page.evaluate(() => {
      const title = (document.title || '').toLowerCase();
      const body = (document.body?.innerText || '').toLowerCase();
      return (
        title.includes('robot') ||
        body.includes('type the characters') ||
        body.includes('enter the characters you see') ||
        body.includes('automated access')
      );
    });
    if (blocked) {
      throw new Error('Amazon robot-check (blocked) — try a residential IP/proxy.');
    }

    const data = await page.evaluate((selectors) => {
      const pick = (sels) => {
        for (const s of sels) {
          const el = document.querySelector(s);
          const text = el?.textContent?.trim();
          if (text) return text;
        }
        return null;
      };
      return {
        title: document.querySelector('#productTitle')?.textContent?.trim() || null,
        priceText: pick(selectors),
        availability:
          document.querySelector('#availability')?.textContent?.trim().replace(/\s+/g, ' ') ||
          null,
      };
    }, PRICE_SELECTORS);

    const price = parsePrice(data.priceText);
    return {
      asin,
      url: target,
      title: data.title,
      price: price ? price.value : null,
      currency: price ? price.currency : '₹',
      available: price != null,
      availability: data.availability,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    await page.close().catch(() => {});
  }
}
