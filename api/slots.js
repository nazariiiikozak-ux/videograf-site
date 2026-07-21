// Vercel Serverless Function: /api/slots
// Public. Every day defaults to 08:00-23:00. A slot is "taken" if it has a live
// pending hold OR is a confirmed booking. Expired holds are cleaned up lazily.
// Response: { ok, slots: { "YYYY-MM-DD": [ {t:"08:00",b:false}, ... ] } }

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const HORIZON_DAYS = 30;
const HOURS = Array.from({ length: 16 }, (_, i) => String(8 + i).padStart(2, '0') + ':00');

function warsawToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// live holds (+ lazy cleanup of expired) and confirmed  =  taken times for a date
async function takenTimes(date) {
  const [held, confirmed] = await Promise.all([
    redis.smembers('held:' + date),
    redis.smembers('confirmed:' + date),
  ]);
  const taken = new Set(confirmed || []);
  for (const t of held || []) {
    const alive = await redis.exists('hold:' + date + ':' + t);
    if (alive) {
      taken.add(t);
    } else {
      // pending request expired - free the slot and clean up
      await redis.srem('held:' + date, t);
      await redis.del('booking:' + date + ':' + t);
      await redis.srem('bookings:index', date + '|' + t);
    }
  }
  return taken;
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

      const [blockedHours, taken] = await Promise.all([
        redis.smembers('blocked:' + iso),
        takenTimes(iso),
      ]);
      const blk = new Set(blockedHours || []);
      const list = HOURS.filter((t) => !blk.has(t)).map((t) => ({ t, b: taken.has(t) }));
      if (list.length) slots[iso] = list;
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, slots });
  } catch (err) {
    console.error('slots error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
