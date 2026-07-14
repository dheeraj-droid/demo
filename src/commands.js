/**
 * Parses incoming WhatsApp text into a structured command. Deliberately
 * regex-based (no LLM): tracking commands are structured, so this is faster,
 * free, and needs no API key.
 */

const AMAZON_URL_RE = /https?:\/\/[^\s]*amazon\.[a-z.]+\/[^\s]*/i;

/** Parse a target price from "under ₹4,000" / "below 4000" / "< 4k" / "at 3999". */
export function parseTarget(text) {
  const m = String(text).match(/(?:under|below|less than|<|at|for)\s*₹?\s*([\d.,]+)\s*(k)?\b/i);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  if (m[2]) n *= 1000; // "4k" → 4000
  return n;
}

/**
 * @returns {{type:'track', url, target}|{type:'list'}|{type:'untrack', index}|{type:'help'}|{type:'unknown'}}
 */
export function parseCommand(text) {
  const t = String(text).trim();

  const url = (t.match(AMAZON_URL_RE) || [])[0];
  if (url) return { type: 'track', url, target: parseTarget(t) };

  if (/^(list|show|status|tracking)\b/i.test(t)) return { type: 'list' };

  if (/^(untrack|remove|stop|delete|rm)\b/i.test(t)) {
    const n = parseInt((t.match(/\d+/) || [])[0], 10);
    return { type: 'untrack', index: Number.isFinite(n) ? n : null };
  }

  if (/^(help|hi|hello|hey|start|menu|\?)\b/i.test(t)) return { type: 'help' };

  return { type: 'unknown' };
}
