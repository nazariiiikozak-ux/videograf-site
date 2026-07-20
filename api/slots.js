// Vercel Serverless Function: /api/slots
// Public. Every day defaults to 08:00-23:00 available. Returns the next N days,
// each hour with its booked status; owner-blocked days and hours are excluded.
// Response: { ok, slots: { "YYYY-MM-DD": [ {t:"08:00",b:false}, {t:"09:00",b:true} ], ... } }

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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const today = warsawToday();
    const [y, m, d] = today.split('-').map(Number);
    const base = Date.UTC(y, m - 1, d);

    const blockedDays = new Set((await redis.smembers('blocked:dates')) || []);
    const slots = {};

    for (let i = 0; i < HORIZON_DAYS; i++) {
      const iso = new Date(base + i * 86400000).toISOString().slice(0, 10);
      if (blockedDays.has(iso)) continue;

      const [booked, blockedHours] = await Promise.all([
        redis.smembers('booked:' + iso),
        redis.smembers('blocked:' + iso),
      ]);
      const bookedSet = new Set(booked || []);
      const blockedSet = new Set(blockedHours || []);

      const list = HOURS.filter((t) => !blockedSet.has(t)).map((t) => ({ t, b: bookedSet.has(t) }));
      if (list.length) slots[iso] = list;
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, slots });
  } catch (err) {
    console.error('slots error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
