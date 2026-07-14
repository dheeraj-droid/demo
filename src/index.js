import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

import { parseCommand } from './commands.js';
import { fetchProduct, extractAsin, canonicalUrl } from './amazonScraper.js';
import { addTracker, listTrackers, removeTrackerByIndex } from './store.js';
import { startScheduler } from './scheduler.js';
import { closeBrowser } from './browser.js';
import { PUPPETEER_EXECUTABLE_PATH } from './config.js';
import * as msg from './messages.js';

const { Client, LocalAuth } = pkg;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: PUPPETEER_EXECUTABLE_PATH, // undefined → bundled Chromium
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
    ],
  },
});

client.on('qr', (qr) => {
  console.log('📱 Scan this QR with WhatsApp → Linked Devices:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ Bot is ready!');
  // Proactively DM the owner when a tracked price drops.
  startScheduler((owner, text) => client.sendMessage(owner, text));
});

client.on('auth_failure', (m) => console.error('❌ Auth failure:', m));
client.on('disconnected', (r) => console.warn('⚠️  Disconnected:', r));

async function handleTrack(message, cmd) {
  const owner = message.from;
  await message.reply('🔎 Fetching that product…');

  let product;
  try {
    product = await fetchProduct(cmd.url);
  } catch (err) {
    console.warn('[track] fetch failed:', err.message);
    // Still track it (price null) so the scheduler retries later.
    product = {
      asin: extractAsin(cmd.url),
      url: canonicalUrl(cmd.url),
      title: null,
      price: null,
      currency: '₹',
    };
  }

  if (!product.asin) {
    await message.reply(msg.notAProduct());
    return;
  }

  const { tracker, existing } = await addTracker({ owner, product, target: cmd.target });
  const confirm = msg.trackConfirm(tracker, existing);
  await message.reply(product.price == null ? `${msg.trackFailedNote()}\n\n${confirm}` : confirm);
}

client.on('message', async (message) => {
  // Individual text chats only — skip groups and non-text.
  let chat;
  try {
    chat = await message.getChat();
  } catch {
    return;
  }
  if (chat.isGroup) return;
  if (message.type !== 'chat') return;

  const text = (message.body || '').trim();
  if (!text) return;

  try {
    const cmd = parseCommand(text);
    switch (cmd.type) {
      case 'track':
        await handleTrack(message, cmd);
        break;
      case 'list':
        await message.reply(msg.listMessage(await listTrackers(message.from)));
        break;
      case 'untrack':
        await message.reply(msg.untrackMessage(await removeTrackerByIndex(message.from, cmd.index)));
        break;
      case 'help':
      case 'unknown':
      default:
        await message.reply(msg.helpMessage());
        break;
    }
  } catch (err) {
    console.error('[message] error:', err);
    try {
      await message.reply(msg.errorMessage());
    } catch {
      /* ignore secondary send failure */
    }
  }
});

async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down…`);
  await closeBrowser();
  try {
    await client.destroy();
  } catch {
    /* ignore */
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.initialize();
