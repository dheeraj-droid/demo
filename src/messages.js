/**
 * WhatsApp reply builders. WhatsApp markdown: *bold*, _italic_, `mono`.
 */

const money = (v, c = '₹') => `${c}${Number(v).toLocaleString('en-IN')}`;

export function helpMessage() {
  return [
    '🤖 *Amazon Price Tracker*',
    '',
    "Send me an Amazon product link and I'll watch the price and ping you when it drops.",
    '',
    '*Commands*',
    '• `<amazon link> under ₹4000` — track & alert below a price',
    '• `<amazon link>` — track & alert on any new low',
    '• `list` — show what I\'m tracking',
    '• `untrack 2` — stop tracking item #2',
    '• `help` — this message',
  ].join('\n');
}

export function trackConfirm(tracker, existing) {
  const lines = [
    existing ? '🔁 *Updated tracking*' : '✅ *Now tracking*',
    `*${tracker.title || tracker.asin}*`,
  ];
  if (tracker.lastPrice != null) {
    lines.push(`Current: ${money(tracker.lastPrice, tracker.currency)}`);
  } else {
    lines.push('Current: _price unavailable right now — I\'ll retry on the next check_');
  }
  if (tracker.target != null) {
    lines.push(`I'll ping you under ${money(tracker.target, tracker.currency)}.`);
    if (tracker.lastPrice != null && tracker.lastPrice <= tracker.target) {
      lines.push('🎉 It\'s already under your target!');
    }
  } else {
    lines.push("I'll ping you when it hits a new low.");
  }
  return lines.join('\n');
}

export function listMessage(trackers) {
  if (!trackers.length) {
    return "You're not tracking anything yet. Send me an Amazon product link!";
  }
  const rows = trackers.map((t, i) => {
    const now = t.lastPrice != null ? money(t.lastPrice, t.currency) : 'N/A';
    const tgt = t.target != null ? ` · target ${money(t.target, t.currency)}` : '';
    const low = t.lowestPrice != null ? ` · low ${money(t.lowestPrice, t.currency)}` : '';
    return `${i + 1}. *${t.title || t.asin}*\n   ${now}${tgt}${low}`;
  });
  return ['📋 *Tracking*', '', ...rows].join('\n');
}

export function untrackMessage(tracker) {
  return tracker
    ? `🗑️ Stopped tracking *${tracker.title || tracker.asin}*.`
    : "Couldn't find that item number. Send `list` to see them.";
}

export function alertMessage(tracker, reason) {
  const head =
    reason === 'target' ? '🔻 *Price drop — below your target!*' : '🔻 *New lowest price!*';
  return [
    head,
    `*${tracker.title || tracker.asin}*`,
    `Now: ${money(tracker.lastPrice, tracker.currency)}` +
      (tracker.target != null ? `  (target ${money(tracker.target, tracker.currency)})` : ''),
    `Lowest seen: ${money(tracker.lowestPrice, tracker.currency)}`,
    '',
    tracker.url,
  ].join('\n');
}

export function trackFailedNote() {
  return "⚠️ I couldn't read that product page just now (Amazon may have blocked the request, or the link isn't a product page).";
}

export function notAProduct() {
  return "That doesn't look like an Amazon product link. Send a full product URL (it contains `/dp/` and a 10-character code).";
}

export function errorMessage() {
  return "🤖 Sorry, I couldn't process that. Send an Amazon product link, or `help`.";
}
