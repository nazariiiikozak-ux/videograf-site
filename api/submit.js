// Vercel Serverless Function: /api/submit
// Приймає заявку з форми на сайті та відправляє її в Telegram-бот.
//
// Потрібні змінні середовища (Vercel → Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN — токен бота від @BotFather
//   TELEGRAM_CHAT_ID   — chat_id, куди слати повідомлення

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { name, contact, message, dates, honeypot } = req.body || {};

  // проста анти-спам пастка (прихована поле у формі)
  if (honeypot) {
    return res.status(200).json({ ok: true });
  }

  if (!name || !contact) {
    return res.status(400).json({ ok: false, error: "Заповни ім'я та контакт" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars');
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const lines = [
    '📩 *Нова заявка з сайту*',
    '',
    `*Імʼя:* ${escapeMd(name)}`,
    `*Контакт:* ${escapeMd(contact)}`,
  ];

  if (dates) lines.push(`*Дати зйомки:* ${escapeMd(dates)}`);
  if (message) lines.push('', `*Опис проєкту:*`, escapeMd(message));

  const text = lines.join('\n');

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
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

function escapeMd(str) {
  return String(str).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
