import { NextResponse } from 'next/server';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = 'nzsdental';

// Проверка подписки на канал через Telegram API
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

export async function POST(req: Request) {
  const update = await req.json();
  const message = update?.message;

  if (message && message.text && message.text.trim().toLowerCase() === '/start') {
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) {
      return NextResponse.json({ ok: true });
    }

    const subscribed = await isSubscribed(userId);

    if (subscribed) {
      // Отправляем приветственное сообщение с кнопкой входа в приложение
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
                    fullscreen: true   // ← добавили
                  }
                },
              ],
            ],
          },
        }),
      });
    } else {
      // Просим подписаться на канал
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

  return NextResponse.json({ ok: true });
}