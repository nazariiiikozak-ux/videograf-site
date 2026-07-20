// Vercel Serverless Function: /api/book
// Public. Books a slot atomically (prevents double-booking) and notifies Telegram.
// Body: { name, contact, message, date, times (array or comma-string) | time, honeypot }

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const HORIZON_DAYS = 30;
const HOURS = Array.from({ length: 16 }, (_, i) => String(8 + i).padStart(2, '0') + ':00'); // 08:00..23:00

function warsawToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function withinHorizon(iso) {
  const today = warsawToday();
  if (iso < today) return false;
  const [y, m, d] = today.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1, d) + (HORIZON_DAYS - 1) * 86400000).toISOString().slice(0, 10);
  return iso <= last;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { name, contact, message, date, time, times, honeypot } = req.body || {};

  // anti-spam trap
  if (honeypot) return res.status(200).json({ ok: true });

  // normalize requested hours into a sorted, de-duplicated list
  let list = Array.isArray(times) ? times : (typeof times === 'string' ? times.split(',') : (time ? [time] : []));
  list = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))].sort();

  if (!name || !contact || !date || !list.length) {
    return res.status(400).json({ ok: false, error: "\u0417\u0430\u043f\u043e\u0432\u043d\u0438 \u0456\u043c'\u044f, \u043a\u043e\u043d\u0442\u0430\u043a\u0442 \u0456 \u043e\u0431\u0435\u0440\u0438 \u0447\u0430\u0441" });
  }

  try {
    // day must be open (within horizon and not a day off)
    if (!withinHorizon(date) || (await redis.sismember('blocked:dates', date))) {
      return res.status(409).json({ ok: false, error: '\u0426\u0435\u0439 \u0434\u0435\u043d\u044c \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0438\u0439 \u0434\u043b\u044f \u0431\u0440\u043e\u043d\u044e\u0432\u0430\u043d\u043d\u044f' });
    }
    // each requested hour must be a real default slot and not blocked by the owner
    const blockedHours = new Set((await redis.smembers('blocked:' + date)) || []);
    for (const t of list) {
      if (!HOURS.includes(t) || blockedHours.has(t)) {
        return res.status(409).json({ ok: false, error: '\u041e\u0434\u043d\u0430 \u0437 \u043e\u0431\u0440\u0430\u043d\u0438\u0445 \u0433\u043e\u0434\u0438\u043d \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430' });
      }
    }

    // atomic-ish multi-claim: SADD returns 1 only if newly added; roll back on any conflict
    const claimed = [];
    for (const t of list) {
      const got = await redis.sadd('booked:' + date, t);
      if (got === 1) {
        claimed.push(t);
      } else {
        for (const rb of claimed) await redis.srem('booked:' + date, rb);
        return res.status(409).json({ ok: false, error: '\u041e\u0434\u043d\u0443 \u0437 \u0433\u043e\u0434\u0438\u043d \u0449\u043e\u0439\u043d\u043e \u0437\u0430\u0439\u043d\u044f\u043b\u0438 \u2014 \u043e\u043d\u043e\u0432\u0438 \u0439 \u043e\u0431\u0435\u0440\u0438 \u0437\u043d\u043e\u0432\u0443' });
      }
    }

    const booking = {
      name: String(name),
      contact: String(contact),
      message: message ? String(message) : '',
      date,
      times: list,
      createdAt: new Date().toISOString(),
    };

    for (const t of list) {
      await redis.set('booking:' + date + ':' + t, { ...booking, time: t });
      await redis.sadd('bookings:index', date + '|' + t);
    }

    // notify Telegram (do not fail the booking if this errors \u2014 the slots are already reserved)
    try {
      await notifyTelegram(booking);
    } catch (tgErr) {
      console.error('Telegram notify failed (booking still saved):', tgErr);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('book error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}

async function notifyTelegram(b) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars');
    return;
  }

  const prettyDate = formatDate(b.date);
  const hours = Array.isArray(b.times) ? b.times : [b.time];
  const hoursLabel = hours.length > 1
    ? `${hours[0]}\u2013${hours[hours.length - 1]} (${hours.length} \u0433\u043e\u0434): ${hours.join(', ')}`
    : hours[0];
  const lines = [
    '\ud83d\udcc5 *\u041d\u043e\u0432\u0435 \u0431\u0440\u043e\u043d\u044e\u0432\u0430\u043d\u043d\u044f \u0437\u0439\u043e\u043c\u043a\u0438*',
    '',
    `*\u0414\u0430\u0442\u0430:* ${escapeMd(prettyDate)}`,
    `*\u0427\u0430\u0441:* ${escapeMd(hoursLabel)}`,
    `*\u0406\u043c\u02bc\u044f:* ${escapeMd(b.name)}`,
    `*\u041a\u043e\u043d\u0442\u0430\u043a\u0442:* ${escapeMd(b.contact)}`,
  ];
  if (b.message) lines.push('', '*\u041e\u043f\u0438\u0441 \u043f\u0440\u043e\u0454\u043a\u0442\u0443:*', escapeMd(b.message));

  const text = lines.join('\n');

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
  });
  const data = await tgRes.json();
  if (!data.ok) console.error('Telegram API error:', data);
}

// "2026-08-12" -> "12.08.2026"
function formatDate(iso) {
  const [y, m, d] = String(iso).split('-');
  return `${d}.${m}.${y}`;
}

// Escape text for Telegram MarkdownV2 (all reserved chars, incl. backslash).
function escapeMd(str) {
  return String(str).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
