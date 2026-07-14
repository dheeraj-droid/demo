# WhatsApp Amazon Price Tracker 🛒📉

A WhatsApp bot that tracks Amazon product prices and **DMs you when they drop**.
Send it a product link (optionally with a target price); it re-checks on a
schedule and pings you proactively on a price drop.

```
You: https://www.amazon.in/dp/B0CHX1W1XY under ₹4000
Bot: ✅ Now tracking
     Sony WH-1000XM5
     Current: ₹4,990
     I'll ping you under ₹4,000.

     … (checks every few hours) …

Bot: 🔻 Price drop — below your target!
     Sony WH-1000XM5
     Now: ₹3,899  (target ₹4,000)
     https://www.amazon.in/dp/B0CHX1W1XY
```

## Commands

| Send | Does |
|------|------|
| `<amazon link> under ₹4000` | Track it, alert below ₹4000 |
| `<amazon link>` | Track it, alert on any new low |
| `list` | Show what you're tracking |
| `untrack 2` | Stop tracking item #2 |
| `help` | Show commands |

## How it works

```
WhatsApp message
      │
      ▼
 commands.js   ── regex parse → { track <url> under <target> | list | untrack N | help }
      │
      ▼
 amazonScraper.js ── headless Chromium loads the product page, reads title + ₹ price
      │
      ▼
 store.js      ── JSON store of tracked items + price history (per user)
      │
      ▼
 scheduler.js  ── node-cron re-checks every product; decides when to alert
      │
      ▼
 index.js      ── WhatsApp client sends the proactive drop alert
```

| File | Responsibility |
|------|----------------|
| `src/index.js` | WhatsApp client, QR login, command routing, scheduler wiring |
| `src/commands.js` | Regex command parser (URL, target price, list/untrack/help) |
| `src/amazonScraper.js` | ASIN resolution + product-page scrape (title, price, availability) |
| `src/browser.js` | Shared Puppeteer browser (UA, proxy, Chromium path) |
| `src/store.js` | JSON persistence + alert decision logic |
| `src/scheduler.js` | `node-cron` periodic checker → proactive alerts |
| `src/messages.js` | WhatsApp reply formatting |
| `src/config.js` | Env config (schedule, data file, proxy, timeouts) |

## Setup

```bash
npm install                 # installs deps + Chromium
cp .env.example .env        # tweak CHECK_CRON / PROXY_SERVER if needed
npm start                   # scan the QR with WhatsApp → Linked Devices
```

On `ready` the console prints `Bot is ready!` and the scheduler starts. DM the
bot an Amazon link from any chat — it ignores group chats and non-text messages.

## Verifying

```bash
npm run smoke                              # offline: parse → store → alert → scheduler (no browser)
npm run scrape:check "https://amazon.in/dp/B0CHX1W1XY"   # live: scrape one real product
HEADLESS=false npm run scrape:check "<url>"              # watch the browser do it
```

## Deploying (24/7)

A long-running WhatsApp Web session — needs an always-on host with **persistent
storage** for `.wwebjs_auth/` (login) and `data/` (tracked products).

> **⚠️ Hosting vs scraping:** cloud VPS IPs are datacenter IPs, which Amazon
> often serves a robot-check. A **home machine / Raspberry Pi** (residential IP)
> is ideal — personal, low-volume checks mostly succeed. On a VPS, set
> `PROXY_SERVER` to a residential proxy.

### Option A — pm2 (home machine / Pi)

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 logs qc-bot          # scan the QR on first run
pm2 save && pm2 startup  # auto-restart on reboot
```

### Option B — Docker / Compose

Uses the distro's Chromium (no second download) and persists login + data in
named volumes.

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f qc-bot   # scan the QR on first run
```

## ⚠️ Honest caveats about scraping

Amazon has **no free public price API**, so prices are scraped from product
pages. That means:

- **Robot-checks.** Requests from datacenter IPs are often challenged, so a
  scrape can fail even when the code is correct. Use a residential IP/proxy. The
  scraper detects the robot-check and reports it clearly rather than guessing.
- **Selectors drift.** Amazon rotates page layouts; the price selectors in
  `src/amazonScraper.js` may need occasional updates (multiple are tried, plus a
  fallback).
- **Terms of service.** Automated scraping may conflict with Amazon's ToS. Keep
  volume low and use responsibly.
- **Reliable upgrade path:** [Keepa](https://keepa.com/#!api) is a paid API built
  for exactly this (with full price history). Swapping it in is a one-function
  change in `src/amazonScraper.js` (`fetchProduct`) — nothing else changes.

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `CHECK_CRON` | `0 */3 * * *` | How often to re-check prices (cron) |
| `DATA_FILE` | `./data/trackers.json` | Where tracked products are stored |
| `MAX_HISTORY` | `200` | Price-history points kept per product |
| `HEADLESS` | `true` | `false` shows the browser window |
| `SCRAPE_TIMEOUT` | `25000` | Per-navigation timeout (ms) |
| `PUPPETEER_EXECUTABLE_PATH` | _(empty)_ | System Chromium path (set in Docker) |
| `PROXY_SERVER` | _(empty)_ | Residential proxy for the scraper (VPS path) |
| `PROXY_USERNAME` / `PROXY_PASSWORD` | _(empty)_ | Proxy auth, if required |
