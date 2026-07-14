import dotenv from 'dotenv';

dotenv.config();

/**
 * Central configuration. Environment-driven values are resolved here once so
 * the rest of the app imports plain constants instead of touching process.env.
 */

// --- Scraper / browser ---
export const HEADLESS = process.env.HEADLESS !== 'false';
export const SCRAPE_TIMEOUT = Number(process.env.SCRAPE_TIMEOUT) || 25000;

// Optional path to a system Chromium. The Docker image sets this so Puppeteer
// and whatsapp-web.js share one browser instead of downloading a second copy.
export const PUPPETEER_EXECUTABLE_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH?.trim() || undefined;

// Optional residential proxy for the SCRAPER ONLY (not WhatsApp traffic).
// Useful on datacenter/VPS IPs where Amazon serves a robot-check.
//   PROXY_SERVER=http://host:port   (+ PROXY_USERNAME / PROXY_PASSWORD if authed)
export const PROXY_SERVER = process.env.PROXY_SERVER?.trim() || '';
export const PROXY_USERNAME = process.env.PROXY_USERNAME?.trim() || '';
export const PROXY_PASSWORD = process.env.PROXY_PASSWORD?.trim() || '';

// --- Tracking ---
// How often the scheduler re-checks tracked products (cron). Default: every 3h.
export const CHECK_CRON = process.env.CHECK_CRON || '0 */3 * * *';

// Where tracked products + price history are persisted (JSON).
export const DATA_FILE = process.env.DATA_FILE || './data/trackers.json';

// Max price-history points kept per product.
export const MAX_HISTORY = Number(process.env.MAX_HISTORY) || 200;
