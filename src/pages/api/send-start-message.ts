import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  // Замени на свой настоящий user ID (узнай у @userinfobot)
  const MY_USER_ID = '-1003929499461'; 

  if (!BOT_TOKEN || MY_USER_ID === '-1003929499461') {
    return res.status(400).json({ error: 'Укажи свой USER ID в коде' });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: MY_USER_ID,
        text: 'Привет! Твой помощник по ортопедии готов к работе:',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🚀 Открыть OrthoByNekruz',
                web_app: {
                  url: 'https://ortho-by-nekruz.vercel.app/',
                  fullscreen: true   // пробуем форсировать fullscreen
                }
              }
            ]
          ]
        }
      })
    });

    const data = await response.json();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при отправке' });
  }
}