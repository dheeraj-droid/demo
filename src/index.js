import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

import { parseMessage } from './aiParser.js';
import { comparePrices } from './priceEngine.js';
import { formatComparison } from './formatter.js';
import { closeBrowser } from './scraper.js';

const { Client, LocalAuth } = pkg;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    // Optimized for low-resource / containerized environments.
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

client.on('ready', () => console.log('✅ Bot is ready!'));
client.on('auth_failure', (msg) => console.error('❌ Auth failure:', msg));
client.on('disconnected', (reason) => console.warn('⚠️  Disconnected:', reason));

client.on('message', async (message) => {
  // Only process direct, individual text chats — skip groups and non-text.
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
    const items = await parseMessage(text);
    await message.reply(`🔎 Checking Blinkit & Zepto for ${items.length} item(s)…`);

    const comparison = await comparePrices(items);
    await message.reply(formatComparison(comparison, items));
  } catch (err) {
    console.error('[message] error:', err);
    try {
      await message.reply(
        '🤖 Sorry, I couldn\'t process that. Send a grocery list like:\n\n_"2 milk, 1 bread, 6 eggs"_'
      );
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
