import cron from 'node-cron';
import { CHECK_CRON } from './config.js';
import { getAllTrackers, recordCheck } from './store.js';
import { fetchProduct } from './amazonScraper.js';
import { alertMessage } from './messages.js';

/**
 * Periodic price checker. Iterates every tracked product, scrapes the current
 * price, records it, and fires an alert (via `notify`) when a drop qualifies.
 *
 * `fetch` is injectable so the check loop can be tested without a real browser.
 */

/**
 * Run one full check pass over all trackers.
 * @param {(owner: string, text: string) => Promise<any>} notify
 * @param {{fetch?: Function}} [opts]
 */
export async function checkAll(notify, { fetch = fetchProduct } = {}) {
  const trackers = await getAllTrackers();
  let checked = 0;
  let alerted = 0;

  for (const tracker of trackers) {
    let product;
    try {
      product = await fetch(tracker.url);
    } catch (err) {
      console.warn(`[scheduler] ${tracker.asin} check failed:`, err.message);
      continue;
    }
    checked += 1;
    if (product.price == null) continue;

    const result = await recordCheck(tracker.id, product.price);
    if (result?.shouldAlert && notify) {
      try {
        await notify(tracker.owner, alertMessage(result.tracker, result.reason));
        alerted += 1;
      } catch (err) {
        console.warn('[scheduler] notify failed:', err.message);
      }
    }
  }

  console.log(`[scheduler] checked ${checked}/${trackers.length}, alerted ${alerted}`);
  return { checked, total: trackers.length, alerted };
}

/**
 * Start the cron schedule. Returns the scheduled task (call .stop() to cancel).
 * @param {(owner: string, text: string) => Promise<any>} notify
 */
export function startScheduler(notify) {
  const task = cron.schedule(CHECK_CRON, () => {
    checkAll(notify).catch((err) => console.error('[scheduler] run error:', err));
  });
  console.log(`⏰ Price checks scheduled: "${CHECK_CRON}"`);
  return task;
}
