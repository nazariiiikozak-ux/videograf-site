// Vercel Serverless Function: /api/admin
// Password-protected. Every day defaults to 08:00-23:00; here the owner marks
// days off / blocks individual hours, and confirms/declines/cancels bookings.
// Requests arrive as PENDING holds (24h TTL) - the owner confirms or declines them.
// Auth: header "x-admin-password" must equal process.env.ADMIN_PASSWORD.
//
// GET  -> { ok, hours, today, blockedDays:[...], blockedHours:{date:[...]},
//           pending:[{date,times,name,contact,message,createdAt,expiresInS}],
//           confirmed:[{date,times,name,contact,message,createdAt}] }
// POST { action:"blockDay",        date }
// POST { action:"unblockDay",      date }
// POST { action:"blockHour",       date, time }
// POST { action:"unblockHour",     date, time }
// POST { action:"confirmBooking",  date, time | times }   pending -> confirmed
// POST { action:"declineBooking",  date, time | times }   drop pending, free slot
// POST { action:"cancelBooking",   date, time | times }   drop confirmed, free slot

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const HORIZON_DAYS = 30;
const HOURS = Array.from({ length: 16 }, (_, i) => String(8 + i).padStart(2, '0') + ':00');

function warsawToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

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
      return res.status(200).json({ ok: true, ...(await buildOverview()) });
    }

    if (req.method === 'POST') {
      const { action, date, time, times } = req.body || {};

      if (!DATE_RE.test(date || '')) {
        return res.status(400).json({ ok: false, error: '\u041d\u0435\u0432\u0456\u0440\u043d\u0430 \u0434\u0430\u0442\u0430' });
      }

      if (action === 'blockDay') {
        await redis.sadd('blocked:dates', date);
        return res.status(200).json({ ok: true, ...(await buildOverview()) });
      }
      if (action === 'unblockDay') {
        await redis.srem('blocked:dates', date);
        return res.status(200).json({ ok: true, ...(await buildOverview()) });
      }

      if (action === 'blockHour' || action === 'unblockHour') {
        if (!TIME_RE.test(time || '')) {
          return res.status(400).json({ ok: false, error: '\u041d\u0435\u0432\u0456\u0440\u043d\u0438\u0439 \u0447\u0430\u0441' });
        }
        if (action === 'blockHour') await redis.sadd('blocked:' + date, time);
        else await redis.srem('blocked:' + date, time);
        return res.status(200).json({ ok: true, ...(await buildOverview()) });
      }

      if (action === 'confirmBooking' || action === 'declineBooking' || action === 'cancelBooking') {
        const list = (Array.isArray(times) ? times : (time ? [time] : []))
          .map((t) => String(t)).filter((t) => TIME_RE.test(t));
        for (const t of list) {
          if (action === 'confirmBooking') {
            await redis.sadd('confirmed:' + date, t); // permanent
            await redis.del('hold:' + date + ':' + t); // drop the TTL hold
            await redis.srem('held:' + date, t);
          } else {
            // decline (pending) or cancel (confirmed): free the slot entirely
            await redis.srem('confirmed:' + date, t);
            await redis.del('hold:' + date + ':' + t);
            await redis.srem('held:' + date, t);
            await redis.del('booking:' + date + ':' + t);
            await redis.srem('bookings:index', date + '|' + t);
          }
        }
        return res.status(200).json({ ok: true, ...(await buildOverview()) });
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
  const today = warsawToday();
  const [y, m, d] = today.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);

  const blockedDays = ((await redis.smembers('blocked:dates')) || [])
    .filter((x) => x >= today)
    .sort();

  const blockedHours = {};
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const iso = new Date(base + i * 86400000).toISOString().slice(0, 10);
    const bh = (await redis.smembers('blocked:' + iso)) || [];
    if (bh.length) blockedHours[iso] = bh.slice().sort();
  }

  // group active hours into whole bookings, tagged pending vs confirmed
  const idx = (await redis.smembers('bookings:index')) || [];
  const groups = {};
  for (const entry of idx) {
    const [date, time] = String(entry).split('|');
    if (!date || !time) continue;

    const isConf = await redis.sismember('confirmed:' + date, time);
    let status;
    if (isConf) {
      status = 'confirmed';
    } else if (await redis.exists('hold:' + date + ':' + time)) {
      status = 'pending';
    } else {
      // expired pending request - clean up and skip
      await redis.srem('held:' + date, time);
      await redis.del('booking:' + date + ':' + time);
      await redis.srem('bookings:index', date + '|' + time);
      continue;
    }

    const rec = (await redis.get('booking:' + date + ':' + time)) || {};
    const key = status + '#' + date + '#' + (rec.createdAt || '') + '#' + (rec.name || '') + '#' + (rec.contact || '');
    if (!groups[key]) {
      groups[key] = {
        date, status, times: [], firstTime: time,
        name: rec.name || '', contact: rec.contact || '',
        message: rec.message || '', createdAt: rec.createdAt || '',
      };
    }
    groups[key].times.push(time);
  }

  const all = Object.values(groups)
    .map((g) => ({ ...g, times: g.times.sort() }))
    .filter((g) => g.date >= today)
    .sort((a, b) => (a.date + (a.times[0] || '')).localeCompare(b.date + (b.times[0] || '')));

  const pending = [];
  for (const g of all.filter((x) => x.status === 'pending')) {
    const ttl = await redis.ttl('hold:' + g.date + ':' + g.firstTime); // seconds left
    pending.push({
      date: g.date, times: g.times, name: g.name, contact: g.contact,
      message: g.message, createdAt: g.createdAt, expiresInS: ttl > 0 ? ttl : 0,
    });
  }
  const confirmed = all.filter((x) => x.status === 'confirmed').map((g) => ({
    date: g.date, times: g.times, name: g.name, contact: g.contact,
    message: g.message, createdAt: g.createdAt,
  }));

  return { hours: HOURS, today, blockedDays, blockedHours, pending, confirmed };
}
