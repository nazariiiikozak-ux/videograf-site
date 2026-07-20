// Vercel Serverless Function: /api/slots
// Public. Returns future slots (with booked status) for the site calendar.
// Response: { ok: true, slots: { "2026-08-12": [ {t:"10:00",b:false}, {t:"13:00",b:true} ], ... } }

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const dates = (await redis.smembers('avail:dates')) || [];
    // "today" in Warsaw as YYYY-MM-DD, so past days drop off automatically
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

    const future = dates.filter((d) => d >= today).sort();
    const slots = {};

    for (const date of future) {
      const [avail, booked] = await Promise.all([
        redis.smembers('avail:' + date),
        redis.smembers('booked:' + date),
      ]);
      if (!avail || !avail.length) continue;
      const bookedSet = new Set(booked || []);
      slots[date] = avail.slice().sort().map((t) => ({ t, b: bookedSet.has(t) }));
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, slots });
  } catch (err) {
    console.error('slots error:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
