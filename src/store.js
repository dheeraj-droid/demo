import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DATA_FILE, MAX_HISTORY } from './config.js';

/**
 * Tiny JSON-file persistence for tracked products + price history.
 *
 * A tracker is keyed by owner (WhatsApp chat id) + ASIN, so multiple users can
 * track independently and the scheduler knows whom to alert. For a personal bot
 * this file store is plenty; swap in SQLite later without touching callers.
 */

async function load() {
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    return Array.isArray(parsed.trackers) ? parsed : { trackers: [] };
  } catch {
    return { trackers: [] };
  }
}

async function save(data) {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

function pushHistory(tracker, price, at) {
  tracker.history.push({ price, at });
  if (tracker.history.length > MAX_HISTORY) {
    tracker.history = tracker.history.slice(-MAX_HISTORY);
  }
}

/**
 * Create or update a tracker for a product.
 * @returns {Promise<{tracker: object, existing: boolean}>}
 */
export async function addTracker({ owner, product, target }) {
  const data = await load();
  const now = new Date().toISOString();
  let tracker = data.trackers.find((t) => t.owner === owner && t.asin === product.asin);
  const existing = Boolean(tracker);

  if (!tracker) {
    tracker = {
      id: `${owner}:${product.asin}`,
      owner,
      asin: product.asin,
      url: product.url,
      title: product.title,
      currency: product.currency || '₹',
      target: target ?? null,
      lastPrice: null,
      lowestPrice: null,
      lastNotifiedPrice: null,
      history: [],
      createdAt: now,
    };
    data.trackers.push(tracker);
  } else {
    if (target !== undefined && target !== null) tracker.target = target;
    if (product.title) tracker.title = product.title;
    tracker.url = product.url;
  }

  if (product.price != null) {
    tracker.lastPrice = product.price;
    tracker.lowestPrice =
      tracker.lowestPrice == null ? product.price : Math.min(tracker.lowestPrice, product.price);
    pushHistory(tracker, product.price, now);
  }

  await save(data);
  return { tracker, existing };
}

/** All trackers for one owner. */
export async function listTrackers(owner) {
  const data = await load();
  return data.trackers.filter((t) => t.owner === owner);
}

/** All trackers across owners (for the scheduler). */
export async function getAllTrackers() {
  return (await load()).trackers;
}

/** Remove the owner's Nth tracker (1-based, as shown by `list`). */
export async function removeTrackerByIndex(owner, index) {
  const data = await load();
  const owned = data.trackers.filter((t) => t.owner === owner);
  const victim = owned[index - 1];
  if (!victim) return null;
  data.trackers = data.trackers.filter((t) => t !== victim);
  await save(data);
  return victim;
}

/**
 * Record a fresh price check and decide whether to alert.
 * Alerts fire when the price first drops to/below the target (and again only if
 * it dips further); if no target is set, alerts fire on a new all-time low.
 * @returns {Promise<{tracker: object, shouldAlert: boolean, reason: ('target'|'newlow'|null)}|null>}
 */
export async function recordCheck(id, price, at = new Date().toISOString()) {
  const data = await load();
  const tracker = data.trackers.find((t) => t.id === id);
  if (!tracker) return null;

  let shouldAlert = false;
  let reason = null;

  if (price != null) {
    const prevLowest = tracker.lowestPrice;
    tracker.lastPrice = price;
    tracker.lowestPrice = prevLowest == null ? price : Math.min(prevLowest, price);
    pushHistory(tracker, price, at);

    const hasTarget = tracker.target != null;
    if (hasTarget && price <= tracker.target) {
      // Notify on first cross below target, and again only if it drops further.
      if (tracker.lastNotifiedPrice == null || price < tracker.lastNotifiedPrice) {
        shouldAlert = true;
        reason = 'target';
        tracker.lastNotifiedPrice = price;
      }
    } else {
      // Back above target → reset so a future dip re-notifies.
      tracker.lastNotifiedPrice = null;
      // No target set → alert on a genuine new low.
      if (!hasTarget && prevLowest != null && price < prevLowest) {
        shouldAlert = true;
        reason = 'newlow';
      }
    }
  }

  await save(data);
  return { tracker, shouldAlert, reason };
}
