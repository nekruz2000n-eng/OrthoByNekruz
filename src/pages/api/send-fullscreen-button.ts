import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Берем токен из переменных окружения, куда ты его сохранил
  const BOT_TOKEN = process.env.BOT_TOKEN;
  // Вставь сюда свой ID, который ты узнал у @userinfobot
  const CHAT_ID = '-1003929499461';

  if (!BOT_TOKEN || CHAT_ID === '-1003929499461') {
    return res.status(400).json({ error: 'Не забудь вписать свой CHAT_ID в коде функции!' });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: 'Запускай и учись! 😉',
        reply_markup: {
          inline_keyboard: [[{
            text: '📚 Открыть приложение', web_app: { url: 'https://ortho-by-nekruz.vercel.app/' }
          }]]
        }
      })
    });
    
    const data = await response.json();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при отправке сообщения' });
  }
}