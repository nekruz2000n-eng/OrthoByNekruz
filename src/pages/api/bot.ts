import type { NextApiRequest, NextApiResponse } from 'next';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = 'nzsdental'; // без @

// Проверка подписки на канал
async function isSubscribed(userId: number): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${CHANNEL_USERNAME}&user_id=${userId}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) return false;
    const status = data.result.status;
    return ['member', 'administrator', 'creator'].includes(status);
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const update = req.body;
  const message = update?.message;

  // Обрабатываем только команду /start
  if (
    message &&
    message.text &&
    message.text.trim().toLowerCase() === '/start'
  ) {
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) {
      // Если не удалось получить ID пользователя (маловероятно), просто отвечаем OK
      return res.status(200).json({ ok: true });
    }

    const subscribed = await isSubscribed(userId);

    if (subscribed) {
      // Пользователь подписан – отправляем кнопку входа
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: 'Привет! 🦷\nТвой помощник по ортопедии готов к работе:',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🚀 Открыть OrthoByNekruz',
                  web_app: {
                    url: 'https://ortho-by-nekruz.vercel.app/',
                    fullscreen: true,   // попытка открыть без плашки
                  },
                },
              ],
            ],
          },
        }),
      });
    } else {
      // Не подписан – просим подписаться
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Чтобы воспользоваться ботом, подпишись на канал @${CHANNEL_USERNAME} и нажми /start ещё раз.`,
        }),
      });
    }
  }

  // Всегда отвечаем 200 OK, чтобы Telegram не считал вебхук сломанным
  return res.status(200).json({ ok: true });
}