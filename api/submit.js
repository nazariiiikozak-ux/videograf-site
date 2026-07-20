// Vercel Serverless Function: /api/submit
// Receives a form submission from the site and forwards it to a Telegram bot.
//
// Required environment variables (Vercel -> Settings -> Environment Variables):
//   TELEGRAM_BOT_TOKEN \u2014 bot token from @BotFather
//   TELEGRAM_CHAT_ID   \u2014 chat id to deliver the message to

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { name, contact, message, dates, honeypot } = req.body || {};

  // simple anti-spam trap (hidden field in the form)
  if (honeypot) {
    return res.status(200).json({ ok: true });
  }

  if (!name || !contact) {
    return res.status(400).json({ ok: false, error: "\u0417\u0430\u043f\u043e\u0432\u043d\u0438 \u0456\u043c'\u044f \u0442\u0430 \u043a\u043e\u043d\u0442\u0430\u043a\u0442" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars');
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const lines = [
    '\ud83d\udce9 *\u041d\u043e\u0432\u0430 \u0437\u0430\u044f\u0432\u043a\u0430 \u0437 \u0441\u0430\u0439\u0442\u0443*',
    '',
    `*\u0406\u043c\u02bc\u044f:* ${escapeMd(name)}`,
    `*\u041a\u043e\u043d\u0442\u0430\u043a\u0442:* ${escapeMd(contact)}`,
  ];

  if (dates) lines.push(`*\u0414\u0430\u0442\u0438 \u0437\u0439\u043e\u043c\u043a\u0438:* ${escapeMd(dates)}`);
  if (message) lines.push('', `*\u041e\u043f\u0438\u0441 \u043f\u0440\u043e\u0454\u043a\u0442\u0443:*`, escapeMd(message));

  const text = lines.join('\n');

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
      }),
    });

    const data = await tgRes.json();

    if (!data.ok) {
      console.error('Telegram API error:', data);
      return res.status(502).json({ ok: false, error: 'Telegram delivery failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Failed to send to Telegram:', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}

// Escape text for Telegram MarkdownV2 (all reserved chars, incl. backslash).
function escapeMd(str) {
  return String(str).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
