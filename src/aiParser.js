import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from './config.js';

/**
 * AI parsing layer. Turns unstructured chat text ("get me 2 milk and some bread")
 * into a normalized array of { item_name, quantity }.
 *
 * Primary: Gemini 1.5 Flash with a strict structural-parser system prompt.
 * Fallback: a lightweight local parser used when no API key is configured or
 * when Gemini errors / returns malformed JSON — so the bot always responds.
 */

const SYSTEM_PROMPT =
  "You are a structural parser. Extract grocery/shopping items from the user's " +
  'unstructured chat text. Output a raw, valid JSON array of objects only, ' +
  "containing 'item_name' (string) and 'quantity' (number). Do not include " +
  'markdown code fences, backticks, or conversational filler.';

let model = null;
if (GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });
}

// Strip ```json fences / stray backticks the model may add despite instructions.
function stripFences(text) {
  return text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
}

// Normalize + validate any parsed structure into clean line items.
function normalize(parsed) {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Parser did not return a non-empty array.');
  }
  const items = parsed
    .map((it) => {
      const qty = Number(it?.quantity);
      return {
        item_name: String(it?.item_name ?? '').trim(),
        quantity: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1,
      };
    })
    .filter((it) => it.item_name.length > 0);

  if (items.length === 0) throw new Error('No valid items after normalization.');
  return items;
}

const STOP_WORDS =
  /\b(some|a|an|the|packs?|pack|of|please|pls|plz|get|me|buy|need|want|kindly|order|grab|couple|few)\b/gi;

/**
 * Local, dependency-free parser. Handles common patterns:
 *   "2 milk", "milk x2", "3 x eggs", comma / "and" / newline separated lists.
 * @param {string} text
 * @returns {Array<{item_name: string, quantity: number}>}
 */
export function fallbackParse(text) {
  const chunks = String(text)
    .split(/,|\band\b|\n|;|\+/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const items = [];
  for (const chunk of chunks) {
    let qty = 1;
    let name = chunk;
    let m;
    if ((m = chunk.match(/^(\d+)\s*(?:x|\*)?\s*(.+)$/i))) {
      qty = parseInt(m[1], 10);
      name = m[2];
    } else if ((m = chunk.match(/^(.+?)\s*(?:x|\*)\s*(\d+)$/i))) {
      name = m[1];
      qty = parseInt(m[2], 10);
    }
    name = name.replace(STOP_WORDS, '').replace(/\s+/g, ' ').trim();
    if (name) items.push({ item_name: name, quantity: qty > 0 ? qty : 1 });
  }

  if (items.length === 0) throw new Error('Could not parse any items from message.');
  return items;
}

/**
 * Parse a raw WhatsApp message into structured shopping items.
 * @param {string} text
 * @returns {Promise<Array<{item_name: string, quantity: number}>>}
 */
export async function parseMessage(text) {
  if (!model) {
    // No API key configured — use the local parser directly.
    return fallbackParse(text);
  }
  try {
    const result = await model.generateContent(text);
    const raw = stripFences(result.response.text());
    return normalize(JSON.parse(raw));
  } catch (err) {
    // Gemini failed or returned non-JSON — try the local parser before giving up.
    console.warn('[aiParser] Gemini parse failed, using fallback:', err.message);
    return fallbackParse(text);
  }
}
