/**
 * Offline smoke test — validates command parsing, the tracker store, the
 * alert decision logic, and message formatting WITHOUT a browser or network.
 * Run: `npm run smoke`.
 *
 * (To test the REAL Amazon scrape, run `npm run scrape:check <url>`.)
 */
import assert from 'node:assert';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Point the store at a throwaway file BEFORE importing modules that read config.
const DATA_FILE = join(tmpdir(), `qc-tracker-smoke-${Date.now()}.json`);
process.env.DATA_FILE = DATA_FILE;

const { parseCommand, parseTarget } = await import('../src/commands.js');
const { addTracker, listTrackers, removeTrackerByIndex, recordCheck } = await import(
  '../src/store.js'
);
const { extractAsin, canonicalUrl } = await import('../src/amazonScraper.js');
const { checkAll } = await import('../src/scheduler.js');
const msg = await import('../src/messages.js');

// --- command parsing ---
const c1 = parseCommand('https://www.amazon.in/dp/B0CHX1W1XY under ₹4,000');
assert.strictEqual(c1.type, 'track');
assert.strictEqual(c1.target, 4000);
assert.strictEqual(parseCommand('https://amazon.in/dp/B0CHX1W1XY < 4k').target, 4000);
assert.strictEqual(parseTarget('below 3999'), 3999);
assert.strictEqual(parseTarget('no price here'), null);
assert.strictEqual(parseCommand('list').type, 'list');
assert.strictEqual(parseCommand('untrack 2').index, 2);
assert.strictEqual(parseCommand('help').type, 'help');
console.log('✓ command parsing');

// --- ASIN / URL ---
assert.strictEqual(extractAsin('https://www.amazon.in/gp/product/B0CHX1W1XY/ref=x'), 'B0CHX1W1XY');
assert.strictEqual(canonicalUrl('https://amazon.in/dp/B0CHX1W1XY?tag=foo'), 'https://www.amazon.in/dp/B0CHX1W1XY');
console.log('✓ ASIN extraction');

// --- store: add + list ---
const owner = 'test@c.us';
const product = {
  asin: 'B0CHX1W1XY',
  url: 'https://www.amazon.in/dp/B0CHX1W1XY',
  title: 'Sony WH-1000XM5',
  price: 4990,
  currency: '₹',
};
const { tracker, existing } = await addTracker({ owner, product, target: 4000 });
assert.strictEqual(existing, false);
assert.strictEqual(tracker.lastPrice, 4990);
assert.strictEqual((await listTrackers(owner)).length, 1);
console.log('✓ store add + list');

// --- alert logic ---
let r = await recordCheck(tracker.id, 4500); // still above target
assert.strictEqual(r.shouldAlert, false);
r = await recordCheck(tracker.id, 3899); // crosses below target → ALERT
assert.strictEqual(r.shouldAlert, true);
assert.strictEqual(r.reason, 'target');
r = await recordCheck(tracker.id, 3899); // same price → no repeat alert
assert.strictEqual(r.shouldAlert, false);
r = await recordCheck(tracker.id, 3700); // drops further → ALERT again
assert.strictEqual(r.shouldAlert, true);
assert.strictEqual(r.tracker.lowestPrice, 3700);
console.log('✓ alert decision logic');

// --- scheduler pass with an injected fake fetch (no browser) ---
const alerts = [];
const notify = async (to, text) => alerts.push({ to, text });
// Price drops further to 3500 → scheduler should scrape, record, and alert.
const fakeFetch = async (url) => ({ url, price: 3500, currency: '₹' });
const summary = await checkAll(notify, { fetch: fakeFetch });
assert.strictEqual(summary.checked, 1);
assert.strictEqual(summary.alerted, 1);
assert.strictEqual(alerts.length, 1);
assert.ok(alerts[0].text.includes('3,500'));
console.log('✓ scheduler check pass + proactive alert');

// --- messages render ---
console.log('\n--- WhatsApp reply previews ---\n');
console.log(msg.trackConfirm(r.tracker, false));
console.log('\n' + msg.alertMessage(r.tracker, 'target'));
console.log('\n' + msg.listMessage(await listTrackers(owner)));

// --- untrack ---
assert.ok(await removeTrackerByIndex(owner, 1));
assert.strictEqual((await listTrackers(owner)).length, 0);
console.log('\n✓ untrack');

await rm(DATA_FILE, { force: true });
console.log('\n✅ Smoke test passed.');
