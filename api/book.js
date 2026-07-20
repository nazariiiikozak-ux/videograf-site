// Vercel Serverless Function: /api/book
// Public. Books a slot atomically (prevents double-booking) and notifies Telegram.
// Body: { name, contact, message, date, time, honeypot }

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { name, contact, message, date, time, honeypot } = req.body || {};

  // anti-spam trap
  if (honeypot) return res.status(200).json({ ok: true });

  if (!name || !contact || !date || !time) {
    return res.status(400).json({ ok: false, error: "\u0417\u0430\u043f\u043e\u0432\u043d\u0438 \u0456\u043c'\u044f, \u043a\u043e\u043d\u0442\u0430\u043a\u0442 \u0456 \u043e\u0431\u0435\u0440\u0438 \u0441\u043b\u043e\u0442" });
  }

  try {
    // slot must currently be offered by the owner
    const offered = await redis.sismember('avail:' + date, time);
    if (!offered) {
      return res.status(409).json({ ok: false, error: '\u0426\u0435\u0439 \u0441\u043b\u043e\u0442 \u0431\u0456\u043b\u044c\u0448\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0438\u0439' });
    }

    // atomic claim: SADD returns 1 only if this member was newly added
    const claimed = await redis.sadd('booked:' + date, time);
    if (claimed === 0) {
      return res.status(409).json({ ok: false, error: '\u0426\u0435\u0439 \u0441\u043b\u043e\u0442 \u0449\u043e\u0439\u043d\u043e \u0437\u0430\u0439\u043d\u044f\u043b\u0438 \u2014 \u043e\u0431\u0435\u0440\u0438 \u0456\u043d\u0448\u0438\u0439' });
    }

    const booking = {
      name: String(name),
      contact: String(contact),
      message: message ? String(message) : '',
      date,
      time,
      createdAt: new Date().toISOString(),
    };

    await redis.set('booking:' + date + ':' + time, booking);
    await redis.sadd('bookings:index', date + '|' + time);

    // notify Telegram (do not fail the booking if this errors \u2014 the slot is already reserved)
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
  const lines = [
    '\ud83d\udcc5 *\u041d\u043e\u0432\u0435 \u0431\u0440\u043e\u043d\u044e\u0432\u0430\u043d\u043d\u044f \u0437\u0439\u043e\u043c\u043a\u0438*',
    '',
    `*\u0414\u0430\u0442\u0430:* ${escapeMd(prettyDate)}`,
    `*\u0427\u0430\u0441:* ${escapeMd(b.time)}`,
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
