// Vercel Serverless Function: /api/portfolio
// Public GET. Returns the portfolio cards the site renders. If the owner has saved
// a custom set (via /api/admin savePortfolio) it returns that; otherwise the built-in
// defaults, so the site is never empty. `stored` tells the client whether to re-render.
// Response: { ok, items:[{id,format,tag,titleOv,title,subtitle,video,poster}], stored }

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// format: 'v' = vertical 9:16 (#reel), 'h' = horizontal 16:9 (#films)
const DEFAULT_ITEMS = [
  { id: 'v1', format: 'v', tag: 'Reel',     titleOv: '\u0421\u043e\u0446\u043c\u0435\u0440\u0435\u0436\u0456', title: '\u041d\u0430\u0437\u0432\u0430 \u043f\u0440\u043e\u0454\u043a\u0442\u0443', subtitle: 'Reel \u00b7 \u0411\u0440\u0435\u043d\u0434',            video: '', poster: '' },
  { id: 'v2', format: 'v', tag: 'Music',    titleOv: '\u0410\u0440\u0442\u0438\u0441\u0442',    title: '\u041d\u0430\u0437\u0432\u0430 \u043f\u0440\u043e\u0454\u043a\u0442\u0443', subtitle: 'Music \u00b7 \u0412\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u044c',       video: '', poster: '' },
  { id: 'v3', format: 'v', tag: 'Brand',    titleOv: '\u0411\u0440\u0435\u043d\u0434',     title: '\u041d\u0430\u0437\u0432\u0430 \u043f\u0440\u043e\u0454\u043a\u0442\u0443', subtitle: 'Brand \u00b7 \u041f\u0440\u043e\u043c\u043e',           video: '', poster: '' },
  { id: 'v4', format: 'v', tag: 'Story',    titleOv: '\u0406\u0441\u0442\u043e\u0440\u0456\u044f',   title: '\u041d\u0430\u0437\u0432\u0430 \u043f\u0440\u043e\u0454\u043a\u0442\u0443', subtitle: 'Story \u00b7 \u041a\u043e\u043d\u0442\u0435\u043d\u0442',         video: '', poster: '' },
  { id: 'v5', format: 'v', tag: 'IG',       titleOv: '\u041a\u0430\u043c\u043f\u0430\u043d\u0456\u044f',  title: '\u041d\u0430\u0437\u0432\u0430 \u043f\u0440\u043e\u0454\u043a\u0442\u0443', subtitle: 'Campaign \u00b7 \u041a\u043e\u043b\u0430\u0431\u043e\u0440\u0430\u0446\u0456\u044f',  video: '', poster: '' },
  { id: 'h1', format: 'h', tag: '\u0420\u0435\u043a\u043b\u0430\u043c\u0430',  titleOv: '\u0420\u0435\u043a\u043b\u0430\u043c\u043d\u0438\u0439 \u0440\u043e\u043b\u0438\u043a', title: '\u041d\u0430\u0437\u0432\u0430 \u043f\u0440\u043e\u0454\u043a\u0442\u0443', subtitle: '\u0420\u0435\u043a\u043b\u0430\u043c\u0430 \u00b7 \u0411\u0440\u0435\u043d\u0434',   video: '', poster: '' },
  { id: 'h2', format: 'h', tag: '\u041a\u043b\u0456\u043f',     titleOv: '\u041c\u0443\u0437\u0438\u0447\u043d\u0438\u0439 \u043a\u043b\u0456\u043f',   title: '\u041d\u0430\u0437\u0432\u0430 \u043f\u0440\u043e\u0454\u043a\u0442\u0443', subtitle: 'Music video \u00b7 \u041a\u043b\u0456\u043f', video: '', poster: '' },
  { id: 'h3', format: 'h', tag: '\u0414\u043e\u043a\u0444\u0456\u043b\u044c\u043c', titleOv: '\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430\u043b\u043a\u0430',    title: '\u041d\u0430\u0437\u0432\u0430 \u043f\u0440\u043e\u0454\u043a\u0442\u0443', subtitle: 'Documentary \u00b7 \u0406\u0441\u0442\u043e\u0440\u0456\u044f', video: '', poster: '' },
  { id: 'h4', format: 'h', tag: '\u0411\u0440\u0435\u043d\u0434',    titleOv: '\u0411\u0440\u0435\u043d\u0434-\u043a\u043e\u043d\u0442\u0435\u043d\u0442',   title: '\u041d\u0430\u0437\u0432\u0430 \u043f\u0440\u043e\u0454\u043a\u0442\u0443', subtitle: 'Brand film \u00b7 \u041a\u043e\u043b\u0430\u0431\u043e\u0440\u0430\u0446\u0456\u044f', video: '', poster: '' },
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  try {
    const stored = await redis.get('portfolio');
    const has = Array.isArray(stored) && stored.length > 0;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, items: has ? stored : DEFAULT_ITEMS, stored: has });
  } catch (err) {
    console.error('portfolio error:', err);
    return res.status(200).json({ ok: true, items: DEFAULT_ITEMS, stored: false });
  }
}
