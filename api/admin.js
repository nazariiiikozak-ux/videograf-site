// Vercel Serverless Function: /api/admin
// Password-protected. Manage availability and view/cancel bookings.
// Auth: header "x-admin-password" must equal process.env.ADMIN_PASSWORD.
//
// GET                              -> { ok, dates: { "YYYY-MM-DD": { slots:[...], bookings:{ "10:00": {...} } } } }
// POST { action:"addSlot",     date, time  }
// POST { action:"removeSlot",  date, time  }
// POST { action:"cancelBooking", date, time }

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;   // HH:MM 24h
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;         // YYYY-MM-DD

export default async function handler(req, res) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    console.error('Missing ADMIN_PASSWORD env var');
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const given = req.headers['x-admin-password'];
  if (!given || given !== secret) {
    return res.status(401).json({ ok: false, error: '\u041d\u0435\u0432\u0456\u0440\u043d\u0438\u0439 \u043f\u0430\u0440\u043e\u043b\u044c' });
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, dates: await buildOverview() });
    }

    if (req.method === 'POST') {
      const { action, date, time } = req.body || {};

      if (action !== 'cancelBooking' && (!DATE_RE.test(date || '') || !TIME_RE.test(time || ''))) {
        return res.status(400).json({ ok: false, error: '\u041d\u0435\u0432\u0456\u0440\u043d\u0430 \u0434\u0430\u0442\u0430 \u0430\u0431\u043e \u0447\u0430\u0441' });
      }

      if (action === 'addSlot') {
        await redis.sadd('avail:dates', date);
        await redis.sadd('avail:' + date, time);
        return res.status(200).json({ ok: true, dates: await buildOverview() });
      }

      if (action === 'removeSlot') {
        await redis.srem('avail:' + date, time);
        const left = await redis.scard('avail:' + date);
        if (left === 0) await redis.srem('avail:dates', date);
        return res.status(200).json({ ok: true, dates: await buildOverview() });
      }

      if (action === 'cancelBooking') {
        if (!DATE_RE.test(date || '') || !TIME_RE.test(time || '')) {
          return res.status(400).json({ ok: false, error: '\u041d\u0435\u0432\u0456\u0440\u043d\u0430 \u0434\u0430\u0442\u0430 \u0430\u0431\u043e \u0447\u0430\u0441' });
        }
        await redis.srem('booked:' + date, time);
        await redis.del('booking:' + date + ':' + time);
        await redis.srem('bookings:index', date + '|' + time);
        return res.status(200).json({ ok: true, dates: await buildOverview() });
      }

      return res.status(400).json({ ok: false, error: '\u041d\u0435\u0432\u0456\u0434\u043e\u043c\u0430 \u0434\u0456\u044f' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('admin error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}

async function buildOverview() {
  const availDates = (await redis.smembers('avail:dates')) || [];
  const idx = (await redis.smembers('bookings:index')) || [];
  const bookingDates = idx.map((x) => String(x).split('|')[0]);

  const allDates = Array.from(new Set([...availDates, ...bookingDates])).sort();
  const out = {};

  for (const date of allDates) {
    const [slots, booked] = await Promise.all([
      redis.smembers('avail:' + date),
      redis.smembers('booked:' + date),
    ]);
    const bookings = {};
    for (const t of booked || []) {
      const rec = await redis.get('booking:' + date + ':' + t);
      bookings[t] = rec || { time: t };
    }
    out[date] = { slots: (slots || []).sort(), bookings };
  }
  return out;
}
