/**
 * Formats the price comparison into a concise, WhatsApp-friendly message.
 * WhatsApp markdown: *bold*, _italic_. Keep it scannable.
 */

const rupee = (n) => `₹${Number(n).toFixed(2)}`;

export function formatComparison(result, items) {
  const { platforms, cheaper, savings, anyPriced } = result;

  const basket = items.map((i) => `• ${i.quantity} × ${i.item_name}`).join('\n');

  const blocks = platforms.map((p) => {
    const lines = [
      `${p.emoji} *${p.platform}*`,
      `   Items: ${rupee(p.subtotal)}  |  Fee: ${rupee(p.fee)}`,
      `   *Total: ${rupee(p.total)}*`,
    ];
    if (p.missing.length) {
      lines.push(`   ⚠️ Not found: ${p.missing.join(', ')}`);
    }
    return lines.join('\n');
  });

  let verdict;
  if (!anyPriced) {
    verdict = "😕 Couldn't fetch live prices right now — try again in a bit.";
  } else if (savings > 0 && cheaper) {
    verdict = `✅ *${cheaper} is cheaper — you save ${rupee(savings)}!*`;
  } else {
    verdict = '✅ Both platforms cost about the same.';
  }

  const links = platforms.map((p) => `${p.emoji} ${p.platform}: ${p.deepLink}`).join('\n');

  return [
    '🛒 *Blinkit vs Zepto*',
    '',
    basket,
    '',
    ...blocks,
    '',
    verdict,
    '',
    links,
    '',
    '_Live prices scraped just now — may vary by dark store & time._',
  ].join('\n');
}
